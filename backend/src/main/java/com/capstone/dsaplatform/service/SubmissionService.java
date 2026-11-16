package com.capstone.dsaplatform.service;

import com.capstone.dsaplatform.domain.Difficulty;
import com.capstone.dsaplatform.domain.TestTag;
import com.capstone.dsaplatform.domain.Verdict;
import com.capstone.dsaplatform.dto.ResourceLink;
import com.capstone.dsaplatform.dto.SubmissionDtos.FailedTestView;
import com.capstone.dsaplatform.dto.SubmissionDtos.HistoryItem;
import com.capstone.dsaplatform.dto.SubmissionDtos.SubmissionRequest;
import com.capstone.dsaplatform.dto.SubmissionDtos.SubmissionResponse;
import com.capstone.dsaplatform.dto.SubmissionDtos.TestResultView;
import com.capstone.dsaplatform.entity.Attempt;
import com.capstone.dsaplatform.entity.ErrorEvent;
import com.capstone.dsaplatform.entity.Problem;
import com.capstone.dsaplatform.entity.TestCase;
import com.capstone.dsaplatform.entity.Topic;
import com.capstone.dsaplatform.entity.TopicState;
import com.capstone.dsaplatform.entity.User;
import com.capstone.dsaplatform.error.BadRequestException;
import com.capstone.dsaplatform.error.NotFoundException;
import com.capstone.dsaplatform.learner.HintGenerator;
import com.capstone.dsaplatform.learner.HlrPredictor;
import com.capstone.dsaplatform.learner.SubmissionEvaluator;
import com.capstone.dsaplatform.learner.SubmissionEvaluator.Evaluation;
import com.capstone.dsaplatform.learner.SubmissionEvaluator.TestInfo;
import com.capstone.dsaplatform.learner.SubmissionEvaluator.TestRun;
import com.capstone.dsaplatform.repository.AttemptRepository;
import com.capstone.dsaplatform.repository.ErrorEventRepository;
import com.capstone.dsaplatform.repository.ProblemRepository;
import com.capstone.dsaplatform.repository.TestCaseRepository;
import com.capstone.dsaplatform.repository.TopicStateRepository;
import com.capstone.dsaplatform.runner.CodeRunner;
import com.capstone.dsaplatform.runner.Language;
import com.capstone.dsaplatform.runner.RunInput;
import com.capstone.dsaplatform.runner.RunListener;
import com.capstone.dsaplatform.runner.RunResult;
import com.capstone.dsaplatform.runner.TestOutcome;
import com.capstone.dsaplatform.support.RateLimiter;
import com.capstone.dsaplatform.support.Times;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * The submission pipeline (CONTRACT.md section 4.1): run -> verdict + category -> attempt ->
 * at most one error_event -> topic_state -> readiness snapshot -> response.
 *
 * The code runs outside any database transaction (it can take seconds); everything it produces is
 * then written in one short transaction, so an attempt is never stored without its learner-model update.
 */
@Service
public class SubmissionService {

    // DP is the only topic with a special category rule (precedence step 6).
    private static final long DP_TOPIC_ID = 10L;
    // Matches error_events.exception_type VARCHAR(120); a longer name must not fail the whole submission.
    private static final int EXCEPTION_TYPE_MAX = 120;

    private final UserService userService;
    private final ProblemRepository problems;
    private final TestCaseRepository testCases;
    private final AttemptRepository attempts;
    private final ErrorEventRepository errorEvents;
    private final TopicStateRepository topicStates;
    private final CodeRunner codeRunner;
    private final HlrPredictor hlr;
    private final ReadinessService readinessService;
    private final ResourceService resourceService;
    private final RateLimiter rateLimiter;
    private final TransactionTemplate readTx;
    private final TransactionTemplate writeTx;
    private final int maxCodeChars;
    private final int submissionsPerMinute;

