package com.capstone.dsaplatform.dto;

import com.capstone.dsaplatform.domain.Difficulty;

import java.util.List;

/** Problem endpoints (CONTRACT.md sections 5.9 - 5.10). */
public final class ProblemDtos {

    private ProblemDtos() {
    }

    public record ProblemSummary(Long id, String title, String slug, Long topicId, String topicName, Difficulty difficulty) {
    }

    public record TopicRef(Long id, String name) {
    }

    public record SampleTestView(Integer ordinal, String input, String expectedOutput) {
    }

    // Only SAMPLE tests are exposed; testCount includes hidden ones so the UI can show "2 of 7 visible".
    public record ProblemDetail(Long id,
                                String title,
                                String slug,
                                TopicRef topic,
                                Difficulty difficulty,
                                String statement,
                                String inputFormat,
                                String outputFormat,
                                Integer timeLimitMs,
                                Integer targetSolveSeconds,
                                List<SampleTestView> sampleTests,
                                long testCount,
                                // "Learn This Topic": videos and reading for the concept this problem needs.
                                LearnResources learn) {
    }

    public record LearnVideo(String title, String channel, String youtubeId, String watchUrl, String embedUrl,
                             String thumbnailUrl, String about) {
    }

    public record LearnReading(String title, String site, String url, String about) {
    }

    // concept: the main idea the problem needs, e.g. "Monotonic stack".
    public record LearnResources(String concept, List<LearnVideo> videos, List<LearnReading> reading) {
    }
}
