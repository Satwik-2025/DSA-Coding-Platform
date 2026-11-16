package com.capstone.dsaplatform.dto;

import java.util.List;

/** POST /api/run: run code against the samples or a custom input without recording an attempt. */
public final class RunDtos {

    private RunDtos() {
    }

    // input == null runs the problem's sample tests; otherwise only the given input.
    public record RunRequest(Long userId, Long problemId, String code, String language, String input) {
    }

    // kind: SAMPLE or CUSTOM. status: ACCEPTED / WRONG_ANSWER for samples, OK for a custom input that ran,
    // RUNTIME_ERROR or TIME_LIMIT_EXCEEDED for either. expectedOutput is null for custom input.
    public record RunCase(int ordinal, String kind, String input, String expectedOutput, String actualOutput,
                          String status, String exceptionType, long runtimeMs, Integer memoryKb, String stderr) {
    }

    public record RunResponse(String language, boolean compiled, String compileError, List<RunCase> cases) {
    }

    public record LanguageView(String id, String name, boolean available, double timeFactor) {
    }

    public record LanguagesResponse(String sandbox, List<LanguageView> languages) {
    }
}
