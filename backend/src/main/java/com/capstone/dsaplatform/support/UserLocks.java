package com.capstone.dsaplatform.support;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Supplier;

/**
 * One lock per learner for the short write that updates their learner model. Several judge workers
 * can finish submissions of the same learner at the same moment; without this, both would read the
 * same topic_state row and the second write would overwrite the first (a lost update), or both would
 * try to create the row and one submission would fail on the unique (user, topic) constraint.
 * The lock wraps the whole transaction, so the second writer reads what the first one committed.
 * Different learners never wait for each other. Single-process lock: the backend runs as one instance.
 */
@Component
public class UserLocks {

    private final Map<Long, Object> locks = new ConcurrentHashMap<>();

    public <T> T withLock(Long userId, Supplier<T> work) {
        Object lock = locks.computeIfAbsent(userId, id -> new Object());
        synchronized (lock) {
            return work.get();
        }
    }
}
