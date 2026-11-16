package com.capstone.dsaplatform.controller;

import com.capstone.dsaplatform.dto.RunDtos.LanguagesResponse;
import com.capstone.dsaplatform.dto.RunDtos.RunRequest;
import com.capstone.dsaplatform.dto.RunDtos.RunResponse;
import com.capstone.dsaplatform.dto.SubmissionDtos.SubmissionRequest;
import com.capstone.dsaplatform.dto.SubmissionDtos.SubmissionResponse;
import com.capstone.dsaplatform.error.NotFoundException;
import com.capstone.dsaplatform.judge.JudgeQueue;
import com.capstone.dsaplatform.judge.JudgeQueue.JobView;
import com.capstone.dsaplatform.service.RunService;
import com.capstone.dsaplatform.service.SubmissionService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * CONTRACT.md section 5.1 plus the judge-queue endpoints. Every execution goes through the bounded
 * {@link JudgeQueue}: POST /api/submissions waits for its result (original contract), while
 * POST /api/submissions/jobs returns a job id at once that the client polls for progress.
 */
@RestController
public class SubmissionController {

    private static final long SYNC_WAIT_MS = 120_000;

    private final SubmissionService submissionService;
    private final RunService runService;
    private final JudgeQueue judge;

    public SubmissionController(SubmissionService submissionService, RunService runService, JudgeQueue judge) {
        this.submissionService = submissionService;
        this.runService = runService;
        this.judge = judge;
    }

    @PostMapping("/api/submissions")
    public SubmissionResponse submit(@RequestBody SubmissionRequest request) {
        submissionService.precheck(request);
        JudgeQueue.Job job = judge.submit(listener -> submissionService.submit(request, listener));
        return (SubmissionResponse) judge.await(job, SYNC_WAIT_MS);
    }

    @PostMapping("/api/submissions/jobs")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public JobView submitAsync(@RequestBody SubmissionRequest request) {
        submissionService.precheck(request);
        JudgeQueue.Job job = judge.submit(listener -> submissionService.submit(request, listener));
        return judge.view(job.id()).orElseThrow();
    }

    @GetMapping("/api/submissions/jobs/{jobId}")
    public JobView job(@PathVariable String jobId) {
        return judge.view(jobId).orElseThrow(() -> new NotFoundException("Job " + jobId + " does not exist or has expired"));
    }

    @PostMapping("/api/run")
    public RunResponse run(@RequestBody RunRequest request) {
        runService.precheck(request);
        JudgeQueue.Job job = judge.submit(listener -> runService.run(request, listener));
        return (RunResponse) judge.await(job, SYNC_WAIT_MS);
    }

    @GetMapping("/api/languages")
    public LanguagesResponse languages() {
        return runService.languages();
    }
}
