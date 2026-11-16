package com.capstone.dsaplatform.runner;

import java.util.Locale;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Picks the sandbox from app.runner.sandbox: "local" (default) or "docker". */
@Configuration
public class SandboxConfig {

    private static final Logger log = LoggerFactory.getLogger(SandboxConfig.class);

    @Bean
    public Sandbox sandbox(RunnerSettings settings) {
        String mode = settings.sandbox == null ? "local" : settings.sandbox.trim().toLowerCase(Locale.ROOT);
        Sandbox sandbox = switch (mode) {
            case "docker" -> new DockerSandbox(settings);
            case "local" -> new LocalSandbox(settings);
            default -> throw new IllegalStateException("app.runner.sandbox must be 'local' or 'docker', not '" + mode + "'");
        };
        log.info("Code runner sandbox: {}", sandbox.name());
        return sandbox;
    }
}
