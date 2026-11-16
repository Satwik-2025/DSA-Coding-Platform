package com.capstone.dsaplatform.runner;

/** Progress callbacks, so the judge queue can show "Running test 3 of 7". */
public interface RunListener {

    RunListener NONE = new RunListener() {
    };

    default void compiled(int totalTests) {
    }

    default void testFinished(int done, int total) {
    }
}
