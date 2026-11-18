package com.capstone.dsaplatform.service;

import com.capstone.dsaplatform.domain.TestTag;
import com.capstone.dsaplatform.dto.RunDtos.LanguageView;
import com.capstone.dsaplatform.dto.RunDtos.LanguagesResponse;
import com.capstone.dsaplatform.dto.RunDtos.RunCase;
import com.capstone.dsaplatform.dto.RunDtos.RunRequest;
import com.capstone.dsaplatform.dto.RunDtos.RunResponse;
import com.capstone.dsaplatform.entity.Problem;
import com.capstone.dsaplatform.error.BadRequestException;
import com.capstone.dsaplatform.error.NotFoundException;
import com.capstone.dsaplatform.repository.ProblemRepository;
import com.capstone.dsaplatform.repository.UserRepository;
import com.capstone.dsaplatform.runner.CodeRunner;
import com.capstone.dsaplatform.runner.Language;
import com.capstone.dsaplatform.runner.RunInput;
import com.capstone.dsaplatform.runner.RunListener;
import com.capstone.dsaplatform.runner.RunResult;
import com.capstone.dsaplatform.runner.TestOutcome;
import com.capstone.dsaplatform.support.RateLimiter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * "Run" on the problem page: compile and run against the sample tests or a custom input, show
 * outputs and stderr, and record nothing (no attempt, no retention or readiness change).
 */
@Service
public class RunService {

    private static final int MAX_INPUT_CHARS = 100_000;
    private static final int MAX_OUTPUT_SHOWN = 64 * 1024;

    private final ProblemRepository problems;
    private final UserRepository users;
    private final CodeRunner codeRunner;
    private final RateLimiter rateLimiter;
    private final int maxCodeChars;
    private final int runsPerMinute;

    public RunService(ProblemRepository problems, UserRepository users, CodeRunner codeRunner, RateLimiter rateLimiter,
                      @Value("${app.limits.max-code-chars:65535}") int maxCodeChars,
                      @Value("${app.rate-limit.runs-per-minute:20}") int runsPerMinute) {
        this.problems = problems;
        this.users = users;
        this.codeRunner = codeRunner;
        this.rateLimiter = rateLimiter;
        this.maxCodeChars = maxCodeChars;
        this.runsPerMinute = runsPerMinute;
    }

    public LanguagesResponse languages() {
        Set<Language> available = codeRunner.availableLanguages();
        return new LanguagesResponse(codeRunner.sandboxName(), Arrays.stream(Language.values())
                .map(l -> new LanguageView(l.name(), l.displayName(), available.contains(l), l.timeFactor()))
                .toList());
    }

    public void precheck(RunRequest request) {
        Language language = validate(request);
        if (!problems.existsById(request.problemId())) {
            throw new NotFoundException("Problem " + request.problemId() + " does not exist");
        }
        // The learner id is the rate-limit key, so made-up ids must not each get a fresh allowance.
        if (request.userId() != null && !users.existsById(request.userId())) {
            throw new NotFoundException("User " + request.userId() + " does not exist");
        }
        if (!codeRunner.availableLanguages().contains(language)) {
            throw new BadRequestException(language.displayName() + " is not available on this server");
        }
        String key = "run:" + (request.userId() == null ? "anonymous" : request.userId());
        rateLimiter.check(key, runsPerMinute, "runs");
    }

    public RunResponse run(RunRequest request, RunListener listener) {
        Language language = validate(request);
        Problem problem = problems.findById(request.problemId())
                .orElseThrow(() -> new NotFoundException("Problem " + request.problemId() + " does not exist"));
        boolean custom = request.input() != null;
        List<RunInput> inputs = custom
                ? List.of(RunInput.custom(request.input()))
                : codeRunner.testsFor(problem.getId()).stream().filter(t -> t.tag() == TestTag.SAMPLE).toList();

        RunResult result = codeRunner.run(language, request.code(), inputs, problem.getTimeLimitMs(), listener);
        List<RunCase> cases = new ArrayList<>();
        for (int i = 0; i < result.outcomes().size(); i++) {
            TestOutcome o = result.outcomes().get(i);
            RunInput in = inputs.get(i);
            cases.add(new RunCase(i + 1, custom ? "CUSTOM" : "SAMPLE", in.input(), in.expectedOutput(),
                    cap(o.actualOutput()), status(o, custom), o.exceptionType(), o.runtimeMs(), o.memoryKb(), o.stderr()));
        }
        return new RunResponse(language.name(), result.compiled(), result.compileError(), cases);
    }

    private static String status(TestOutcome o, boolean custom) {
        if (o.timedOut()) {
            return "TIME_LIMIT_EXCEEDED";
        }
        if (o.exceptionType() != null) {
            return "RUNTIME_ERROR";
        }
        if (custom) {
            return "OK";
        }
        return o.passed() ? "ACCEPTED" : "WRONG_ANSWER";
    }

    private static String cap(String s) {
        return s == null || s.length() <= MAX_OUTPUT_SHOWN ? s : s.substring(0, MAX_OUTPUT_SHOWN) + "\n… (output truncated)";
    }

    private Language validate(RunRequest request) {
        if (request == null || request.problemId() == null) {
            throw new BadRequestException("problemId is required");
        }
        if (request.code() == null || request.code().isBlank()) {
            throw new BadRequestException("code must not be blank");
        }
        if (request.code().length() > maxCodeChars) {
            throw new BadRequestException("code is too long (at most " + maxCodeChars + " characters)");
        }
        if (request.input() != null && request.input().length() > MAX_INPUT_CHARS) {
            throw new BadRequestException("custom input is too long (at most " + MAX_INPUT_CHARS + " characters)");
        }
        return Language.parse(request.language());
    }
}
