package com.capstone.dsaplatform.error;

/** 429: a learner is submitting or running code faster than the rate limit allows. */
public class TooManyRequestsException extends RuntimeException {

    public TooManyRequestsException(String message) {
        super(message);
    }
}
