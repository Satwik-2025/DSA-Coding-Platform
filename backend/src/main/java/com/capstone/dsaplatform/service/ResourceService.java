package com.capstone.dsaplatform.service;

import com.capstone.dsaplatform.domain.ErrorCategory;
import com.capstone.dsaplatform.domain.ResourceSource;
import com.capstone.dsaplatform.dto.ResourceLink;
import com.capstone.dsaplatform.entity.LearningResource;
import com.capstone.dsaplatform.repository.LearningResourceRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Study links for an (error category, topic) pair (CONTRACT.md section 4.5).
 * Curated rows from the resources table come first. Otherwise the learner gets the GeeksforGeeks
 * tutorial for the topic itself (a fixed, checked URL per topic id, never a search page), an extra
 * GeeksforGeeks article on time complexity when the mistake is about speed, and a YouTube search.
 */
@Service
public class ResourceService {

    private static final int MAX_CURATED = 3;

    private static final String GFG = "https://www.geeksforgeeks.org/dsa/";

    // Topic ids are fixed (data.sql). Every URL here was opened and checked by hand.
    private static final Map<Long, TopicPage> TOPIC_PAGES = Map.of(
            1L, new TopicPage("Array data structure guide", GFG + "array-data-structure-guide/"),
            2L, new TopicPage("String data structure", GFG + "string-data-structure/"),
            3L, new TopicPage("Two pointers technique", GFG + "two-pointers-technique/"),
            4L, new TopicPage("Sliding window technique", GFG + "window-sliding-technique/"),
            5L, new TopicPage("Hashing data structure", GFG + "hashing-data-structure/"),
            6L, new TopicPage("Linked list data structure", GFG + "linked-list-data-structure/"),
            7L, new TopicPage("Stack data structure", GFG + "stack-data-structure/"),
            8L, new TopicPage("Tree data structure", GFG + "tree-data-structure/"),
            9L, new TopicPage("Graph data structure and algorithms", GFG + "graph-data-structure-and-algorithms/"),
            10L, new TopicPage("Dynamic programming", GFG + "dynamic-programming/"));

    private static final TopicPage TIME_COMPLEXITY =
            new TopicPage("Understanding time complexity", GFG + "understanding-time-complexity-simple-examples/");

    private record TopicPage(String title, String url) {
    }

    private final LearningResourceRepository resources;

    public ResourceService(LearningResourceRepository resources) {
        this.resources = resources;
    }

    @Transactional(readOnly = true)
    public List<ResourceLink> linksFor(ErrorCategory category, Long topicId, String topicName) {
        List<LearningResource> curated = new ArrayList<>(
                resources.findByErrorCategoryAndTopicIdOrderByRankAscIdAsc(category, topicId));
        curated.addAll(resources.findByErrorCategoryAndTopicIsNullOrderByRankAscIdAsc(category));
        if (!curated.isEmpty()) {
            return curated.stream()
                    .limit(MAX_CURATED)
                    .map(r -> new ResourceLink(r.getTitle(), r.getUrl(), r.getSource(), false))
                    .toList();
        }
        return defaultLinks(category, topicId, topicName);
    }

    private static List<ResourceLink> defaultLinks(ErrorCategory category, Long topicId, String topicName) {
        List<ResourceLink> links = new ArrayList<>();
        TopicPage page = topicId == null ? null : TOPIC_PAGES.get(topicId);
        if (page != null) {
            links.add(new ResourceLink(page.title(), page.url(), ResourceSource.GFG, false));
        }
        if (category == ErrorCategory.BAD_COMPLEXITY || category == ErrorCategory.SUBOPTIMAL) {
            links.add(new ResourceLink(TIME_COMPLEXITY.title(), TIME_COMPLEXITY.url(), ResourceSource.GFG, false));
        }
        String query = topicName + " " + searchPhrase(category) + " java";
        // URLEncoder encodes spaces as "+", which is what the YouTube search URL expects.
        String q = URLEncoder.encode(query, StandardCharsets.UTF_8);
        links.add(new ResourceLink("YouTube search: " + query,
                "https://www.youtube.com/results?search_query=" + q, ResourceSource.YOUTUBE, true));
        return links;
    }

    private static String searchPhrase(ErrorCategory category) {
        return switch (category) {
            case SYNTAX_COMPILATION -> "java compilation errors";
            case OFF_BY_ONE -> "off by one error";
            case MISSED_EDGE_CASE -> "edge cases";
            case WRONG_ALGORITHM -> "approach explained";
            case STATE_TRANSITION -> "dp state transition";
            case BAD_COMPLEXITY -> "time complexity optimization";
            case SUBOPTIMAL -> "optimal solution";
        };
    }
}
