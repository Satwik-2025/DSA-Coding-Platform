// Plain-English wording for the readiness numbers. Nothing here changes a number: the backend
// computes readiness and the gap (CONTRACT.md 4.4); these helpers only describe them.

// Readiness is a score from 0 to 100.
export function readinessLevel(readiness) {
  if (readiness == null) {
    return { label: 'Not started', tone: 'muted', advice: 'Solve one question in this topic to get your first score.' }
  }
  if (readiness >= 75) {
    return { label: 'Strong', tone: 'moss', advice: 'You understand this topic well. Try some harder questions to improve further.' }
  }
  if (readiness >= 50) {
    return { label: 'Getting there', tone: 'accent', advice: 'You know the basics. Keep practising to make it stronger.' }
  }
  return { label: 'Needs practice', tone: 'amber', advice: 'This topic needs more work. Start with easy questions and build up slowly.' }
}

// gap = (your rating x 20) - readiness, both out of 100. It is measured in points, not percent.
// Positive: your results are below the level you expect of yourself. Negative: above it.
// overall = true words it for all topics together (the Dashboard) instead of one topic.
export function gapSummary(gap, overall = false) {
  if (gap == null) return null
  const points = Math.round(Math.abs(gap))
  const unit = points === 1 ? 'point' : 'points'
  if (points === 0) {
    return { direction: 'even', points, headline: 'Your results match how ready you feel.', note: 'Good self-check. Keep it up.' }
  }
  if (gap > 0) {
    return {
      direction: 'behind', points,
      headline: `You are ${points} ${unit} behind the level you expected.`,
      note: overall
        ? 'You need more practice. The Readiness page shows which topics to work on.'
        : 'You need more practice in this topic. You are still building your understanding here.',
    }
  }
  return {
    direction: 'ahead', points,
    headline: `You are ${points} ${unit} ahead of the level you expected.`,
    note: overall
      ? 'You are doing better than you think. Your answers show good understanding.'
      : 'You are doing better than you think. You have a good understanding of this topic.',
  }
}

// What to do next in a topic, based on its weakest part. Values are 0 to 1, null = no data yet.
// Returns null when the readiness level's own advice already says it all.
export function nextStep(components, readiness = null) {
  if (!components) return null
  const parts = [
    ['accuracy', components.recentAccuracy],
    ['memory', components.retention],
    ['speed', components.speedVsTarget],
  ].filter(([, v]) => v != null)
  if (parts.length === 0) return null
  const [weakest, value] = parts.reduce((a, b) => (b[1] < a[1] ? b : a))
  if (value >= 0.8) {
    // Answers, memory and speed are all good, so only "practising often" can be holding the score back.
    return readiness != null && readiness >= 75 ? null
      : 'Your answers here are good. Practise on more days each week: that raises your score too.'
  }
  if (weakest === 'accuracy') {
    return 'Many of your recent answers here were wrong. Read the examples carefully and press Run to test your code before you submit.'
  }
  if (weakest === 'memory') {
    return 'You may be starting to forget this topic. Solve one of its questions again to refresh your memory.'
  }
  return 'You are taking longer than the target time. Practise a few more questions in this topic to get quicker.'
}
