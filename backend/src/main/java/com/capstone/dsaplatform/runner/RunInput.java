package com.capstone.dsaplatform.runner;

import com.capstone.dsaplatform.domain.TestTag;
import com.capstone.dsaplatform.entity.TestCase;

/**
 * One input to run. id / tag / expectedOutput are null for a learner's custom input, which has
 * no expected answer (only its output is shown).
 */
public record RunInput(Long id, TestTag tag, Integer ordinal, String input, String expectedOutput) {

    public static RunInput of(TestCase tc) {
        return new RunInput(tc.getId(), tc.getTag(), tc.getOrdinal(), tc.getInput(), tc.getExpectedOutput());
    }

    public static RunInput custom(String input) {
        return new RunInput(null, null, 1, input == null ? "" : input, null);
    }
}