    public SubmissionService(UserService userService, ProblemRepository problems, TestCaseRepository testCases,
                             AttemptRepository attempts, ErrorEventRepository errorEvents,
                             TopicStateRepository topicStates, CodeRunner codeRunner, HlrPredictor hlr,
                             ReadinessService readinessService, ResourceService resourceService,
                             RateLimiter rateLimiter, PlatformTransactionManager txManager,
                             @Value("${app.limits.max-code-chars:65535}") int maxCodeChars,
                             @Value("${app.rate-limit.submissions-per-minute:10}") int submissionsPerMinute) {
        this.userService = userService;
        this.problems = problems;
        this.testCases = testCases;
        this.attempts = attempts;
        this.errorEvents = errorEvents;
        this.topicStates = topicStates;
        this.codeRunner = codeRunner;
        this.hlr = hlr;
        this.readinessService = readinessService;
        this.resourceService = resourceService;
        this.rateLimiter = rateLimiter;
        this.readTx = new TransactionTemplate(txManager);
        this.readTx.setReadOnly(true);
        this.writeTx = new TransactionTemplate(txManager);
        this.maxCodeChars = maxCodeChars;
        this.submissionsPerMinute = submissionsPerMinute;
    }

    /**
     * Fast checks on the request thread before the job is queued: a bad request, unknown user or
     * problem, unavailable language or rate-limit hit is answered immediately instead of after the queue.
     */
    public void precheck(SubmissionRequest request) {
        Language language = validate(request);
        userService.require(request.userId());
        if (!problems.existsById(request.problemId())) {
            throw new NotFoundException("Problem " + request.problemId() + " does not exist");
        }
        requireAvailable(language);
        rateLimiter.check("submit:" + request.userId(), submissionsPerMinute, "submissions");
    }

    public SubmissionResponse submit(SubmissionRequest request) {
        return submit(request, RunListener.NONE);
    }

    public SubmissionResponse submit(SubmissionRequest request, RunListener listener) {
        Language language = validate(request);
        requireAvailable(language);
        Prepared p = readTx.execute(status -> prepare(request));
        RunResult result = codeRunner.run(language, request.code(), p.inputs(), p.timeLimitMs(), listener);
        return writeTx.execute(status -> persist(p, request, language, result));
    }

    @Transactional(readOnly = true)
    public List<HistoryItem> history(Long userId, Long problemId) {
        userService.require(userId);
        if (!problems.existsById(problemId)) {
            throw new NotFoundException("Problem " + problemId + " does not exist");
        }
        return attempts.findTop50ByUserIdAndProblemIdOrderBySubmittedAtDescIdDesc(userId, problemId).stream()
                .map(a -> new HistoryItem(a.getId(), a.getVerdict(), a.getPassedCount(), a.getTotalCount(),
                        a.getLanguage(), a.getLargeRuntimeMs(), Times.toInstant(a.getSubmittedAt()), a.getCode()))
                .toList();
    }

    // ---------------------------------------------------------------- pipeline steps

    /** Everything the run and the evaluation need, read once and detached from the session. */
    private record Prepared(Long userId, Long problemId, Long topicId, String topicName, Difficulty difficulty,
                            int timeLimitMs, Integer optimalRuntimeMs, Map<Long, TestCase> testById,
                            List<TestInfo> tests, List<RunInput> inputs) {
    }

    private Prepared prepare(SubmissionRequest request) {
        userService.require(request.userId());
        Problem problem = problems.findById(request.problemId())
                .orElseThrow(() -> new NotFoundException("Problem " + request.problemId() + " does not exist"));
        Topic topic = problem.getTopic();
        List<TestCase> all = testCases.findByProblemId(problem.getId());
        Map<Long, TestCase> testById = all.stream().collect(Collectors.toMap(TestCase::getId, Function.identity()));
        List<TestInfo> tests = all.stream()
                .map(tc -> new TestInfo(tc.getId(), tc.getTag(), tc.getOrdinal(), tc.getErrorCategoryOverride()))
                .toList();
        // SAMPLE -> EDGE -> BOUNDARY -> LARGE, then ordinal: the first-failure order.
        List<RunInput> inputs = all.stream()
                .sorted(Comparator.comparing(TestCase::getTag).thenComparing(TestCase::getOrdinal))
                .map(RunInput::of)
                .toList();
        return new Prepared(request.userId(), problem.getId(), topic.getId(), topic.getName(), problem.getDifficulty(),
                problem.getTimeLimitMs(), problem.getOptimalRuntimeMs(), testById, tests, inputs);
    }

