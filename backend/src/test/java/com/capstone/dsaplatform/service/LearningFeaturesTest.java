package com.capstone.dsaplatform.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.capstone.dsaplatform.domain.Difficulty;
import com.capstone.dsaplatform.domain.Verdict;
import com.capstone.dsaplatform.learner.HlrPredictor;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class LearningFeaturesTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 11, 16);

    @Test
    void streakCountsBackFromTodayOrYesterday() {
        Set<LocalDate> days = Set.of(TODAY.minusDays(1), TODAY.minusDays(2), TODAY.minusDays(3), TODAY.minusDays(7));
        assertEquals(3, LearningService.currentStreak(days, TODAY), "still alive: last practice was yesterday");
        assertEquals(0, LearningService.currentStreak(Set.of(TODAY.minusDays(2)), TODAY), "broken by a missed day");
        assertEquals(1, LearningService.currentStreak(Set.of(TODAY), TODAY));
    }

    @Test
    void longestStreakFindsTheLongestRun() {
        Set<LocalDate> days = Set.of(TODAY, TODAY.minusDays(5), TODAY.minusDays(6), TODAY.minusDays(7), TODAY.minusDays(10));
        assertEquals(3, LearningService.longestStreak(days));
        assertEquals(0, LearningService.longestStreak(Set.of()));
    }

    @Test
    void confidenceGrowsWithEvidence() {
        assertEquals(null, HlrPredictor.confidence(0, 0));
        assertEquals("LOW", HlrPredictor.confidence(1, 1));
        assertEquals("MEDIUM", HlrPredictor.confidence(3, 2));
        assertEquals("HIGH", HlrPredictor.confidence(6, 2));
    }

    @Test
    void trainingRowsUseFeaturesFromBeforeEachAttempt() {
        LocalDateTime t0 = LocalDateTime.of(2026, 11, 1, 10, 0);
        List<Object[]> rows = List.of(
                new Object[]{1L, 3L, Difficulty.EASY, Verdict.WRONG_ANSWER, t0},
                new Object[]{1L, 3L, Difficulty.MEDIUM, Verdict.ACCEPTED, t0.plusDays(2)},
                new Object[]{1L, 3L, Difficulty.EASY, Verdict.ACCEPTED, t0.plusDays(3)},
                // new topic: history starts over, so its first attempt produces no row
                new Object[]{1L, 4L, Difficulty.EASY, Verdict.ACCEPTED, t0.plusDays(3)});

        String[] lines = TrainingExportService.toCsv(rows).split("\n");

        assertEquals(TrainingExportService.HEADER, lines[0]);
        assertEquals(3, lines.length, "two rows: the 2nd and 3rd attempt in topic 3");
        String[] first = lines[1].split(",");
        assertEquals("2.000000", first[2], "days since the previous attempt");
        assertEquals("0", first[3]);
        assertEquals("1", first[4], "one wrong attempt before");
        assertEquals("1", first[6], "this attempt was accepted");
        String[] second = lines[2].split(",");
        assertEquals("1", second[3]);
        assertEquals("1", second[4]);
        assertEquals("1.5000", second[5], "mean of EASY (1) and MEDIUM (2)");
    }
}
