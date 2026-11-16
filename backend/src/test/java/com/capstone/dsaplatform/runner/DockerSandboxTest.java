package com.capstone.dsaplatform.runner;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import java.util.List;
import org.junit.jupiter.api.Test;

/** No Docker needed: checks the isolation flags and the wrapper's timing / memory marker parsing. */
class DockerSandboxTest {

    private final DockerSandbox sandbox = new DockerSandbox(RunnerSettings.defaults());

    @Test
    void everyRunIsLockedDown() {
        List<String> cmd = sandbox.command(Language.PYTHON, Sandbox.Stage.EXECUTE, Path.of("/tmp/x"), "c1", 2000);

        assertTrue(contains(cmd, "--network", "none"), "no network");
        assertTrue(cmd.contains("--read-only"), "read-only root fs");
        assertTrue(contains(cmd, "--cap-drop", "ALL"), "no capabilities");
        assertTrue(contains(cmd, "--security-opt", "no-new-privileges"));
        assertTrue(contains(cmd, "--pids-limit", "64"), "fork bombs are capped");
        assertTrue(contains(cmd, "--memory", "256m") && contains(cmd, "--memory-swap", "256m"));
        assertTrue(contains(cmd, "--user", "65534:65534"), "unprivileged user");
        assertTrue(cmd.stream().anyMatch(s -> s.endsWith(":/work:ro")), "code mounted read-only");
        assertTrue(contains(cmd, "-e", "LIMIT=2.000s"));
        assertEquals("/work/Main.py", cmd.get(cmd.size() - 1));
    }

    @Test
    void onlyTheCppBuildGetsAWritableMount() {
        List<String> build = sandbox.command(Language.CPP, Sandbox.Stage.COMPILE, Path.of("/tmp/x"), "c2", 20000);
        List<String> run = sandbox.command(Language.CPP, Sandbox.Stage.EXECUTE, Path.of("/tmp/x"), "c3", 2000);

        assertTrue(build.stream().anyMatch(s -> s.endsWith(":/work:rw")));
        assertTrue(run.stream().anyMatch(s -> s.endsWith(":/work:ro")));
        assertEquals("/work/main", run.get(run.size() - 1));
    }

    @Test
    void markerGivesInContainerRuntimeAndPeakMemory() {
        ExecResult outer = new ExecResult(0, "6\n", "debug line\n__SANDBOX__ 0 123456789 52428800\n", false, 900, null);

        ExecResult r = DockerSandbox.parse(outer, 2000);

        assertEquals(0, r.exitCode());
        assertEquals(123, r.runtimeMs());
        assertEquals(51200, r.memoryKb());
        assertEquals("debug line", r.stderr());
        assertFalse(r.timedOut());
    }

    @Test
    void timeoutExitCodeMeansTimeLimitExceeded() {
        ExecResult r = DockerSandbox.parse(new ExecResult(124, "", "__SANDBOX__ 124 2001000000 0\n", false, 2500, null), 2000);

        assertTrue(r.timedOut());
        assertNull(r.memoryKb());
    }

    private static boolean contains(List<String> cmd, String flag, String value) {
        int i = cmd.indexOf(flag);
        return i >= 0 && i + 1 < cmd.size() && cmd.get(i + 1).equals(value);
    }
}