    private SubmissionResponse persist(Prepared p, SubmissionRequest request, Language language, RunResult result) {
        User user = userService.require(p.userId());
        Problem problem = problems.getReferenceById(p.problemId());
        Topic topic = problem.getTopic();

        // The reference time was measured in Java; slower languages get the same factor as their time limit.
        Integer optimal = p.optimalRuntimeMs() == null ? null : (int) language.scale(p.optimalRuntimeMs());
        Evaluation ev = SubmissionEvaluator.evaluate(result, p.tests(), optimal, p.topicId() == DP_TOPIC_ID);
        LocalDateTime now = Times.nowUtc();

        Attempt attempt = new Attempt();
        attempt.setUser(user);
        attempt.setProblem(problem);
        attempt.setCode(request.code());
        attempt.setVerdict(ev.verdict());
        attempt.setPassedCount(ev.passedCount());
        attempt.setTotalCount(ev.totalCount());
        attempt.setLargeRuntimeMs(ev.largeRuntimeMs());
        attempt.setTimeSpentSeconds(request.timeSpentSeconds());
        attempt.setSubmittedAt(now);
        attempt.setLanguage(language.name());
        attempts.save(attempt);

        if (ev.category() != null) {
            saveErrorEvent(attempt, user, topic, ev, now);
        }
        updateTopicState(user, topic, p.difficulty(), ev.verdict() == Verdict.ACCEPTED, now);
        readinessService.writeSnapshot(user, now);

        List<ResourceLink> resources = ev.category() == null
                ? List.of()
                : resourceService.linksFor(ev.category(), p.topicId(), p.topicName());
        TestRun flagged = ev.flaggedRun();
        List<String> hints = HintGenerator.hints(ev.category(), p.topicId(),
                flagged == null ? null : flagged.test().tag(),
                flagged == null ? null : flagged.outcome().exceptionType(),
                language.name(), ev.message());
        Integer maxMemoryKb = ev.runs().stream().map(r -> r.outcome().memoryKb()).filter(Objects::nonNull)
                .max(Integer::compare).orElse(null);

        return new SubmissionResponse(attempt.getId(), user.getId(), p.problemId(), p.topicId(),
                ev.verdict(), ev.passedCount(), ev.totalCount(), ev.category(),
                failedTestView(flagged, p.testById()), ev.message(),
                ev.largeRuntimeMs(), optimal,
                ev.runs().stream().map(r -> new TestResultView(r.test().ordinal(), r.test().tag(), r.verdict(),
                        r.outcome().runtimeMs(), r.outcome().memoryKb())).toList(),
                resources, Times.toInstant(now), language.name(), hints,
                runtimePercentile(attempt, language), maxMemoryKb);
    }

    /** "Faster than X%": share of other accepted attempts (same problem and language) with a slower LARGE run. */
    private Integer runtimePercentile(Attempt attempt, Language language) {
        if (attempt.getVerdict() != Verdict.ACCEPTED || attempt.getLargeRuntimeMs() == null) {
            return null;
        }
        Long problemId = attempt.getProblem().getId();
        long peers = attempts.countRuntimePeers(problemId, language.name(), Verdict.ACCEPTED, attempt.getId());
        if (peers == 0) {
            return null;
        }
        long slower = attempts.countSlowerPeers(problemId, language.name(), Verdict.ACCEPTED,
                attempt.getLargeRuntimeMs(), attempt.getId());
        return (int) Math.round(slower * 100.0 / peers);
    }

