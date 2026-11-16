package com.capstone.dsaplatform.service;

import com.capstone.dsaplatform.domain.Verdict;
import com.capstone.dsaplatform.dto.LearningDtos.ActivityDay;
import com.capstone.dsaplatform.dto.LearningDtos.ActivityResponse;
import com.capstone.dsaplatform.dto.LearningDtos.ModelInfo;
import com.capstone.dsaplatform.dto.LearningDtos.ProblemRef;
import com.capstone.dsaplatform.dto.LearningDtos.ProblemStatusView;
import com.capstone.dsaplatform.dto.LearningDtos.ReviewItem;
import com.capstone.dsaplatform.dto.LearningDtos.ReviewResponse;
import com.capstone.dsaplatform.entity.Problem;
import com.capstone.dsaplatform.error.BadRequestException;
import com.capstone.dsaplatform.learner.HlrPredictor;
import com.capstone.dsaplatform.learner.UnlockRule;
import com.capstone.dsaplatform.repository.AttemptRepository;
import com.capstone.dsaplatform.repository.ProblemRepository;
import com.capstone.dsaplatform.service.TopicStatusService.TopicStatus;
import com.capstone.dsaplatform.support.Rounding;
import com.capstone.dsaplatform.support.Times;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/**
 * Learner-facing features built on the existing model: the spaced-repetition review queue,
 * the activity heatmap with streaks, per-problem status, and what the shipped model is.
 */
@Service
public class LearningService {

    private final UserService userService;
    private final TopicStatusService topicStatusService;
    private final UnlockRule unlockRule;
    private final AttemptRepository attempts;
    private final ProblemRepository problems;
    private final ModelInfo modelInfo;

    public LearningService(UserService userService, TopicStatusService topicStatusService, UnlockRule unlockRule,
                           AttemptRepository attempts, ProblemRepository problems,
                           @Value("${app.hlr.weights-path}") Resource weightsFile) {
        this.userService = userService;
        this.topicStatusService = topicStatusService;
        this.unlockRule = unlockRule;
        this.attempts = attempts;
        this.problems = problems;
        this.modelInfo = readModelInfo(weightsFile);
    }

    // ---------------------------------------------------------------- review queue

    /**
     * Topics whose predicted retention is below the unlock threshold now (DUE) or will be within
     * horizonDays (SOON). Retention follows p = 2^(-t/h), so it reaches the threshold r after
     * t = -h * log2(r) days since the last practice.
     */
    @Transactional(readOnly = true)
    public ReviewResponse review(Long userId, int horizonDays) {
        if (horizonDays < 0 || horizonDays > 60) {
            throw new BadRequestException("horizonDays must be between 0 and 60");
        }
        userService.require(userId);
        LocalDateTime now = Times.nowUtc();
        double threshold = unlockRule.getMinRetention();
        Set<Long> solved = new HashSet<>(attempts.findProblemIdsWithVerdict(userId, Verdict.ACCEPTED));
        List<Problem> allProblems = problems.findAllWithTopic();

        List<ReviewItem> items = new ArrayList<>();
        for (TopicStatus st : topicStatusService.forUser(userId, now)) {
            if (!st.attempted()) {
                continue;
            }
            double lastsDays = -st.halfLifeDays() * (Math.log(threshold) / Math.log(2));
            double dueIn = Math.max(0, lastsDays - st.daysSinceLastPractice());
            if (dueIn > horizonDays) {
                continue;
            }
            items.add(new ReviewItem(st.topic().getId(), st.topic().getName(), dueIn == 0 ? "DUE" : "SOON",
                    Rounding.twoDecimals(st.predictedRetention()), Rounding.twoDecimals(st.halfLifeDays()),
                    Rounding.twoDecimals(dueIn), HlrPredictor.confidence(st.correctCount(), st.wrongCount()),
                    suggest(st.topic().getId(), allProblems, solved)));
        }
        items.sort(Comparator.comparing(ReviewItem::dueInDays).thenComparing(ReviewItem::predictedRetention));
        return new ReviewResponse(userId, Times.toInstant(now), threshold, horizonDays, items);
    }

