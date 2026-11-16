package com.capstone.dsaplatform.support;

import com.capstone.dsaplatform.error.TooManyRequestsException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Token buckets per key (e.g. "submit:7"). Each bucket holds up to perMinute tokens and refills
 * continuously, so short bursts are fine but sustained spamming of the judge is not.
 * In memory: limits reset when the backend restarts, which is fine for abuse protection.
 */
@Component
public class RateLimiter {

    private final Map<String, Bucket> buckets = new ConcurrentHashMap<>();

    public void check(String key, int perMinute, String what) {
        if (perMinute <= 0) {
            return; // 0 disables the limit
        }
        Bucket bucket = buckets.computeIfAbsent(key, k -> new Bucket(perMinute));
        if (!bucket.take(perMinute)) {
            throw new TooManyRequestsException("Too many " + what + ": at most " + perMinute
                    + " per minute. Wait a few seconds and try again.");
        }
    }

    private static final class Bucket {
        private double tokens;
        private long last = System.nanoTime();

        Bucket(int capacity) {
            this.tokens = capacity;
        }

        synchronized boolean take(int perMinute) {
            long now = System.nanoTime();
            tokens = Math.min(perMinute, tokens + (now - last) / 60e9 * perMinute);
            last = now;
            if (tokens < 1) {
                return false;
            }
            tokens -= 1;
            return true;
        }
    }
}
