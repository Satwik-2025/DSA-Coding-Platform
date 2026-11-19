package com.capstone.dsaplatform.learner;

import com.capstone.dsaplatform.domain.Difficulty;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Pure recommendation scoring. Every term is a 0..1 number with a one-line meaning,
 * so a recommendation can be explained from its reason string alone:
 *
 *   weakness      = (1 + wrong) / (2 + correct + wrong)    smoothed error rate; 0.5 with no data
 *   urgency       = 1 - predicted_retention (0.5 if never attempted)
 *   difficultyFit = 1 - |difficulty - target| / 2
 *   score         = 0.4*weakness + 0.4*urgency + 0.2*difficultyFit
 */
public final class RecommendationScorer {

    // Neutral urgency for an unattempted topic: lets new topics appear without outranking a fading weak one.
    static final double UNKNOWN_URGENCY = 0.5;

    private RecommendationScorer() {
    }

    /** Everything needed to score one problem for one learner. */
    public record Candidate(Long problemId,
                            String title,
                            Long topicId,
                            String topicName,
                            Difficulty difficulty,
                            boolean topicUnlocked,
                            int correctCount,
                            int wrongCount,
                            Double retention,
                            boolean alreadyAccepted,
                            List<String> gatedTopicNames) {
    }

    public record Scored(Candidate candidate, double score, String reason) {
    }

    /** Filters, scores and returns the top `limit`, best first; ties go to the lower problem id. */
    public static List<Scored> rank(List<Candidate> candidates, double minRetention, int limit) {
        return candidates.stream()
                .filter(Candidate::topicUnlocked)
                // A solved problem only comes back once its topic has faded below the unlock threshold.
                .filter(c -> !c.alreadyAccepted() || (c.retention() != null && c.retention() < minRetention))
                .map(c -> new Scored(c, score(c), reason(c, minRetention)))
                .sorted(Comparator.comparingDouble(Scored::score).reversed()
                        .thenComparing(s -> s.candidate().problemId()))
                .limit(limit)
                .toList();
    }

    static double score(Candidate c) {
        Difficulty target = targetDifficulty(c.correctCount());
        return 0.4 * weakness(c.correctCount(), c.wrongCount())
                + 0.4 * urgency(c.retention())
                + 0.2 * difficultyFit(c.difficulty(), target);
    }

    static double weakness(int correct, int wrong) {
        return (1.0 + wrong) / (2.0 + correct + wrong);
    }

    static double urgency(Double retention) {
        return retention == null ? UNKNOWN_URGENCY : 1 - retention;
    }

    /** Step up difficulty only after enough correct answers in the topic. */
    static Difficulty targetDifficulty(int correct) {
        if (correct < 2) {
            return Difficulty.EASY;
        }
        return correct < 5 ? Difficulty.MEDIUM : Difficulty.HARD;
    }

    /** 1 on target, 0.5 one level away, 0 two levels away. */
    static double difficultyFit(Difficulty problem, Difficulty target) {
        return 1 - Math.abs(problem.getWeight() - target.getWeight()) / 2.0;
    }

    /** Why this problem is suggested, in plain words for a beginner (the numbers are the ones used for ranking). */
    static String reason(Candidate c, double minRetention) {
        StringBuilder sb = new StringBuilder();
        if (c.retention() == null) {
            sb.append("You have not tried ").append(c.topicName()).append(" yet.");
        } else {
            sb.append(String.format(Locale.ROOT, "Your memory score in %s is %d%% (%d solved, %d wrong).",
                    c.topicName(), Math.round(c.retention() * 100), c.correctCount(), c.wrongCount()));
        }
        if (c.alreadyAccepted()) {
            sb.append(String.format(Locale.ROOT,
                    " You solved this one before, but your memory score is under %d%%, so solving it again will refresh it.",
                    Math.round(minRetention * 100)));
        }
        Difficulty target = targetDifficulty(c.correctCount());
        if (c.difficulty() == target) {
            sb.append(' ').append(level(c.difficulty())).append(" problems are the right level for you here.");
        } else {
            sb.append(' ').append(level(target)).append(" problems suit you best here right now; this one is ")
                    .append(level(c.difficulty()).toLowerCase(Locale.ROOT)).append('.');
        }
        if (!c.gatedTopicNames().isEmpty()) {
            sb.append(" Getting good at ").append(c.topicName()).append(" opens up ")
                    .append(joinNames(c.gatedTopicNames())).append('.');
        }
        return sb.toString();
    }

    private static String level(Difficulty d) {
        return switch (d) {
            case EASY -> "Easy";
            case MEDIUM -> "Medium";
            case HARD -> "Hard";
        };
    }

    // "A", "A and B", "A, B and C"
    private static String joinNames(List<String> names) {
        if (names.size() == 1) {
            return names.get(0);
        }
        return String.join(", ", names.subList(0, names.size() - 1)) + " and " + names.get(names.size() - 1);
    }
}
