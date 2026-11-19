package com.capstone.dsaplatform.runner;

import static java.nio.charset.StandardCharsets.UTF_8;
import static java.util.concurrent.TimeUnit.MILLISECONDS;
import static java.util.concurrent.TimeUnit.NANOSECONDS;

import com.capstone.dsaplatform.entity.Problem;
import com.capstone.dsaplatform.entity.TestCase;
import com.capstone.dsaplatform.error.BadRequestException;
import com.sun.source.util.JavacTask;
import java.io.IOException;
import java.io.StringWriter;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import javax.lang.model.element.Element;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.ExecutableElement;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.NestingKind;
import javax.lang.model.element.PackageElement;
import javax.lang.model.element.TypeElement;
import javax.tools.Diagnostic;
import javax.tools.DiagnosticCollector;
import javax.tools.JavaCompiler;
import javax.tools.JavaFileObject;
import javax.tools.StandardJavaFileManager;
import javax.tools.ToolProvider;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

/**
 * Compiles a submission once, then runs every input in a fresh process inside the configured
 * {@link Sandbox}. A fresh process per test means static state or a crash in one test cannot affect
 * another. Java is compiled in-process (annotation processing off, so no learner code runs at
 * compile time); Python is syntax-checked inside the sandbox.
 */
@Service
@Primary
public class ProcessCodeRunner implements CodeRunner {

    // Caps the whole submission so a slow solution with many tests cannot hold a worker for minutes.
    static final long TOTAL_BUDGET_MS = 10_000;
    static final long COMPILE_LIMIT_MS = 20_000;
    static final int STDERR_SHOWN_CHARS = 4_000;

    // Re-exported for the tests and for callers that only know the old runner.
    static final int OUTPUT_CAP_BYTES = ProcessExec.OUTPUT_CAP_BYTES;

    // SubmissionEvaluator still needs to know the process failed, so a crash with no class name is never null.
    static final String NON_ZERO_EXIT = "NonZeroExit";

    // How the JVM reports an uncaught exception: Exception in thread "main" java.lang.Foo: message
    private static final Pattern UNCAUGHT =
            Pattern.compile("Exception in thread \"[^\"]*\" ([\\w$.]+)");
    // Fallback for code that calls printStackTrace() and then System.exit(1) itself.
    private static final Pattern QUALIFIED_THROWABLE =
            Pattern.compile("\\b((?:[A-Za-z_$][\\w$]*\\.)+[A-Z][\\w$]*(?:Exception|Error))\\b");
    // Last line of a Python traceback: "IndexError: list index out of range"
    private static final Pattern PY_EXCEPTION = Pattern.compile("^([A-Za-z_][\\w.]*(?:Error|Exception|Exit|Interrupt))(?::.*)?$");
    private static final Pattern PY_FRAME = Pattern.compile("^\\s*File \"([^\"]*)\", line (\\d+)");

    private final RunnerTestCaseRepository testCaseRepository;
    private final Sandbox sandbox;
    private final JavaCompiler compiler;

    @org.springframework.beans.factory.annotation.Autowired
    public ProcessCodeRunner(RunnerTestCaseRepository testCaseRepository, Sandbox sandbox) {
        this.testCaseRepository = testCaseRepository;
        this.sandbox = sandbox;
        this.compiler = ToolProvider.getSystemJavaCompiler();
        // Fail at startup, not on the first submission: a JRE has no compiler, so nothing could ever be graded.
        if (compiler == null) {
            throw new IllegalStateException(
                    "A full JDK is required to run submissions: ToolProvider.getSystemJavaCompiler() "
                            + "returned null, which means the backend is running on a JRE. "
                            + "Point JAVA_HOME at a JDK 17+ and restart.");
        }
    }

    /** Local sandbox with default settings; used by tests that build the runner by hand. */
    public ProcessCodeRunner(RunnerTestCaseRepository testCaseRepository) {
        this(testCaseRepository, new LocalSandbox(RunnerSettings.defaults()));
    }

    @Override
    public Set<Language> availableLanguages() {
        Set<Language> set = EnumSet.noneOf(Language.class);
        for (Language l : Language.values()) {
            if (sandbox.supports(l)) {
                set.add(l);
            }
        }
        return set;
    }

    @Override
    public String sandboxName() {
        return sandbox.name();
    }

