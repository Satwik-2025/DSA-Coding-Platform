package com.capstone.dsaplatform.runner;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** app.runner.* settings (application.yml). Plain fields so tests can build one with {@link #defaults()}. */
@Component
public class RunnerSettings {

    final String sandbox;
    final String pythonCommand;
    final boolean javaSecurityManager;
    final String dockerCommand;
    final String dockerJavaImage;
    final String dockerPythonImage;
    final String dockerMemory;
    final String dockerCpus;
    final int dockerPids;
    final long dockerStartupAllowanceMs;

    public RunnerSettings(
            @Value("${app.runner.sandbox:local}") String sandbox,
            @Value("${app.runner.python-command:}") String pythonCommand,
            @Value("${app.runner.java-security-manager:true}") boolean javaSecurityManager,
            @Value("${app.runner.docker.command:docker}") String dockerCommand,
            @Value("${app.runner.docker.java-image:eclipse-temurin:21-jre}") String dockerJavaImage,
            @Value("${app.runner.docker.python-image:python:3.12-slim}") String dockerPythonImage,
            @Value("${app.runner.docker.memory:256m}") String dockerMemory,
            @Value("${app.runner.docker.cpus:1}") String dockerCpus,
            @Value("${app.runner.docker.pids-limit:64}") int dockerPids,
            @Value("${app.runner.docker.startup-allowance-ms:5000}") long dockerStartupAllowanceMs) {
        this.sandbox = sandbox;
        this.pythonCommand = pythonCommand;
        this.javaSecurityManager = javaSecurityManager;
        this.dockerCommand = dockerCommand;
        this.dockerJavaImage = dockerJavaImage;
        this.dockerPythonImage = dockerPythonImage;
        this.dockerMemory = dockerMemory;
        this.dockerCpus = dockerCpus;
        this.dockerPids = dockerPids;
        this.dockerStartupAllowanceMs = dockerStartupAllowanceMs;
    }

    public static RunnerSettings defaults() {
        return new RunnerSettings("local", "", true, "docker", "eclipse-temurin:21-jre",
                "python:3.12-slim", "256m", "1", 64, 5000);
    }
}
