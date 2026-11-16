package com.capstone.dsaplatform.runner;

import static java.nio.charset.StandardCharsets.UTF_8;
import static java.util.concurrent.TimeUnit.MILLISECONDS;
import static java.util.concurrent.TimeUnit.NANOSECONDS;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.UncheckedIOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

/** Starts a child process with stdin, a time limit and capped output, and always cleans it up. */
final class ProcessExec {

    // Enough for any expected DSA output (largest seeded LARGE test prints ~380 KB);
    // stops a print-in-a-loop bug from filling the server's memory.
    static final int OUTPUT_CAP_BYTES = 1024 * 1024;
    static final int STDERR_CAP_BYTES = 64 * 1024;

    private ProcessExec() {
    }

    /** env == null inherits this process's environment; otherwise the child sees exactly env. */
    static ExecResult run(List<String> command, Path workDir, Map<String, String> env, String stdin, long limitMs) {
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(workDir.toFile());
        if (env != null) {
            builder.environment().clear();
            builder.environment().putAll(env);
        }

        long start = System.nanoTime();
        Process process;
        try {
            process = builder.start();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not start " + command.get(0), e);
        }

        // Stdin and both outputs each get their own thread. Pipes have a small OS buffer: if we wrote
        // all of stdin before reading stdout, a program that prints while reading could block forever.
        StreamCollector stdout = new StreamCollector(process.getInputStream(), OUTPUT_CAP_BYTES);
        StreamCollector stderr = new StreamCollector(process.getErrorStream(), STDERR_CAP_BYTES);
        Thread feeder = feedStdin(process, stdin == null ? "" : stdin);

        try {
            boolean finished = process.waitFor(limitMs, MILLISECONDS);
            long runtimeMs = NANOSECONDS.toMillis(System.nanoTime() - start);
            if (!finished) {
                killTree(process);
                // Wait until it is really dead: Windows will not delete files a live process is using.
                process.waitFor();
            }
            // The process is dead now, so its pipes are closed and these threads end promptly.
            feeder.join(1000);
            return new ExecResult(finished ? process.exitValue() : -1, stdout.text(), stderr.text(),
                    !finished, runtimeMs, null);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Interrupted while running a test", e);
        } finally {
            // Covers every exit path, so no child (or grandchild it spawned) is ever left running.
            if (process.isAlive()) {
                killTree(process);
            }
        }
    }

    static void killTree(Process process) {
        process.descendants().forEach(ProcessHandle::destroyForcibly);
        process.destroyForcibly();
    }

    private static Thread feedStdin(Process process, String input) {
        Thread feeder = new Thread(() -> {
            try (OutputStream stdin = process.getOutputStream()) {
                stdin.write(input.getBytes(UTF_8));
            } catch (IOException ignored) {
                // The program exited or was killed before reading all its input. That is reflected in
                // its own outcome; it is not a runner failure.
            }
        }, "runner-stdin");
        // Daemon so a stuck thread can never keep the backend from shutting down.
        feeder.setDaemon(true);
        feeder.start();
        return feeder;
    }

    /** Reads a process stream on its own thread, keeping at most cap bytes. */
    private static final class StreamCollector {
        private final ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        private final Thread thread;
        private final int cap;

        StreamCollector(InputStream in, int cap) {
            this.cap = cap;
            thread = new Thread(() -> drain(in), "runner-drain");
            thread.setDaemon(true);
            thread.start();
        }

        private void drain(InputStream in) {
            byte[] chunk = new byte[8192];
            try (in) {
                int n;
                while ((n = in.read(chunk)) != -1) {
                    int room = cap - buffer.size();
                    // Keep reading past the cap and discard the rest. If we stopped reading, a program that
                    // prints a lot would block on a full pipe and be wrongly reported as timed out.
                    if (room > 0) {
                        buffer.write(chunk, 0, Math.min(n, room));
                    }
                }
            } catch (IOException ignored) {
                // The stream closes when the process is killed; whatever was read so far is kept.
            }
        }

        String text() throws InterruptedException {
            thread.join(1000);
            return buffer.toString(UTF_8);
        }
    }
}