    /** The easiest unsolved problem in the topic, or (all solved) the easiest one to re-solve from memory. */
    private static ProblemRef suggest(Long topicId, List<Problem> all, Set<Long> solved) {
        Comparator<Problem> easiest = Comparator.comparing(Problem::getDifficulty).thenComparing(Problem::getId);
        List<Problem> inTopic = all.stream().filter(p -> p.getTopic().getId().equals(topicId)).sorted(easiest).toList();
        Problem pick = inTopic.stream().filter(p -> !solved.contains(p.getId())).findFirst()
                .orElse(inTopic.isEmpty() ? null : inTopic.get(0));
        return pick == null ? null : new ProblemRef(pick.getId(), pick.getTitle(), pick.getDifficulty());
    }

    // ---------------------------------------------------------------- activity and streaks

    @Transactional(readOnly = true)
    public ActivityResponse activity(Long userId, int days) {
        if (days < 7 || days > 400) {
            throw new BadRequestException("days must be between 7 and 400");
        }
        userService.require(userId);
        TreeMap<LocalDate, int[]> byDay = new TreeMap<>(); // date -> {submissions, accepted}
        for (Object[] row : attempts.findSubmissionTimesAndVerdicts(userId)) {
            LocalDate date = ((LocalDateTime) row[0]).toLocalDate();
            int[] c = byDay.computeIfAbsent(date, d -> new int[2]);
            c[0]++;
            if (row[1] == Verdict.ACCEPTED) {
                c[1]++;
            }
        }

        LocalDate today = Times.nowUtc().toLocalDate();
        List<ActivityDay> window = new ArrayList<>();
        int total = 0;
        int active = 0;
        for (LocalDate d = today.minusDays(days - 1L); !d.isAfter(today); d = d.plusDays(1)) {
            int[] c = byDay.getOrDefault(d, new int[2]);
            window.add(new ActivityDay(d, c[0], c[1]));
            total += c[0];
            active += c[0] > 0 ? 1 : 0;
        }
        return new ActivityResponse(userId, currentStreak(byDay.keySet(), today), longestStreak(byDay.keySet()),
                active, total, window);
    }

    /** Consecutive active days ending today; a streak is still alive if the last active day was yesterday. */
    static int currentStreak(Set<LocalDate> activeDays, LocalDate today) {
        LocalDate d = activeDays.contains(today) ? today : today.minusDays(1);
        int streak = 0;
        while (activeDays.contains(d)) {
            streak++;
            d = d.minusDays(1);
        }
        return streak;
    }

    static int longestStreak(Set<LocalDate> activeDays) {
        int best = 0;
        for (LocalDate d : activeDays) {
            if (activeDays.contains(d.minusDays(1))) {
                continue; // not the start of a run
            }
            int run = 0;
            while (activeDays.contains(d.plusDays(run))) {
                run++;
            }
            best = Math.max(best, run);
        }
        return best;
    }

    // ---------------------------------------------------------------- problem status

    @Transactional(readOnly = true)
    public List<ProblemStatusView> problemStatus(Long userId) {
        userService.require(userId);
        return attempts.summarizeByProblem(userId, Verdict.ACCEPTED).stream()
                .map(r -> new ProblemStatusView((Long) r[0], ((Number) r[2]).longValue() > 0 ? "SOLVED" : "ATTEMPTED",
                        ((Number) r[1]).longValue(), Times.toInstant((LocalDateTime) r[3])))
                .sorted(Comparator.comparing(ProblemStatusView::problemId))
                .toList();
    }

    // ---------------------------------------------------------------- model info

    public ModelInfo modelInfo() {
        return modelInfo;
    }

    @SuppressWarnings("unchecked")
    private static ModelInfo readModelInfo(Resource weightsFile) {
        try (InputStream in = weightsFile.getInputStream()) {
            Map<String, Object> json = new ObjectMapper().readValue(in, Map.class);
            Object metrics = json.get("metrics");
            return new ModelInfo((String) json.get("model_version"), (String) json.get("data_source"),
                    (String) json.get("split"), Boolean.TRUE.equals(json.get("placeholder")),
                    (List<String>) json.get("feature_order"),
                    metrics instanceof Map ? (Map<String, Object>) metrics : Map.of());
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read the HLR weights file", e);
        }
    }
}
