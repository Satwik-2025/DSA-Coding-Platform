package com.capstone.dsaplatform.runner;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.PosixFilePermissions;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * One throw-away container per compile / test run:
 * --network none, --read-only root filesystem, a small writable /tmp, memory + swap cap,
 * CPU cap, process-count cap, all Linux capabilities dropped, no privilege escalation, and an
 * unprivileged user. The submission folder is mounted read-only (read-write only while C++ compiles).
 *
 * Timing is measured inside the container by a tiny shell wrapper (so container start-up is not
 * counted against the learner), which also reports the cgroup's peak memory where available.
 * The backend must run on a host where `docker` works and can bind-mount the system temp dir.
 */
public class DockerSandbox implements Sandbox {

    // start / stop timestamps and peak memory are printed on stderr after the program ends.
    static final String WRAPPER = "start=$(date +%s%N); timeout -k 1 \"$LIMIT\" \"$@\"; code=$?; "
            + "end=$(date +%s%N); mem=$(cat /sys/fs/cgroup/memory.peak 2>/dev/null || echo 0); "
            + "echo \"__SANDBOX__ $code $((end-start)) $mem\" >&2; exit $code";

    private static final Pattern MARKER = Pattern.compile("(?m)^__SANDBOX__ (\\d+) (\\d+) (\\d+)\\s*$");

    private final RunnerSettings settings;

    public DockerSandbox(RunnerSettings settings) {
        this.settings = settings;
    }

    @Override
    public String name() {
        return "docker";
    }

    @Override
    public boolean isolatesNativeCode() {
        return true;
    }

    @Override
    public boolean supports(Language language) {
        return true;
    }

    @Override
    public ExecResult run(Language language, Stage stage, Path workDir, String stdin, long timeLimitMs) {
        String container = "dsa-run-" + UUID.randomUUID();
        List<String> command = command(language, stage, workDir, container, timeLimitMs);
        openPermissions(workDir, stage == Stage.COMPILE && language == Language.CPP);

        // The outer limit adds start-up time; the inner `timeout` enforces the learner's real limit.
        ExecResult outer = ProcessExec.run(command, workDir, null, stdin,
                timeLimitMs + settings.dockerStartupAllowanceMs);
        if (outer.timedOut()) {
            // Killing the docker CLI does not stop the container, so stop it by name.
            kill(container);
            return new ExecResult(-1, outer.stdout(), outer.stderr(), true, timeLimitMs, null);
        }
        return parse(outer, timeLimitMs);
    }

    /** The full `docker run` command line; package-private so tests can check every isolation flag. */
    List<String> command(Language language, Stage stage, Path workDir, String container, long timeLimitMs) {
        boolean writable = stage == Stage.COMPILE && language == Language.CPP;
        List<String> c = new ArrayList<>(List.of(
                settings.dockerCommand, "run", "--rm", "-i", "--name", container,
                "--network", "none",
                "--read-only", "--tmpfs", "/tmp:rw,size=64m",
                "--memory", settings.dockerMemory, "--memory-swap", settings.dockerMemory,
                "--cpus", settings.dockerCpus,
                "--pids-limit", String.valueOf(settings.dockerPids),
                "--cap-drop", "ALL", "--security-opt", "no-new-privileges",
                "--user", "65534:65534",
                "-e", "LIMIT=" + String.format(Locale.ROOT, "%.3fs", timeLimitMs / 1000.0),
                "-v", workDir.toAbsolutePath() + ":/work:" + (writable ? "rw" : "ro"),
                "-w", "/work",
                image(language),
                "sh", "-c", WRAPPER, "sh"));
        c.addAll(inner(language, stage));
        return c;
    }

    private String image(Language language) {
        return switch (language) {
            case JAVA -> settings.dockerJavaImage;
            case PYTHON -> settings.dockerPythonImage;
            case CPP -> settings.dockerCppImage;
        };
    }

    private static List<String> inner(Language language, Stage stage) {
        return switch (language) {
            case JAVA -> List.of("java", "-Xmx256m", "-Xss64m", "-XX:+UseSerialGC", "-cp", "/work", "Main");
            case PYTHON -> stage == Stage.COMPILE
                    ? List.of("python3", "-I", "-S", "-B", "-X", "utf8", "-c", LocalSandbox.PYTHON_CHECK, "/work/Main.py")
                    : List.of("python3", "-I", "-S", "-B", "-X", "utf8", "/work/Main.py");
            case CPP -> stage == Stage.COMPILE
                    ? List.of("g++", "-std=c++17", "-O2", "-pipe", "-o", "/work/main", "/work/main.cpp")
                    : List.of("/work/main");
        };
    }

    /** Reads the wrapper's marker line (exit code, runtime, peak memory) and removes it from stderr. */
    static ExecResult parse(ExecResult outer, long timeLimitMs) {
        Matcher m = MARKER.matcher(outer.stderr());
        if (!m.find()) {
            // The container never ran the wrapper (e.g. image missing): report what docker said.
            return outer;
        }
        int code = Integer.parseInt(m.group(1));
        long runtimeMs = Long.parseLong(m.group(2)) / 1_000_000;
        long memBytes = Long.parseLong(m.group(3));
        String stderr = MARKER.matcher(outer.stderr()).replaceAll("").stripTrailing();
        // `timeout` exits with 124 when the limit hits (137 if it had to SIGKILL).
        boolean timedOut = code == 124 || (code == 137 && runtimeMs >= timeLimitMs);
        Integer memoryKb = memBytes > 0 ? (int) (memBytes / 1024) : null;
        return new ExecResult(code, outer.stdout(), stderr, timedOut, Math.min(runtimeMs, timeLimitMs), memoryKb);
    }

    private void kill(String container) {
        try {
            Process p = new ProcessBuilder(settings.dockerCommand, "kill", container).start();
            p.waitFor(10, TimeUnit.SECONDS);
        } catch (IOException e) {
            // Best effort: --rm removes the container once it stops anyway.
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    /** The container runs as "nobody", so the bind-mounted folder must be readable (and writable to build C++). */
    private static void openPermissions(Path workDir, boolean writable) {
        try (Stream<Path> paths = Files.walk(workDir)) {
            paths.forEach(p -> {
                try {
                    // Execute bit on files too: the compiled C++ binary must stay runnable.
                    String perms = writable ? "rwxrwxrwx" : "rwxr-xr-x";
                    Files.setPosixFilePermissions(p, PosixFilePermissions.fromString(perms));
                } catch (UnsupportedOperationException | IOException ignored) {
                    // Non-POSIX file system (Windows host): Docker Desktop handles access itself.
                }
            });
        } catch (IOException ignored) {
            // Permission tweaks are best effort; a failure surfaces as a runtime error in the run.
        }
    }
}
