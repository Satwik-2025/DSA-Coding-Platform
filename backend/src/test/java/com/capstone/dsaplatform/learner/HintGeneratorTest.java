package com.capstone.dsaplatform.learner;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.capstone.dsaplatform.domain.ErrorCategory;
import com.capstone.dsaplatform.domain.TestTag;
import java.util.List;
import org.junit.jupiter.api.Test;

class HintGeneratorTest {

    @Test
    void acceptedSubmissionsGetNoHints() {
        assertEquals(List.of(), HintGenerator.hints(null, 1L, null, null, "JAVA", null));
    }

    @Test
    void compileHintPointsAtTheFirstErrorLine() {
        List<String> hints = HintGenerator.hints(ErrorCategory.SYNTAX_COMPILATION, 1L, null, null, "JAVA",
                "Main.java:7: error: ';' expected\nMain.java:9: error: ...");
        assertTrue(hints.get(0).contains("line 7"), hints.get(0));
    }

    @Test
    void exceptionSpecificHintComesFirst() {
        List<String> hints = HintGenerator.hints(ErrorCategory.MISSED_EDGE_CASE, 6L, TestTag.EDGE,
                "NullPointerException", "JAVA", null);
        assertTrue(hints.get(0).contains("NullPointerException"));
        assertTrue(hints.stream().anyMatch(h -> h.contains("head is null")), "linked-list edge cases");
    }

    @Test
    void dpWordingOnlyForTheDpTopic() {
        List<String> dp = HintGenerator.hints(ErrorCategory.STATE_TRANSITION, 10L, TestTag.SAMPLE, null, "JAVA", null);
        List<String> window = HintGenerator.hints(ErrorCategory.STATE_TRANSITION, 4L, TestTag.SAMPLE, null, "JAVA", null);
        assertTrue(dp.get(0).contains("dp[i]"));
        assertFalse(window.stream().anyMatch(h -> h.contains("dp[i]")), window.toString());
    }

    @Test
    void pythonGetsAFastInputTipWhenTooSlow() {
        List<String> hints = HintGenerator.hints(ErrorCategory.BAD_COMPLEXITY, 5L, TestTag.LARGE, null, "PYTHON", null);
        assertTrue(hints.stream().anyMatch(h -> h.contains("sys.stdin")));
    }
}