    @Override
    public List<RunInput> testsFor(Long problemId) {
        List<TestCase> tests = new ArrayList<>(testCaseRepository.findByProblemId(problemId));
        // TestTag declares SAMPLE, EDGE, BOUNDARY, LARGE in that order, so the enum's natural order is
        // the first-failure order from CONTRACT.md section 1; ordinal breaks ties within a tag.
        tests.sort(Comparator.comparing(TestCase::getTag).thenComparing(TestCase::getOrdinal));
        return tests.stream().map(RunInput::of).toList();
    }

    @Override
    public RunResult run(Problem problem, String code) {
        return run(Language.JAVA, code, testsFor(problem.getId()), problem.getTimeLimitMs(), RunListener.NONE);
    }

    @Override
    public RunResult run(Language language, String code, List<RunInput> inputs, long timeLimitMs, RunListener listener) {
        if (!sandbox.supports(language)) {
            throw new BadRequestException(language.displayName() + " is not available on this server");
        }
        Path workDir = null;
        try {
            workDir = Files.createTempDirectory("dsa-run-");
            Files.writeString(workDir.resolve(language.sourceFile()), code, UTF_8);

            String compileError = compile(language, workDir);
            if (compileError != null) {
                return new RunResult(false, sanitize(compileError, workDir), List.of());
            }
            listener.compiled(inputs.size());
            return new RunResult(true, null, runAll(language, workDir, inputs, timeLimitMs, listener));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not prepare the submission workspace", e);
        } finally {
            deleteQuietly(workDir);
        }
    }

    // ---------------------------------------------------------------- compile

    /** Returns null on success, otherwise compiler messages such as "Main.java:7: error: ';' expected". */
    private String compile(Language language, Path workDir) throws IOException {
        return switch (language) {
            case JAVA -> compileJava(workDir.resolve("Main.java"), workDir);
            case PYTHON -> {
                ExecResult r = sandbox.run(language, Sandbox.Stage.COMPILE, workDir, "", COMPILE_LIMIT_MS);
                yield r.exitCode() == 0 && !r.timedOut() ? null : formatPythonSyntaxError(r.stderr());
            }
        };
    }

    private String compileJava(Path source, Path outputDir) throws IOException {
        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();
        // Closing the file manager releases handles on Main.java, so Windows can delete the temp dir.
        try (StandardJavaFileManager fileManager =
                     compiler.getStandardFileManager(diagnostics, Locale.ENGLISH, UTF_8)) {
            // Without an explicit classpath, javac would see this Spring app's classpath and accept
            // code that imports Spring or Hibernate, which would then fail at runtime.
            // -proc:none: no annotation processors, so compiling never executes learner code.
            List<String> options = List.of(
                    "-d", outputDir.toString(),
                    "-classpath", outputDir.toString(),
                    "-encoding", "UTF-8",
                    "-proc:none");
            Iterable<? extends JavaFileObject> units = fileManager.getJavaFileObjects(source.toFile());
            // The StringWriter swallows stray compiler chatter; the diagnostics carry everything we report.
            JavacTask task = (JavacTask) compiler.getTask(new StringWriter(), fileManager, diagnostics, options, null, units);
            // Analyse first: if the code compiles but has no runnable Main, say so now. Otherwise the JVM
            // would fail later with a confusing "Could not find or load main class Main".
            Iterable<? extends Element> declared = task.analyze();
            if (!hasErrors(diagnostics)) {
                String missing = mainProblem(declared);
                if (missing != null) {
                    return missing;
                }
                task.generate();
                if (!hasErrors(diagnostics)) {
                    return null;
                }
            }
        }
        String errors = diagnostics.getDiagnostics().stream()
                .filter(d -> d.getKind() == Diagnostic.Kind.ERROR)
                .map(ProcessCodeRunner::formatDiagnostic)
                .collect(Collectors.joining("\n"));
        return errors.isEmpty() ? "Compilation failed." : errors;
    }

    private static boolean hasErrors(DiagnosticCollector<JavaFileObject> diagnostics) {
        return diagnostics.getDiagnostics().stream().anyMatch(d -> d.getKind() == Diagnostic.Kind.ERROR);
    }

