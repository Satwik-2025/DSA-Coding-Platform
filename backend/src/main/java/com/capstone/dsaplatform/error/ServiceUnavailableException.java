package com.capstone.dsaplatform.error;

/** 503: the judge queue is full (or a job did not finish in time); the client should retry shortly. */
public class ServiceUnavailableException extends RuntimeException {

    public ServiceUnavailableException(String message) {
        super(message);
    }
}
