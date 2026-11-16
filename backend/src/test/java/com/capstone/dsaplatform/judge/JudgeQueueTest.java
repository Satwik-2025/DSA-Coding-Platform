package com.capstone.dsaplatform.judge;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.capstone.dsaplatform.error.BadRequestException;
import com.capstone.dsaplatform.error.ServiceUnavailableException;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;

class JudgeQueueTest {

    @Test
    void reportsProgressAndResult() {
        JudgeQueue queue = new JudgeQueue(1, 5);
        JudgeQueue.Job job = queue.submit(listener -> {
            listener.compiled(3);
            listener.testFinished(1, 3);
            listener.testFinished(3, 3);
            return "done";
        });

        assertEquals("done", queue.await(job, 5000));
        JudgeQueue.JobView view = queue.view(job.id()).orElseThrow();
        assertEquals(JudgeQueue.Status.DONE, view.status());
        assertEquals(3, view.testsDone());
        assertEquals(3, view.testsTotal());
    }

    @Test
    void waitingJobsKnowTheirPositionAndAFullQueueIsRejected() throws Exception {
        JudgeQueue queue = new JudgeQueue(1, 2);
        CountDownLatch release = new CountDownLatch(1);
        CountDownLatch running = new CountDownLatch(1);
        queue.submit(l -> {
            running.countDown();
            try {
                release.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            return 1;
        });
        running.await(5, TimeUnit.SECONDS);
        JudgeQueue.Job second = queue.submit(l -> 2);
        JudgeQueue.Job third = queue.submit(l -> 3);

        assertEquals(1, queue.view(second.id()).orElseThrow().position());
        assertEquals(2, queue.view(third.id()).orElseThrow().position());
        assertThrows(ServiceUnavailableException.class, () -> queue.submit(l -> 4));

        release.countDown();
        assertEquals(3, queue.await(third, 5000));
    }

    @Test
    void errorsKeepTheirHttpMeaning() {
        JudgeQueue queue = new JudgeQueue(1, 5);
        JudgeQueue.Job job = queue.submit(l -> {
            throw new BadRequestException("nope");
        });

        assertThrows(BadRequestException.class, () -> queue.await(job, 5000));
        assertEquals("BAD_REQUEST", queue.view(job.id()).orElseThrow().error().error());
    }
}
