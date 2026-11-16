package com.capstone.dsaplatform.dto;

import com.capstone.dsaplatform.domain.Difficulty;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Review queue, activity heatmap, problem status, study plans and model info. */
public final class LearningDtos {

    private LearningDtos() {
    }

    public record ProblemRef(Long id, String title, Difficulty difficulty) {
    }

    // status DUE: retention already below the unlock threshold; SOON: drops below it within the horizon.
    public record ReviewItem(Long topicId, String name, String status, Double predictedRetention, Double halfLifeDays,
                             Double dueInDays, String confidence, ProblemRef suggestedProblem) {
    }

    public record ReviewResponse(Long userId, Instant computedAt, double minRetention, int horizonDays,
                                 List<ReviewItem> items) {
    }

    public record ActivityDay(LocalDate date, int submissions, int accepted) {
    }

    // Days are UTC calendar days, oldest first; days without activity are included with zeros.
    public record ActivityResponse(Long userId, int currentStreak, int longestStreak, int activeDays,
                                   int totalSubmissions, List<ActivityDay> days) {
    }

    // status: SOLVED (at least one accepted attempt) or ATTEMPTED; problems never tried are omitted.
    public record ProblemStatusView(Long problemId, String status, long attempts, Instant lastSubmittedAt) {
    }

    public record PlanItem(Long problemId, String title, String topicName, Difficulty difficulty, String status) {
    }

    public record StudyPlanView(Long id, String slug, String title, String description, int total, int solved,
                                List<PlanItem> items) {
    }

    public record ModelInfo(String modelVersion, String dataSource, String split, boolean placeholder,
                            List<String> featureOrder, Map<String, Object> metrics) {
    }
}
