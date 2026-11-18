// Helpers for problems in locked topics. A lock is a recommendation, not a wall: the learner is told
// what to practise first and can still choose to open the problem. The backend's `unlocked` flag
// (CONTRACT.md 5.8) stays the only authority on whether a topic is locked.

const RANK = { EASY: 0, MEDIUM: 1, HARD: 2 }

// Same rule the backend uses to unlock the next topic: remembered well enough and solved often enough.
export function prerequisiteMet(node, thresholds) {
  return (node.predictedRetention ?? 0) >= thresholds.minRetention && node.correctCount >= thresholds.minCorrectCount
}

export function prerequisitesOf(graph, topicId) {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))
  return graph.edges.filter((e) => e.to === topicId).map((e) => byId.get(e.from)).filter(Boolean)
}

// The topic to practise first: a prerequisite that is not met yet. If that prerequisite is itself
// locked, look one step further back, so the learner is never sent to another locked topic.
export function topicToPractise(graph, topicId, seen = new Set()) {
  if (seen.has(topicId)) return null
  seen.add(topicId)
  const prereqs = prerequisitesOf(graph, topicId).sort((a, b) => a.id - b.id)
  for (const p of prereqs) {
    if (prerequisiteMet(p, graph.thresholds)) continue
    if (p.unlocked) return p
    const deeper = topicToPractise(graph, p.id, seen)
    if (deeper) return deeper
  }
  return prereqs.find((p) => p.unlocked) ?? null
}

// In that topic: the easiest problem not solved yet, or the easiest one if all are solved
// (solving it again keeps the topic fresh in memory).
export function problemToPractise(problems, statusById, topicId) {
  const inTopic = problems
    .filter((p) => p.topicId === topicId)
    .sort((a, b) => RANK[a.difficulty] - RANK[b.difficulty] || a.id - b.id)
  return inTopic.find((p) => statusById.get(p.id) !== 'SOLVED') ?? inTopic[0] ?? null
}
