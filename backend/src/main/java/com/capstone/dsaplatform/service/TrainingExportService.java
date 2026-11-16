package com.capstone.dsaplatform.service;

import com.capstone.dsaplatform.domain.Difficulty;
import com.capstone.dsaplatform.domain.Verdict;
import com.capstone.dsaplatform.learner.HlrPredictor;
import com.capstone.dsaplatform.repository.AttemptRepository;
import com.capstone.dsaplatform.support.Times;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Turns the platform's own attempt history into HLR training rows, so the model can be retrained
 * on real learners (ml/train_hlr.py). For every attempt that follows an earlier attempt in the same
 * topic, the row holds the features as they were just BEFORE it (exactly what HlrPredictor sees),
 * the days since the previous practice, and whether this attempt was accepted (recalled = 1).
 * Learners appear only as their numeric id; no code or names are exported.
 */
@Service
public class TrainingExportService {

    public static final String HEADER =
            "user_id,topic_id,delta_days,correct_before,wrong_before,mean_difficulty_before,recalled,submitted_at";

    private final AttemptRepository attempts;

    public TrainingExportService(AttemptRepository attempts) {
        this.attempts = attempts;
    }

    @Transactional(readOnly = true)
    public String csv() {
        return toCsv(attempts.findAllForTraining());
    }

    /** rows: user id, topic id, difficulty, verdict, submitted at; sorted by user, topic, time. */
    static String toCsv(List<Object[]> rows) {
        StringBuilder sb = new StringBuilder(HEADER).append('\n');
        Long user = null;
        Long topic = null;
        int correct = 0;
        int wrong = 0;
        double meanDifficulty = 0;
        LocalDateTime last = null;
        for (Object[] r : rows) {
            Long u = (Long) r[0];
            Long t = (Long) r[1];
            Difficulty difficulty = (Difficulty) r[2];
            boolean accepted = r[3] == Verdict.ACCEPTED;
            LocalDateTime at = (LocalDateTime) r[4];
            if (!Objects.equals(u, user) || !Objects.equals(t, topic)) {
                user = u;
                topic = t;
                correct = 0;
                wrong = 0;
                meanDifficulty = 0;
                last = null;
            }
            if (last != null) {
                sb.append(String.format(Locale.ROOT, "%d,%d,%.6f,%d,%d,%.4f,%d,%s%n", u, t,
                        HlrPredictor.daysBetween(last, at), correct, wrong, meanDifficulty, accepted ? 1 : 0,
                        Times.toInstant(at)));
            }
            int n = correct + wrong;
            meanDifficulty = (meanDifficulty * n + difficulty.getWeight()) / (n + 1);
            if (accepted) {
                correct++;
            } else {
                wrong++;
            }
            last = at;
        }
        return sb.toString().replace("\r\n", "\n");
    }
}
