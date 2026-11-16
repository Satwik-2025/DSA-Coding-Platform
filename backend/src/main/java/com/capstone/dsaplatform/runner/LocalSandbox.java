package com.capstone.dsaplatform.runner;

import static java.nio.charset.StandardCharsets.UTF_8;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Child processes on this machine, hardened as far as a portable process can be:
 * - Java runs under a security manager with a deny-everything policy (no files, network or exec).
 * - Python runs in isolated mode under an audit hook (python_guard.py) with the same restrictions.
 * - Every process gets an empty environment (no secrets leak through env vars), a private temp
 *   directory, capped output, a hard time limit, and is killed together with any children it spawned.
 * - Native code (C++) cannot be contained this way, so it is refused unless
 *   app.runner.allow-unsandboxed-native=true. Use the Docker sandbox for C++.
 */
public class LocalSandbox implements Sandbox {

    private static final Logger log = LoggerFactory.getLogger(LocalSandbox.class);

    static final String PYTHON_CHECK = "import sys\n"
            + "compile(open(sys.argv[1], encoding='utf-8').read(), 'Main.py', 'exec')\n";

    private static final boolean WINDOWS = System.getProperty("os.name").toLowerCase(Locale.ROOT).contains("win");

    private final String javaExecutable;
    private final boolean securityManager;
    private final String pythonExecutable; // null when no Python 3.8+ was found
    private final String cppExecutable;    // null when C++ is not offered
    private final String guardSource;
    private final String policySource;

    public LocalSandbox(RunnerSettings settings) {
        this.javaExecutable = Path.of(System.getProperty("java.home"), "bin", "java").toString();
        // The security manager was removed in JDK 24; on newer JDKs Java runs without it.
        boolean smSupported = Runtime.version().feature() < 24;
        this.securityManager = settings.javaSecurityManager && smSupported;
        if (settings.javaSecurityManager && !smSupported) {
            log.warn("JDK {} has no security manager: Java submissions run without it. Use app.runner.sandbox=docker.",
                    Runtime.version().feature());
        }
        this.pythonExecutable = findPython(settings.pythonCommand);
        if (pythonExecutable == null) {
            log.warn("No Python 3.8+ found: Python submissions are disabled.");
        }
        String gpp = findOnPath(settings.cppCommand);
        if (gpp != null && !settings.allowUnsandboxedNative) {
            log.info("C++ is disabled in the local sandbox (native code cannot be contained). "
                    + "Use app.runner.sandbox=docker, or set app.runner.allow-unsandboxed-native=true for trusted use.");
        }
        this.cppExecutable = settings.allowUnsandboxedNative ? gpp : null;
        this.guardSource = resource("/runner/python_guard.py");
        this.policySource = resource("/runner/java_sandbox.policy");
    }

    @Override
    public String name() {
        return "local";
    }

    @Override
    public boolean isolatesNativeCode() {
        return false;
    }

    @Override
    public boolean supports(Language language) {
        return switch (language) {
            case JAVA -> true;
            case PYTHON -> pythonExecutable != null;
            case CPP -> cppExecutable != null;
        };
    }

    boolean javaSecurityManagerEnabled() {
        return securityManager;
    }

