package com.capstone.dsaplatform.judge;

import com.capstone.dsaplatform.error.ApiExceptionHandler.ApiError;
import com.capstone.dsaplatform.error.BadRequestException;
import com.capstone.dsaplatform.error.NotFoundException;
import com.capstone.dsaplatform.error.ServiceUnavailableException;
import com.capstone.dsaplatform.error.TooManyRequestsException;
import com.capstone.dsaplatform.runner.RunListener;
import jakarta.annotation.PreDestroy;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

/**
 * Bounded judge queue: a fixed number of workers run submissions and code runs, the rest wait in
 * line. Requests never compete for the CPU unboundedly, and a full queue answers 503 at once
 * instead of slowing everyone down. Each job reports QUEUED (with its position) -> RUNNING (tests
 * done / total) -> DONE or FAILED, which the frontend polls.
 */
@Service
public class JudgeQueue {

    private static final Logger log = LoggerFactory.getLogger(JudgeQueue.class);
    private static final Duration KEEP_FINISHED = Duration.ofMinutes(10);

    public enum Status { QUEUED, RUNNING, DONE, FAILED }

    /** JSON view of a job, as returned by GET /api/submissions/jobs/{id}. */
    public record JobView(String jobId, Status status, Integer position, int testsDone, int testsTotal,
                          Object result, ApiError error) {
    }

    private final ThreadPoolExecutor executor;
    private final Map<String, Job> jobs = new ConcurrentHashMap<>();
    private final AtomicLong sequence = new AtomicLong();
    private final AtomicLong started = new AtomicLong();

    public JudgeQueue(@Value("${app.judge.workers:0}") int workers,
                      @Value("${app.judge.max-queued:50}") int maxQueued) {
        int n = workers > 0 ? workers : Math.max(1, Math.min(4, Runtime.getRuntime().availableProcessors() / 2));
        AtomicInteger threadNo = new AtomicInteger();
        this.executor = new ThreadPoolExecutor(n, n, 0, TimeUnit.MILLISECONDS, new ArrayBlockingQueue<>(maxQueued),
                r -> {
                    Thread t = new Thread(r, "judge-" + threadNo.incrementAndGet());
                    t.setDaemon(true);
                    return t;
                });
        log.info("Judge queue: {} worker(s), up to {} waiting", n, maxQueued);
    }

    /** Enqueues work; the function receives a listener that updates the job's progress. */
    public Job submit(Function<RunListener, Object> work) {
        purgeOld();
        Job job = new Job(UUID.randomUUID().toString(), sequence.incrementAndGet());
        jobs.put(job.id, job);
        try {
            executor.execute(() -> runJob(job, work));
        } catch (RejectedExecutionException e) {
            jobs.remove(job.id);
            started.incrementAndGet(); // keeps queue positions of later jobs correct
            throw new ServiceUnavailableException("The judge is busy right now. Please try again in a few seconds.");
        }
        return job;
    }

    /** Blocks until the job finishes, then returns its result or rethrows its error (same HTTP status). */
    public Object await(Job job, long timeoutMs) {
        try {
            if (!job.done.await(timeoutMs, TimeUnit.MILLISECONDS)) {
                throw new ServiceUnavailableException("The judge took too long to answer. Please try again.");
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new ServiceUnavailableException("Interrupted while waiting for the judge");
        }
        if (job.failure != null) {
            throw job.failure;
        }
        return job.result;
    }

    public Optional<JobView> view(String id) {
        Job job = jobs.get(id);
        if (job == null) {
            return Optional.empty();
        }
        Integer position = null;
        if (job.status == Status.QUEUED) {
            // Jobs start in FIFO order, so everything enqueued earlier and not yet started is ahead of us.
            position = (int) Math.max(1, job.seq - started.get());
        }
        return Optional.of(new JobView(job.id, job.status, position, job.testsDone, job.testsTotal,
                job.status == Status.DONE ? job.result : null, job.error));
    }

    private void runJob(Job job, Function<RunListener, Object> work) {
        started.incrementAndGet();
        job.status = Status.RUNNING;
        RunListener listener = new RunListener() {
            @Override
            public void compiled(int totalTests) {
                job.testsTotal = totalTests;
            }

            @Override
            public void testFinished(int done, int total) {
                job.testsDone = done;
                job.testsTotal = total;
            }
        };
        try {
            job.result = work.apply(listener);
            job.status = Status.DONE;
        } catch (RuntimeException e) {
            fail(job, e);
        } catch (Error e) {
            // Without this the job would stay RUNNING forever and the page would poll forever.
            fail(job, new IllegalStateException("Judging stopped with " + e, e));
        } finally {
            job.finishedAt = Instant.now();
            job.done.countDown();
        }
    }

    private static void fail(Job job, RuntimeException e) {
        job.failure = e;
        job.error = toError(e);
        job.status = Status.FAILED;
        if (job.error.error().equals("INTERNAL_ERROR")) {
            log.error("Judge job {} failed", job.id, e);
        }
    }

    private static ApiError toError(RuntimeException e) {
        if (e instanceof BadRequestException) {
            return new ApiError("BAD_REQUEST", e.getMessage());
        }
        if (e instanceof NotFoundException) {
            return new ApiError("NOT_FOUND", e.getMessage());
        }
        if (e instanceof TooManyRequestsException) {
            return new ApiError("TOO_MANY_REQUESTS", e.getMessage());
        }
        if (e instanceof ServiceUnavailableException) {
            return new ApiError("SERVICE_UNAVAILABLE", e.getMessage());
        }
        return new ApiError("INTERNAL_ERROR", "Something went wrong while judging. Please try again.");
    }

    private void purgeOld() {
        Instant cutoff = Instant.now().minus(KEEP_FINISHED);
        jobs.values().removeIf(j -> j.finishedAt != null && j.finishedAt.isBefore(cutoff));
    }

    @PreDestroy
    void shutdown() {
        executor.shutdownNow();
    }

    /** Mutable job state, written by one worker thread and read by request threads (hence volatile). */
    public static final class Job {
        final String id;
        final long seq;
        final CountDownLatch done = new CountDownLatch(1);
        volatile Status status = Status.QUEUED;
        volatile int testsDone;
        volatile int testsTotal;
        volatile Object result;
        volatile ApiError error;
        volatile RuntimeException failure;
        volatile Instant finishedAt;

        Job(String id, long seq) {
            this.id = id;
            this.seq = seq;
        }

        public String id() {
            return id;
        }
    }
}
