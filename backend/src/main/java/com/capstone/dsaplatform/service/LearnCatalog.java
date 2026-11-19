package com.capstone.dsaplatform.service;

import com.capstone.dsaplatform.dto.ProblemDtos.LearnReading;
import com.capstone.dsaplatform.dto.ProblemDtos.LearnResources;
import com.capstone.dsaplatform.dto.ProblemDtos.LearnVideo;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * "Learn This Topic" for every problem: hand-picked YouTube videos and reading for the concept the
 * problem needs, from resources/learn/problem-resources.json (keyed by problem slug). The file is
 * read-only reference data checked by hand, so it lives next to the code rather than in the database.
 */
@Service
public class LearnCatalog {

    private static final LearnResources NONE = new LearnResources(null, List.of(), List.of());

    private final Map<String, LearnResources> bySlug;

    public LearnCatalog() {
        this.bySlug = load("/learn/problem-resources.json");
    }

    /** Resources for a problem; empty lists (never null) for a problem the file does not cover yet. */
    public LearnResources forSlug(String slug) {
        return bySlug.getOrDefault(slug, NONE);
    }

    public boolean covers(String slug) {
        return bySlug.containsKey(slug);
    }

    private static Map<String, LearnResources> load(String resource) {
        try (InputStream in = LearnCatalog.class.getResourceAsStream(resource)) {
            if (in == null) {
                throw new IllegalStateException("Missing resource " + resource);
            }
            JsonNode problems = new ObjectMapper().readTree(in).path("problems");
            Map<String, LearnResources> map = new HashMap<>();
            problems.fields().forEachRemaining(e -> map.put(e.getKey(), parse(e.getValue())));
            return Map.copyOf(map);
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read " + resource, e);
        }
    }

    private static LearnResources parse(JsonNode node) {
        List<LearnVideo> videos = new ArrayList<>();
        for (JsonNode v : node.path("videos")) {
            String id = v.path("youtubeId").asText();
            videos.add(new LearnVideo(v.path("title").asText(), v.path("channel").asText(), id,
                    "https://www.youtube.com/watch?v=" + id,
                    // youtube-nocookie: the embedded player sets no tracking cookies until the video is played.
                    "https://www.youtube-nocookie.com/embed/" + id,
                    "https://i.ytimg.com/vi/" + id + "/hqdefault.jpg",
                    v.path("about").asText()));
        }
        List<LearnReading> reading = new ArrayList<>();
        for (JsonNode r : node.path("reading")) {
            reading.add(new LearnReading(r.path("title").asText(), r.path("site").asText(), r.path("url").asText(),
                    r.path("about").asText()));
        }
        return new LearnResources(node.path("concept").asText(null), List.copyOf(videos), List.copyOf(reading));
    }
}
