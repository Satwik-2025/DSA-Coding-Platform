package com.capstone.dsaplatform.learner;

import com.capstone.dsaplatform.domain.ErrorCategory;
import com.capstone.dsaplatform.domain.TestTag;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Progressive hints for a failed submission, built from what the evaluator already knows: the
 * mistake category, the topic, the tag of the first failing test, the exception and the language.
 * Ordered from a gentle nudge to a concrete pointer, so the UI can reveal them one at a time.
 * Deterministic on purpose: the same mistake always gets the same advice.
 */
public final class HintGenerator {

    private static final Pattern COMPILE_LINE = Pattern.compile("^\\w+\\.\\w+:(\\d+):", Pattern.MULTILINE);

    // Topic ids are fixed (CONTRACT.md 2.1).
    private static final Map<Long, String> TOPIC_APPROACH = Map.of(
            1L, "Arrays: a single pass that keeps a running value (sum, best-so-far, prefix) usually beats nested loops.",
            2L, "Strings: count characters with an int[26] or a map instead of comparing every pair of positions.",
            3L, "Two pointers: start one pointer at each end (or both at the start) and move only the one that can improve the answer.",
            4L, "Sliding window: grow the right edge every step and shrink the left edge only when the window breaks the rule.",
            5L, "HashMap: store what you have already seen (value -> index, or prefix sum -> count) so each lookup is O(1).",
            6L, "Linked list: keep prev / current / next pointers and re-link one node at a time.",
            7L, "Stack: push openers, and on each closer check that the top of the stack is its matching opener.",
            8L, "Trees: the answer for a node usually comes from the answers for its left and right subtrees.",
            9L, "Graphs: visit each cell once with DFS or BFS and mark it visited before moving on.",
            10L, "DP: define what dp[i] means in one sentence, then write how it follows from smaller indices.");

    private static final Map<Long, String> TOPIC_EDGE_CASES = Map.of(
            1L, "Arrays: try n = 1, all negative numbers, and all equal values.",
            2L, "Strings: try an empty string, a single character, and strings of different lengths.",
            3L, "Two pointers: try an answer at the very first or very last positions, and inputs with no answer.",
            4L, "Sliding window: try k equal to n, and a window that is empty or one character long.",
            5L, "HashMap: try duplicate values, negative numbers, and a target made from the same value twice.",
            6L, "Linked list: what does your code do when head is null, or the list has one node?",
            7L, "Stack: try an empty string, a lone closer such as \")\", and an opener left on the stack at the end.",
            8L, "Trees: try an empty tree and a tree that is a single long chain.",
            9L, "Graphs: try a grid with no land, all land, and a single row or column.",
            10L, "DP: check the base cases dp[0] and dp[1] (and n = 0 or 1) before the main loop.");

    private HintGenerator() {
    }

    public static List<String> hints(ErrorCategory category, Long topicId, TestTag failedTag,
                                     String exceptionType, String language, String message) {
        if (category == null) {
            return List.of();
        }
        List<String> hints = new ArrayList<>();
        switch (category) {
            case SYNTAX_COMPILATION -> {
                Matcher m = message == null ? null : COMPILE_LINE.matcher(message);
                hints.add(m != null && m.find()
                        ? "Start with the first error, on line " + m.group(1) + ": later errors are often caused by it."
                        : "Start with the first compiler error: later errors are often caused by it.");
                hints.add(switch (language == null ? "JAVA" : language) {
                    case "PYTHON" -> "Check indentation, a missing colon after if / for / def, and unbalanced brackets.";
                    default -> "Check for a missing semicolon or brace, a misspelled type, and that the class is still called Main.";
                });
            }
            case OFF_BY_ONE -> {
                hints.add("An index went one step too far. Check every loop bound: should it be < n or <= n?");
                hints.add("The last valid index is length - 1. Look at accesses like a[i + 1] or s.charAt(j) near the end of a loop.");
                if (failedTag == TestTag.BOUNDARY) {
                    hints.add("It failed on a boundary test: try the smallest and largest sizes the constraints allow.");
                }
            }
            case MISSED_EDGE_CASE -> {
                hints.add("Your approach works on typical inputs but not on an unusual one. Think about the extremes.");
                hints.add(TOPIC_EDGE_CASES.getOrDefault(topicId, "Try empty input, a single element, duplicates and negatives."));
            }
            case WRONG_ALGORITHM -> {
                hints.add("Work through the first example by hand and compare each step with what your code does.");
                hints.add("Re-read the output format: spacing, order and true / false spelling must match exactly.");
                hints.add(TOPIC_APPROACH.getOrDefault(topicId, "Write the idea in plain words before changing the code."));
            }
            case STATE_TRANSITION -> {
                if (Long.valueOf(10L).equals(topicId)) {
                    hints.add("The recurrence is off. Say in one sentence what dp[i] stores.");
                    hints.add("Check the base cases first, then which earlier states dp[i] combines (for example dp[i-1] versus dp[i-2] + value).");
                } else {
                    // Problems outside DP can carry this label too (a running value updated wrongly).
                    hints.add("The value you carry from step to step is updated wrongly. Say in one sentence what it should hold after each step.");
                    hints.add("Trace the first example by hand and print that value after every step to see where it drifts.");
                    hints.add(TOPIC_APPROACH.getOrDefault(topicId, "Check how the value is first set up before the loop starts."));
                }
            }
            case BAD_COMPLEXITY -> {
                hints.add("Too slow for the large test. Estimate your time complexity: inputs up to 10^5 need O(n) or O(n log n).");
                hints.add(TOPIC_APPROACH.getOrDefault(topicId, "Look for work that is repeated inside a loop and do it once instead."));
                if ("PYTHON".equals(language)) {
                    hints.add("In Python, read all input at once (sys.stdin.buffer.read().split()) and build output with ' '.join(...).");
                }
            }
            case SUBOPTIMAL -> {
                hints.add("Correct, but slower than the reference solution on the largest input.");
                hints.add(TOPIC_APPROACH.getOrDefault(topicId, "Look for a single pass that avoids repeated work."));
            }
        }
        String exceptionHint = exceptionHint(exceptionType);
        if (exceptionHint != null) {
            hints.add(0, exceptionHint);
        }
        return hints;
    }

    private static String exceptionHint(String exceptionType) {
        if (exceptionType == null) {
            return null;
        }
        return switch (exceptionType) {
            case "NullPointerException" -> "A NullPointerException means something was null: check empty inputs and missing nodes.";
            case "StackOverflowError", "RecursionError" -> "Recursion went too deep. Use a loop with an explicit stack or queue instead.";
            case "ArithmeticException", "ZeroDivisionError", "FloatingPointException" -> "You divided by zero somewhere: guard the divisor.";
            case "NumberFormatException", "ValueError" -> "Parsing failed: read the input exactly in the format the problem describes.";
            case "OutOfMemoryError", "MemoryError" -> "You ran out of memory: avoid building huge lists or strings you do not need.";
            case "SegmentationFault" -> "A segmentation fault usually means an out-of-range index or a null pointer.";
            case "KeyError" -> "A KeyError means you read a dictionary key that was never added: use .get(key, default).";
            case "PermissionError", "AccessControlException", "SecurityException" ->
                    "Solutions cannot use files, the network or other programs: read stdin and print to stdout only.";
            default -> null;
        };
    }
}
