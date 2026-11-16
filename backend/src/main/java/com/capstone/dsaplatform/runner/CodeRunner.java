package com.capstone.dsaplatform.runner;

import com.capstone.dsaplatform.entity.Problem;
import java.util.List;
import java.util.Set;

/**
 * Compiles and runs one submission against a list of inputs. An interface so the submission
 * pipeline does not care which sandbox (local hardened processes or Docker containers) runs it.
 */
public interface CodeRunner {

    /** Java against every test of the problem, in first-failure order (the original contract). */
    RunResult run(Problem problem, String code);

    RunResult run(Language language, String code, List<RunInput> inputs, long timeLimitMs, RunListener listener);

    /** All tests of a problem, sorted SAMPLE -> EDGE -> BOUNDARY -> LARGE, then by ordinal. */
    List<RunInput> testsFor(Long problemId);

    Set<Language> availableLanguages();

    String sandboxName();
}
