package com.capstone.dsaplatform.service;

import static java.nio.charset.StandardCharsets.UTF_8;

import com.capstone.dsaplatform.runner.Language;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Python / C++ starter code per problem, from resources/starters/{slug}/Main.py and main.cpp.
 * They mirror the Java starter in the database: same input parsing and output format, with an
 * empty solve() to fill in. A problem without a file gets a generic read-stdin template.
 */
@Component
public class StarterCatalog {

    private static final String GENERIC_PYTHON = """
            import sys


            def main():
                data = sys.stdin.read().split()
                # TODO: parse the input as described above and print the answer
                print()


            main()
            """;

    private static final String GENERIC_CPP = """
            #include <bits/stdc++.h>
            using namespace std;

            int main() {
                ios::sync_with_stdio(false);
                cin.tie(nullptr);
                // TODO: parse the input as described above and print the answer
                return 0;
            }
            """;

    private final Map<String, String> cache = new ConcurrentHashMap<>();

    public Map<String, String> startersFor(String slug, String javaStarter) {
        Map<String, String> starters = new LinkedHashMap<>();
        starters.put(Language.JAVA.name(), javaStarter);
        starters.put(Language.PYTHON.name(), load(slug, "Main.py", GENERIC_PYTHON));
        starters.put(Language.CPP.name(), load(slug, "main.cpp", GENERIC_CPP));
        return starters;
    }

    private String load(String slug, String file, String fallback) {
        return cache.computeIfAbsent(slug + "/" + file, key -> {
            try (InputStream in = StarterCatalog.class.getResourceAsStream("/starters/" + key)) {
                return in == null ? fallback : new String(in.readAllBytes(), UTF_8);
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });
    }
}