    /**
     * The program is started as "java Main", so it needs a top-level class Main, outside any package,
     * with a static main(String[]) method. Returns a message for the learner, or null when all is well.
     */
    static String mainProblem(Iterable<? extends Element> declared) {
        TypeElement main = null;
        for (Element e : declared) {
            if (e instanceof TypeElement t && t.getNestingKind() == NestingKind.TOP_LEVEL
                    && t.getSimpleName().contentEquals("Main")) {
                main = t;
            }
        }
        if (main == null) {
            return "Main.java: error: there is no class called Main. Put your program in "
                    + "public class Main { ... } (the class must be called Main).";
        }
        if (main.getEnclosingElement() instanceof PackageElement pkg && !pkg.isUnnamed()) {
            return "Main.java: error: remove the line \"package " + pkg.getQualifiedName()
                    + ";\" at the top. Class Main must not be in a package.";
        }
        boolean hasMain = main.getEnclosedElements().stream()
                .filter(e -> e.getKind() == ElementKind.METHOD && e.getSimpleName().contentEquals("main"))
                .map(ExecutableElement.class::cast)
                .anyMatch(m -> m.getModifiers().contains(Modifier.STATIC) && m.getModifiers().contains(Modifier.PUBLIC)
                        && m.getParameters().size() == 1
                        && m.getParameters().get(0).asType().toString().equals("java.lang.String[]"));
        if (!hasMain) {
            return "Main.java: error: class Main has no public static void main(String[] args) method. "
                    + "Your program starts running there.";
        }
        return null;
    }

    private static String formatDiagnostic(Diagnostic<? extends JavaFileObject> d) {
        String message = d.getMessage(Locale.ENGLISH);
        // NOPOS means javac could not tie the error to a line (rare, e.g. a bad option).
        return d.getLineNumber() == Diagnostic.NOPOS
                ? "Main.java: error: " + message
                : "Main.java:" + d.getLineNumber() + ": error: " + message;
    }

    /** "Main.py:3: error: SyntaxError: invalid syntax" followed by Python's own code excerpt and caret. */
    static String formatPythonSyntaxError(String stderr) {
        List<String> lines = stderr.lines().toList();
        int frame = -1;
        for (int i = 0; i < lines.size(); i++) {
            if (PY_FRAME.matcher(lines.get(i)).find()) {
                frame = i;
            }
        }
        if (frame < 0 || lines.isEmpty()) {
            return stderr.isBlank() ? "Compilation failed." : stderr.strip();
        }
        Matcher m = PY_FRAME.matcher(lines.get(frame));
        m.find();
        String last = lines.get(lines.size() - 1).strip();
        StringBuilder sb = new StringBuilder("Main.py:" + m.group(2) + ": error: " + last);
        for (int i = frame + 1; i < lines.size() - 1; i++) {
            sb.append('\n').append(lines.get(i));
        }
        return sb.toString();
    }

    // ---------------------------------------------------------------- run

    private List<TestOutcome> runAll(Language language, Path workDir, List<RunInput> inputs,
                                     long baseLimitMs, RunListener listener) {
        long limitMs = language.scale(baseLimitMs);
        long deadline = System.nanoTime() + MILLISECONDS.toNanos(language.scale(TOTAL_BUDGET_MS));
        List<TestOutcome> outcomes = new ArrayList<>();
        // Every input gets an outcome, even after a failure, because the UI shows the full test table.
        for (RunInput in : inputs) {
            long remainingMs = NANOSECONDS.toMillis(deadline - System.nanoTime());
            if (remainingMs <= 0) {
                // Budget used up: report as timed out without starting a process, so the list stays complete.
                outcomes.add(new TestOutcome(in.id(), in.tag(), false, true, null, null, 0));
            } else {
                // A test that starts near the end of the budget only gets what is left of it.
                ExecResult r = sandbox.run(language, Sandbox.Stage.EXECUTE, workDir, in.input(),
                        Math.min(limitMs, remainingMs));
                outcomes.add(outcome(language, in, r, workDir));
            }
            listener.testFinished(outcomes.size(), inputs.size());
        }
        return outcomes;
    }

    private static TestOutcome outcome(Language language, RunInput in, ExecResult r, Path workDir) {
        String err = shownStderr(language, r.stderr(), workDir);
        if (r.timedOut()) {
            return new TestOutcome(in.id(), in.tag(), false, true, null, r.stdout(), r.runtimeMs(), err, r.memoryKb());
        }
        if (r.exitCode() != 0) {
            return new TestOutcome(in.id(), in.tag(), false, false, exceptionType(language, r.stderr(), r.exitCode()),
                    r.stdout(), r.runtimeMs(), err, r.memoryKb());
        }
        // A custom input has no expected answer: it "passes" if it ran cleanly.
        boolean passed = in.expectedOutput() == null || normalize(r.stdout()).equals(normalize(in.expectedOutput()));
        return new TestOutcome(in.id(), in.tag(), passed, false, null, r.stdout(), r.runtimeMs(), err, r.memoryKb());
    }

