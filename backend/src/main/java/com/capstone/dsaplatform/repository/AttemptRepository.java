package com.capstone.dsaplatform.repository;

import com.capstone.dsaplatform.domain.Verdict;
import com.capstone.dsaplatform.entity.Attempt;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AttemptRepository extends JpaRepository<Attempt, Long> {

    // Newest first; the Pageable carries the window size (app.readiness.recent-attempts).
    // The problem is fetched too because speed_vs_target needs its target_solve_seconds.
    @Query("select a from Attempt a join fetch a.problem p "
            + "where a.user.id = :userId and p.topic.id = :topicId "
            + "order by a.submittedAt desc, a.id desc")
    List<Attempt> findRecentInTopic(@Param("userId") Long userId, @Param("topicId") Long topicId, Pageable window);

    // Only timestamps: consistency needs the active days, not the attempts themselves.
    @Query("select a.submittedAt from Attempt a where a.user.id = :userId and a.submittedAt >= :since")
    List<LocalDateTime> findSubmissionTimesSince(@Param("userId") Long userId, @Param("since") LocalDateTime since);

    // Submissions tab on the problem page, newest first.
    List<Attempt> findTop50ByUserIdAndProblemIdOrderBySubmittedAtDescIdDesc(Long userId, Long problemId);

    // Runtime percentile: other accepted attempts on the same problem and language with a LARGE runtime...
    @Query("select count(a) from Attempt a where a.problem.id = :problemId and a.language = :language "
            + "and a.verdict = :verdict and a.largeRuntimeMs is not null and a.id <> :self")
    long countRuntimePeers(@Param("problemId") Long problemId, @Param("language") String language,
                           @Param("verdict") Verdict verdict, @Param("self") Long self);

    // ...and how many of those were slower than this one.
    @Query("select count(a) from Attempt a where a.problem.id = :problemId and a.language = :language "
            + "and a.verdict = :verdict and a.largeRuntimeMs > :runtimeMs and a.id <> :self")
    long countSlowerPeers(@Param("problemId") Long problemId, @Param("language") String language,
                          @Param("verdict") Verdict verdict, @Param("runtimeMs") Integer runtimeMs,
                          @Param("self") Long self);

    // Activity heatmap and streaks: when each attempt happened and whether it was accepted.
    @Query("select a.submittedAt, a.verdict from Attempt a where a.user.id = :userId")
    List<Object[]> findSubmissionTimesAndVerdicts(@Param("userId") Long userId);

    // Per-problem status for study plans and mock interviews: attempts, accepted attempts, last attempt.
    @Query("select a.problem.id, count(a), sum(case when a.verdict = :accepted then 1 else 0 end), max(a.submittedAt) "
            + "from Attempt a where a.user.id = :userId group by a.problem.id")
    List<Object[]> summarizeByProblem(@Param("userId") Long userId, @Param("accepted") Verdict accepted);

    // Retraining export: every attempt with what the HLR features need, grouped by learner and topic in time order.
    @Query("select a.user.id, p.topic.id, p.difficulty, a.verdict, a.submittedAt from Attempt a join a.problem p "
            + "order by a.user.id, p.topic.id, a.submittedAt, a.id")
    List<Object[]> findAllForTraining();

    // Used to skip already-solved problems in recommendations.
    @Query("select distinct a.problem.id from Attempt a where a.user.id = :userId and a.verdict = :verdict")
    List<Long> findProblemIdsWithVerdict(@Param("userId") Long userId, @Param("verdict") Verdict verdict);
}