    private Language validate(SubmissionRequest request) {
        if (request == null || request.userId() == null || request.problemId() == null) {
            throw new BadRequestException("userId and problemId are required");
        }
        if (request.code() == null || request.code().isBlank()) {
            throw new BadRequestException("code must not be blank");
        }
        if (request.code().length() > maxCodeChars) {
            throw new BadRequestException("code is too long (at most " + maxCodeChars + " characters)");
        }
        // The DB rejects negatives anyway; checking here turns a 500 into a clear 400.
        if (request.timeSpentSeconds() != null && request.timeSpentSeconds() < 0) {
            throw new BadRequestException("timeSpentSeconds must be >= 0");
        }
        return Language.parse(request.language());
    }

    private void requireAvailable(Language language) {
        if (!codeRunner.availableLanguages().contains(language)) {
            throw new BadRequestException(language.displayName() + " is not available on this server");
        }
    }

    private void saveErrorEvent(Attempt attempt, User user, Topic topic, Evaluation ev, LocalDateTime now) {
        TestRun flagged = ev.flaggedRun(); // null only for SYNTAX_COMPILATION
        ErrorEvent event = new ErrorEvent();
        event.setAttempt(attempt);
        event.setUser(user);
        event.setTopic(topic);
        event.setErrorCategory(ev.category());
        event.setOccurredAt(now);
        if (flagged != null) {
            event.setFailedTag(flagged.test().tag());
            event.setFailedTestCase(testCases.getReferenceById(flagged.test().id()));
            event.setExceptionType(truncate(flagged.outcome().exceptionType()));
        }
        errorEvents.save(event);
    }

    /** CONTRACT.md section 4.3 update order: counts, mean difficulty, last practiced, half-life. */
    private void updateTopicState(User user, Topic topic, Difficulty difficulty, boolean accepted, LocalDateTime now) {
        TopicState state = topicStates.findByUserIdAndTopicId(user.getId(), topic.getId()).orElseGet(() -> {
            TopicState s = new TopicState();
            s.setUser(user);
            s.setTopic(topic);
            return s;
        });

        int previousAttempts = state.getCorrectCount() + state.getWrongCount(); // n BEFORE this submission
        if (accepted) {
            state.setCorrectCount(state.getCorrectCount() + 1);
        } else {
            state.setWrongCount(state.getWrongCount() + 1);
        }
        // Running mean, so the full attempt history never has to be re-read.
        double weight = difficulty.getWeight();
        Double oldMean = state.getMeanDifficulty();
        state.setMeanDifficulty(oldMean == null ? weight : (oldMean * previousAttempts + weight) / (previousAttempts + 1));
        state.setLastPracticedAt(now);
        // Display copy only (e.g. for the H2 console); predictions always recompute half-life live.
        state.setHalfLifeDays(hlr.halfLifeDays(state.getCorrectCount(), state.getWrongCount(),
                state.getMeanDifficulty(), topic.getId()));
        topicStates.save(state);
    }

    private static FailedTestView failedTestView(TestRun flagged, Map<Long, TestCase> testById) {
        if (flagged == null) {
            return null;
        }
        // Only SAMPLE tests are visible to the learner; hidden test data must not leak through errors.
        boolean visible = flagged.test().tag() == TestTag.SAMPLE;
        TestCase tc = testById.get(flagged.test().id());
        TestOutcome o = flagged.outcome();
        return new FailedTestView(tc.getId(), tc.getTag(), tc.getOrdinal(),
                visible ? tc.getInput() : null,
                visible ? tc.getExpectedOutput() : null,
                visible ? o.actualOutput() : null);
    }

    private static String truncate(String s) {
        return s == null || s.length() <= EXCEPTION_TYPE_MAX ? s : s.substring(0, EXCEPTION_TYPE_MAX);
    }
}
