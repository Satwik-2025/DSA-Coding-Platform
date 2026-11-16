package com.capstone.dsaplatform;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

/**
 * Starting the context runs schema.sql + data.sql and then Hibernate's
 * ddl-auto=validate, so this one test proves the entities and the SQL agree.
 */
@SpringBootTest
@ActiveProfiles("h2mem") // in-memory: never touches (or locks) the developer's backend/data file
class DsaPlatformApplicationTests {

    @Test
    void contextLoads() {
    }
}
