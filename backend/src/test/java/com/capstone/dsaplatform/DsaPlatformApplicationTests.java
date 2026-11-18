package com.capstone.dsaplatform;

import com.capstone.dsaplatform.domain.ErrorCategory;
import com.capstone.dsaplatform.domain.ResourceSource;
import com.capstone.dsaplatform.dto.ResourceLink;
import com.capstone.dsaplatform.service.ResourceService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;
import org.springframework.test.context.ActiveProfiles;

import javax.sql.DataSource;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Starting the context runs schema.sql + data.sql and then Hibernate's
 * ddl-auto=validate, so the context alone proves the entities and the SQL agree.
 */
@SpringBootTest
@ActiveProfiles("h2mem") // in-memory: never touches (or locks) the developer's backend/data file
class DsaPlatformApplicationTests {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private ResourceService resourceService;

    @Test
    void contextLoads() {
    }

    @Test
    void demoLearnersAreRahulAndAnanya() {
        assertThat(users()).containsExactly(Map.entry(1L, "Rahul"), Map.entry(2L, "Ananya"));
    }

    @Test
    void oldAlexAndSamAreRenamedInPlaceKeepingTheirIds() {
        // A database from before the rename: id 1 = Alex, id 2 = Sam, each with their own self-rating.
        jdbc.update("UPDATE users SET display_name = 'Alex' WHERE id = 1");
        jdbc.update("UPDATE users SET display_name = 'Sam' WHERE id = 2");
        jdbc.update("MERGE INTO topic_state (user_id, topic_id, self_rating, correct_count, wrong_count) KEY (user_id, topic_id) VALUES (1, 2, 3, 0, 0)");
        jdbc.update("MERGE INTO topic_state (user_id, topic_id, self_rating, correct_count, wrong_count) KEY (user_id, topic_id) VALUES (2, 2, 5, 0, 0)");
        try {
            // Startup runs data.sql again; it must rename, not add new learners.
            new ResourceDatabasePopulator(new ClassPathResource("data.sql")).execute(dataSource);

            assertThat(users()).containsExactly(Map.entry(1L, "Rahul"), Map.entry(2L, "Ananya"));
            assertThat(jdbc.queryForObject("SELECT self_rating FROM topic_state WHERE user_id = 1 AND topic_id = 2", Integer.class)).isEqualTo(3);
            assertThat(jdbc.queryForObject("SELECT self_rating FROM topic_state WHERE user_id = 2 AND topic_id = 2", Integer.class)).isEqualTo(5);
        } finally {
            jdbc.update("DELETE FROM topic_state WHERE topic_id = 2 AND user_id IN (1, 2)");
        }
    }

    @Test
    void problemsNoLongerStoreStarterCode() {
        Integer columns = jdbc.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE LOWER(table_name) = 'problems' AND LOWER(column_name) = 'starter_code'",
                Integer.class);
        assertThat(columns).isZero();
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM problems", Integer.class)).isEqualTo(31);
    }

    @Test
    void studyLinksGoStraightToTheTopicArticleNotASearchPage() {
        List<ResourceLink> links = resourceService.linksFor(ErrorCategory.WRONG_ALGORITHM, 6L, "LinkedList");
        assertThat(links.get(0).source()).isEqualTo(ResourceSource.GFG);
        assertThat(links.get(0).url()).isEqualTo("https://www.geeksforgeeks.org/dsa/linked-list-data-structure/");
        assertThat(links).noneMatch(l -> l.url().contains("google."));

        for (long topic = 1; topic <= 10; topic++) {
            ResourceLink gfg = resourceService.linksFor(ErrorCategory.OFF_BY_ONE, topic, "Topic").get(0);
            assertThat(gfg.url()).startsWith("https://www.geeksforgeeks.org/dsa/");
            assertThat(gfg.generated()).isFalse();
        }

        List<ResourceLink> slow = resourceService.linksFor(ErrorCategory.BAD_COMPLEXITY, 10L, "DP");
        assertThat(slow).extracting(ResourceLink::url).contains(
                "https://www.geeksforgeeks.org/dsa/dynamic-programming/",
                "https://www.geeksforgeeks.org/dsa/understanding-time-complexity-simple-examples/");
    }

    private List<Map.Entry<Long, String>> users() {
        return jdbc.query("SELECT id, display_name FROM users ORDER BY id",
                (rs, i) -> Map.entry(rs.getLong("id"), rs.getString("display_name")));
    }
}
