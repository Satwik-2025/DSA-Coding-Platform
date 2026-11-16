package com.capstone.dsaplatform.service;

import com.capstone.dsaplatform.domain.Difficulty;
import com.capstone.dsaplatform.dto.LearningDtos.PlanItem;
import com.capstone.dsaplatform.dto.LearningDtos.ProblemStatusView;
import com.capstone.dsaplatform.dto.LearningDtos.StudyPlanView;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Curated problem sequences with the learner's progress through each. Plain SQL: the plans are
 * read-only reference data, so they need no JPA entities.
 */
@Service
public class StudyPlanService {

    private final JdbcTemplate jdbc;
    private final LearningService learningService;
    private final UserService userService;

    public StudyPlanService(JdbcTemplate jdbc, LearningService learningService, UserService userService) {
        this.jdbc = jdbc;
        this.learningService = learningService;
        this.userService = userService;
    }

    private record Row(long planId, String slug, String title, String description, long problemId,
                       String problemTitle, String topicName, String difficulty) {
    }

    @Transactional(readOnly = true)
    public List<StudyPlanView> plans(Long userId) {
        userService.require(userId);
        Map<Long, String> status = learningService.problemStatus(userId).stream()
                .collect(Collectors.toMap(ProblemStatusView::problemId, ProblemStatusView::status));

        List<Row> rows = jdbc.query("""
                SELECT sp.id, sp.slug, sp.title, sp.description, p.id, p.title, t.name, p.difficulty
                FROM study_plans sp
                JOIN study_plan_items spi ON spi.plan_id = sp.id
                JOIN problems p ON p.id = spi.problem_id
                JOIN topics t ON t.id = p.topic_id
                ORDER BY sp.ordinal, spi.ordinal
                """, (rs, i) -> new Row(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getString(4),
                rs.getLong(5), rs.getString(6), rs.getString(7), rs.getString(8)));

        Map<Long, List<Row>> byPlan = rows.stream()
                .collect(Collectors.groupingBy(Row::planId, LinkedHashMap::new, Collectors.toList()));
        List<StudyPlanView> views = new ArrayList<>();
        for (List<Row> planRows : byPlan.values()) {
            Row first = planRows.get(0);
            List<PlanItem> items = planRows.stream()
                    .map(r -> new PlanItem(r.problemId(), r.problemTitle(), r.topicName(),
                            Difficulty.valueOf(r.difficulty()), status.getOrDefault(r.problemId(), "NEW")))
                    .toList();
            int solved = (int) items.stream().filter(i -> i.status().equals("SOLVED")).count();
            views.add(new StudyPlanView(first.planId(), first.slug(), first.title(), first.description(),
                    items.size(), solved, items));
        }
        return views;
    }
}