    @Override
    public ExecResult run(Language language, Stage stage, Path workDir, String stdin, long timeLimitMs) {
        List<String> command = new ArrayList<>();
        switch (language) {
            case JAVA -> {
                if (stage == Stage.COMPILE) {
                    throw new IllegalArgumentException("Java is compiled in-process");
                }
                command.add(javaExecutable);
                // -Xmx stops one submission from taking the server's memory; -Xss allows deep recursion (DFS).
                command.addAll(List.of("-Xmx256m", "-Xss64m", "-XX:+UseSerialGC"));
                if (securityManager) {
                    Path policy = write(workDir.resolve("sandbox.policy"), policySource);
                    // "==" means: use only this policy, ignore the JDK's default grants.
                    command.add("-Djava.security.manager");
                    command.add("-Djava.security.policy==" + policy);
                }
                command.addAll(List.of("-cp", workDir.toString(), "Main"));
            }
            case PYTHON -> {
                // -I isolated (ignores PYTHON* env vars and the user site), -S no site, -B no .pyc files,
                // -X utf8 so stdout is UTF-8 on every OS.
                command.addAll(List.of(pythonExecutable, "-I", "-S", "-B", "-X", "utf8"));
                if (stage == Stage.COMPILE) {
                    command.addAll(List.of("-c", PYTHON_CHECK, "Main.py"));
                } else {
                    write(workDir.resolve("guard.py"), guardSource);
                    command.addAll(List.of("guard.py", "Main.py"));
                }
            }
            case CPP -> {
                if (cppExecutable == null) {
                    throw new IllegalStateException("C++ is not available in the local sandbox");
                }
                String exe = WINDOWS ? "main.exe" : "main";
                if (stage == Stage.COMPILE) {
                    command.addAll(List.of(cppExecutable, "-std=c++17", "-O2", "-pipe", "-o", exe, "main.cpp"));
                } else {
                    command.add(workDir.resolve(exe).toString());
                }
            }
        }
        return ProcessExec.run(command, workDir, environment(workDir, language), stdin, timeLimitMs);
    }

    /** The child sees only what it needs to start: no tokens, credentials or user paths from our env. */
    private Map<String, String> environment(Path workDir, Language language) {
        Map<String, String> env = new HashMap<>();
        if (WINDOWS) {
            // Windows programs cannot start without SystemRoot; nothing else is passed through.
            String systemRoot = System.getenv().getOrDefault("SystemRoot", "C:\\Windows");
            env.put("SystemRoot", systemRoot);
            env.put("PATH", systemRoot + "\\System32");
        } else {
            env.put("PATH", "/usr/local/bin:/usr/bin:/bin");
            env.put("LANG", "C.UTF-8");
        }
        if (language == Language.CPP && cppExecutable != null) {
            // The compiler driver finds its helper programs (and MinGW its DLLs) next to itself.
            Path dir = Path.of(cppExecutable).getParent();
            if (dir != null) {
                env.put("PATH", dir + (WINDOWS ? ";" : ":") + env.get("PATH"));
            }
        }
        env.put("TEMP", workDir.toString());
        env.put("TMP", workDir.toString());
        env.put("TMPDIR", workDir.toString());
        env.put("HOME", workDir.toString());
        return env;
    }

    /** Resolves Python to an absolute path once, so a cleared PATH in the child does not matter. */
    private static String findPython(String configured) {
        List<String> candidates = configured == null || configured.isBlank()
                ? List.of("python3", "python")
                : List.of(configured);
        for (String candidate : candidates) {
            try {
                Process p = new ProcessBuilder(candidate, "-c",
                        "import sys; print(sys.executable if sys.version_info >= (3, 8) else '')")
                        .redirectErrorStream(true).start();
                if (!p.waitFor(10, TimeUnit.SECONDS)) {
                    p.destroyForcibly();
                    continue;
                }
                String out = new String(p.getInputStream().readAllBytes(), UTF_8).trim();
                if (p.exitValue() == 0 && !out.isEmpty() && Files.isRegularFile(Path.of(out))) {
                    return out;
                }
            } catch (IOException e) {
                // Not installed under this name; try the next one.
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return null;
            }
        }
        return null;
    }

    static String findOnPath(String command) {
        if (command == null || command.isBlank()) {
            return null;
        }
        Path direct = Path.of(command);
        if (direct.isAbsolute()) {
            return Files.isRegularFile(direct) ? direct.toString() : null;
        }
        String path = System.getenv("PATH");
        if (path == null) {
            return null;
        }
        for (String dir : path.split(java.io.File.pathSeparator)) {
            for (String name : WINDOWS ? List.of(command + ".exe", command) : List.of(command)) {
                Path p = Path.of(dir, name);
                if (Files.isRegularFile(p)) {
                    return p.toString();
                }
            }
        }
        return null;
    }

    private static Path write(Path file, String content) {
        try {
            return Files.writeString(file, content, UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not prepare the sandbox", e);
        }
    }

    static String resource(String name) {
        try (InputStream in = LocalSandbox.class.getResourceAsStream(name)) {
            if (in == null) {
                throw new IllegalStateException("Missing resource " + name);
            }
            return new String(in.readAllBytes(), UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
