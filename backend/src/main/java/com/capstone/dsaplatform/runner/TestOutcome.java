package com.capstone.dsaplatform.runner;

import com.capstone.dsaplatform.domain.TestTag;

/**
 * Raw result of one test process. The runner reports facts only; turning them into a
 * Verdict and an ErrorCategory is SubmissionEvaluator's job (CONTRACT.md sections 4.1 and 4.2).
 * stderr (trimmed, paths removed) is only shown for sample and custom runs; memoryKb is null when
 * the sandbox cannot measure memory.
 */
public record TestOutcome(Long testCaseId, TestTag tag, boolean passed,
                          boolean timedOut, String exceptionType, String actualOutput,
                          long runtimeMs, String stderr, Integer memoryKb) {

    /** The original shape, used where stderr and memory are not needed. */
    public TestOutcome(Long testCaseId, TestTag tag, boolean passed, boolean timedOut,
                       String exceptionType, String actualOutput, long runtimeMs) {
        this(testCaseId, tag, passed, timedOut, exceptionType, actualOutput, runtimeMs, null, null);
    }
}
