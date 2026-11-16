package com.capstone.dsaplatform.runner;

import java.nio.file.Path;

/**
 * Where learner code actually executes. The runner prepares a work directory with the source
 * (and, for Java, the compiled classes) and asks the sandbox to compile or execute it.
 *
 * Implementations:
 * - {@link LocalSandbox}: child processes on this machine, hardened (Java security manager policy,
 *   Python audit-hook guard, empty environment, private temp dir, process-tree kill). Defence in depth,
 *   not a hard boundary; native code (C++) is refused unless explicitly allowed.
 * - {@link DockerSandbox}: one throw-away container per run with no network, a read-only filesystem,
 *   CPU / memory / process limits and no Linux capabilities.
 */
public interface Sandbox {

    enum Stage { COMPILE, EXECUTE }

    String name();

    /** True when arbitrary native code (C++) is contained, so it is safe to offer C++. */
    boolean isolatesNativeCode();

    /** Whether this sandbox can run the language at all (toolchain present). */
    boolean supports(Language language);

    /**
     * Compile (Python syntax check / C++ build) or execute the program in workDir.
     * Java compilation is not routed here: javac runs in-process with annotation processing off,
     * which never executes learner code.
     */
    ExecResult run(Language language, Stage stage, Path workDir, String stdin, long timeLimitMs);
}