    /** Simple exception name for the error category rules, or "NonZeroExit" when none can be found. */
    static String exceptionType(Language language, String stderr, int exitCode) {
        return switch (language) {
            case JAVA -> exceptionType(stderr);
            case PYTHON -> {
                List<String> lines = stderr.lines().map(String::strip).filter(s -> !s.isEmpty()).toList();
                for (int i = lines.size() - 1; i >= 0; i--) {
                    Matcher m = PY_EXCEPTION.matcher(lines.get(i));
                    if (m.matches()) {
                        String name = m.group(1);
                        yield name.substring(name.lastIndexOf('.') + 1);
                    }
                }
                yield NON_ZERO_EXIT;
            }
        };
    }

    /** Java: simple class name of the thrown exception, or "NonZeroExit" if stderr names none. */
    static String exceptionType(String stderr) {
        Matcher m = UNCAUGHT.matcher(stderr);
        if (!m.find()) {
            m = QUALIFIED_THROWABLE.matcher(stderr);
            if (!m.find()) {
                return NON_ZERO_EXIT;
            }
        }
        String className = m.group(1);
        // Simple name, because CONTRACT.md section 4.2 matches on "ArrayIndexOutOfBoundsException".
        return className.substring(className.lastIndexOf('.') + 1);
    }

    /**
     * stderr as the learner should see it: no server paths, no sandbox frames, no JVM security-manager
     * warnings, and at most a few thousand characters.
     */
    static String shownStderr(Language language, String stderr, Path workDir) {
        if (stderr == null || stderr.isBlank()) {
            return null;
        }
        String s = sanitize(stderr, workDir);
        if (language == Language.JAVA) {
            s = s.lines().filter(l -> !l.startsWith("WARNING: ") || !l.contains("Security Manager"))
                    .collect(Collectors.joining("\n"));
        }
        if (language == Language.PYTHON) {
            s = stripPythonSandboxFrames(s);
        }
        s = s.strip();
        if (s.isEmpty()) {
            return null;
        }
        return s.length() > STDERR_SHOWN_CHARS ? s.substring(0, STDERR_SHOWN_CHARS) + "\n…" : s;
    }

    /** Removes traceback frames that belong to guard.py / runpy, leaving only the learner's own lines. */
    static String stripPythonSandboxFrames(String traceback) {
        List<String> out = new ArrayList<>();
        boolean skipping = false;
        for (String line : traceback.lines().toList()) {
            Matcher m = PY_FRAME.matcher(line);
            if (m.find()) {
                skipping = !m.group(1).endsWith("Main.py");
                if (!skipping) {
                    out.add(line.replace(m.group(1), "Main.py"));
                }
                continue;
            }
            // Code excerpt / caret lines belong to the preceding frame.
            if (skipping && line.startsWith("    ")) {
                continue;
            }
            skipping = false;
            out.add(line);
        }
        return String.join("\n", out);
    }

    /** Never show the server's temp path (or the container mount point) to the learner. */
    static String sanitize(String text, Path workDir) {
        if (text == null) {
            return null;
        }
        String s = text;
        if (workDir != null) {
            String dir = workDir.toAbsolutePath().toString();
            s = s.replace(dir + java.io.File.separator, "").replace(dir, "");
        }
        return s.replace("/work/", "");
    }

    /**
     * CONTRACT.md section 4.1, step 3: strip trailing whitespace from each line, drop trailing
     * empty lines, then compare exactly. A missing final newline or a stray space never fails a learner.
     */
    static String normalize(String text) {
        List<String> lines = new ArrayList<>();
        // stripTrailing also removes '\r', so Windows line endings compare equal to Unix ones.
        for (String line : text.split("\n", -1)) {
            lines.add(line.stripTrailing());
        }
        while (!lines.isEmpty() && lines.get(lines.size() - 1).isEmpty()) {
            lines.remove(lines.size() - 1);
        }
        return String.join("\n", lines);
    }

    private static void deleteQuietly(Path dir) {
        if (dir == null) {
            return;
        }
        // Children first (reverse order), because a directory must be empty before it can be deleted.
        try (Stream<Path> paths = Files.walk(dir)) {
            paths.sorted(Comparator.reverseOrder()).forEach(p -> p.toFile().delete());
        } catch (IOException ignored) {
            // A cleanup failure must not hide the learner's result; the OS clears its temp dir eventually.
        }
    }
}
