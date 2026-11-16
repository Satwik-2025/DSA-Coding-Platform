package com.capstone.dsaplatform.runner;

/**
 * What one sandboxed process did. memoryKb is the peak memory when the sandbox can measure it
 * (the Docker sandbox reads the container's cgroup); null otherwise.
 */
public record ExecResult(int exitCode, String stdout, String stderr, boolean timedOut, long runtimeMs, Integer memoryKb) {
}
