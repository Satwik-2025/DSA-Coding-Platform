package com.capstone.dsaplatform.dto;

import com.capstone.dsaplatform.domain.ErrorCategory;
import com.capstone.dsaplatform.domain.TestTag;
import com.capstone.dsaplatform.domain.Verdict;

import java.time.Instant;
import java.util.List;

/** Request/response of POST /api/submissions (CONTRACT.md section 5.1). Field order = JSON order. */
public final class SubmissionDtos {

    private SubmissionDtos() {
    }

    // language: JAVA (default when omitted) or PYTHON.
    public record SubmissionRequest(Long userId, Long problemId, String code, Integer timeSpentSeconds, String language) {
    }

    // input / expectedOutput / actualOutput are null for hidden tags so hidden tests never leak.
    public record FailedTestView(Long testCaseId, TestTag tag, Integer ordinal,
                                 String input, String expectedOutput, String actualOutput) {
    }

    // memoryKb is null unless the sandbox can measure it (Docker sandbox).
    public record TestResultView(Integer ordinal, TestTag tag, Verdict verdict, long runtimeMs, Integer memoryKb) {
    }

    public record SubmissionResponse(Long attemptId,
                                     Long userId,
                                     Long problemId,
                                     Long topicId,
                                     Verdict verdict,
                                     int passedCount,
                                     int totalCount,
                                     ErrorCategory errorCategory,
                                     FailedTestView failedTest,
                                     String message,
                                     Integer largeRuntimeMs,
                                     Integer optimalRuntimeMs,
                                     List<TestResultView> testResults,
                                     List<ResourceLink> resources,
                                     Instant submittedAt,
                                     String language,
                                     // Ordered from a gentle nudge to a concrete pointer; empty when accepted.
                                     List<String> hints,
                                     // "Faster than X% of accepted submissions in this language"; null without peers.
                                     Integer runtimePercentile,
                                     Integer maxMemoryKb) {
    }

    /** One past attempt, newest first, for the problem page's Submissions tab. */
    public record HistoryItem(Long attemptId, Verdict verdict, int passedCount, int totalCount, String language,
                              Integer largeRuntimeMs, Instant submittedAt, String code) {
    }
}
