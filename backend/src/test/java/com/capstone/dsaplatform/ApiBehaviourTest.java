package com.capstone.dsaplatform;

import com.capstone.dsaplatform.dto.ReadinessDtos.SelfRatingRequest;
import com.capstone.dsaplatform.service.ReadinessService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Real HTTP requests through Spring MVC: validation, error bodies and concurrent writes. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("h2mem")
class ApiBehaviourTest {

    @Autowired
    private MockMvc mvc;

    @Autowired
    private ReadinessService readinessService;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    void everyErrorHasTheContractShape() throws Exception {
        mvc.perform(get("/api/no-such-endpoint"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").exists());
        mvc.perform(get("/api/users/1/self-rating"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.error").value("METHOD_NOT_ALLOWED"));
        mvc.perform(post("/api/users/1/self-rating").contentType(MediaType.TEXT_PLAIN).content("hi"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.error").value("UNSUPPORTED_MEDIA_TYPE"));
    }

    @Test
    void onlyThisComputerMayCallTheBackend() throws Exception {
        mvc.perform(get("/api/users").with(r -> { r.setRemoteAddr("192.168.1.20"); return r; }))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN"));
        mvc.perform(get("/api/users").with(r -> { r.setRemoteAddr("0:0:0:0:0:0:0:1"); return r; }))
                .andExpect(status().isOk());
        mvc.perform(get("/api/users").with(r -> { r.setRemoteAddr("127.0.0.1"); return r; }))
                .andExpect(status().isOk());
    }

    @Test
    void aFractionalRatingIsRejectedNotRounded() throws Exception {
        mvc.perform(post("/api/users/1/self-rating").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"topicId\": 4, \"rating\": 2.5}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Field 'rating' has a value of the wrong type"));
        Integer stored = jdbc.query("SELECT self_rating FROM topic_state WHERE user_id = 1 AND topic_id = 4",
                rs -> rs.next() ? (Integer) rs.getObject(1) : null);
        assertThat(stored).isNull();
    }

    @Test
    void runForAnUnknownLearnerIs404() throws Exception {
        mvc.perform(post("/api/run").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"userId\": 999, \"problemId\": 1, \"code\": \"print(1)\", \"language\": \"PYTHON\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("User 999 does not exist"));
    }

    @Test
    void parallelRatingsOfANewTopicAllSucceedAndCreateOneRow() throws Exception {
        // Topic 9 has no topic_state row for learner 2 yet, so every request would try to create it.
        int threads = 16;
        ExecutorService pool = Executors.newFixedThreadPool(threads);
        CountDownLatch go = new CountDownLatch(1);
        List<Future<?>> results = new ArrayList<>();
        try {
            for (int i = 0; i < threads; i++) {
                int rating = 1 + i % 5;
                results.add(pool.submit(() -> {
                    go.await();
                    return readinessService.setSelfRating(2L, new SelfRatingRequest(9L, rating));
                }));
            }
            go.countDown();
            for (Future<?> f : results) {
                f.get(30, TimeUnit.SECONDS); // throws if any request failed
            }
        } finally {
            pool.shutdownNow();
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM topic_state WHERE user_id = 2 AND topic_id = 9", Integer.class))
                .isEqualTo(1);
        jdbc.update("DELETE FROM topic_state WHERE user_id = 2 AND topic_id = 9");
    }
}
