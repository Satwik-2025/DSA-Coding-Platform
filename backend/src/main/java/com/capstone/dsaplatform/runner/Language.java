package com.capstone.dsaplatform.runner;

import com.capstone.dsaplatform.error.BadRequestException;
import java.util.Locale;

/**
 * Submission languages. timeFactor scales a problem's time limit (and the SUBOPTIMAL threshold),
 * because limits are calibrated for Java and CPython is several times slower on the same algorithm.
 */
public enum Language {
    JAVA("Java", "Main.java", 1.0),
    PYTHON("Python 3", "Main.py", 3.0),
    CPP("C++17", "main.cpp", 1.0);

    private final String displayName;
    private final String sourceFile;
    private final double timeFactor;

    Language(String displayName, String sourceFile, double timeFactor) {
        this.displayName = displayName;
        this.sourceFile = sourceFile;
        this.timeFactor = timeFactor;
    }

    public String displayName() { return displayName; }

    public String sourceFile() { return sourceFile; }

    public double timeFactor() { return timeFactor; }

    public long scale(long millis) { return Math.round(millis * timeFactor); }

    /** null or blank means Java, so older clients that never send a language keep working. */
    public static Language parse(String value) {
        if (value == null || value.isBlank()) {
            return JAVA;
        }
        try {
            return Language.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            throw new BadRequestException("Unknown language '" + value + "'. Use JAVA, PYTHON or CPP.");
        }
    }
}
