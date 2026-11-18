import { describe, expect, it } from 'vitest'
import { problemToPractise, topicToPractise } from './locks.js'
import { gapSummary, nextStep, readinessLevel } from './readinessText.js'

// Arrays(1) -> Two Pointers(3) -> Sliding Window(4) <- Strings(2)
const graph = {
  thresholds: { minRetention: 0.6, minCorrectCount: 2 },
  nodes: [
    { id: 1, name: 'Arrays', unlocked: true, predictedRetention: 0.9, correctCount: 5 },
    { id: 2, name: 'Strings', unlocked: true, predictedRetention: 0.3, correctCount: 1 },
    { id: 3, name: 'Two Pointers', unlocked: false, predictedRetention: null, correctCount: 0 },
    { id: 4, name: 'Sliding Window', unlocked: false, predictedRetention: null, correctCount: 0 },
  ],
  edges: [{ from: 1, to: 3 }, { from: 3, to: 4 }, { from: 2, to: 4 }],
}

describe('locked problems', () => {
  it('recommends an unmet prerequisite that is open', () => {
    expect(topicToPractise(graph, 4).name).toBe('Strings')
  })

  it('never sends the learner to another locked topic', () => {
    const g = { ...graph, edges: [{ from: 1, to: 3 }, { from: 3, to: 4 }] }
    // Two Pointers is unmet AND locked, so look further back; Arrays is met, so fall back to it.
    expect(topicToPractise(g, 4).unlocked).toBe(true)
  })

  it('picks the easiest unsolved problem in that topic', () => {
    const problems = [
      { id: 7, topicId: 2, difficulty: 'MEDIUM' },
      { id: 3, topicId: 2, difficulty: 'EASY' },
      { id: 4, topicId: 2, difficulty: 'EASY' },
      { id: 9, topicId: 1, difficulty: 'EASY' },
    ]
    expect(problemToPractise(problems, new Map(), 2).id).toBe(3)
    expect(problemToPractise(problems, new Map([[3, 'SOLVED']]), 2).id).toBe(4)
    expect(problemToPractise(problems, new Map([[3, 'SOLVED'], [4, 'SOLVED'], [7, 'SOLVED']]), 2).id).toBe(3)
  })
})

describe('readiness wording', () => {
  it('describes the gap in points, the right way round', () => {
    // gap = rating x 20 - readiness: rating 3 (60) vs readiness 80.8 -> results are ahead.
    expect(gapSummary(-20.8)).toMatchObject({ direction: 'ahead', points: 21 })
    expect(gapSummary(-20.8).headline).toBe('You are 21 points ahead of the level you expected.')
    expect(gapSummary(19)).toMatchObject({ direction: 'behind', points: 19 })
    expect(gapSummary(19).headline).not.toMatch('%')
    expect(gapSummary(0.3).direction).toBe('even')
    expect(gapSummary(null)).toBeNull()
  })

  it('labels readiness levels and suggests a next step', () => {
    expect(readinessLevel(null).label).toBe('Not started')
    expect(readinessLevel(80).label).toBe('Strong')
    expect(readinessLevel(60).label).toBe('Getting there')
    expect(readinessLevel(20).label).toBe('Needs practice')
    expect(nextStep({ recentAccuracy: 0.2, retention: 0.9, speedVsTarget: 0.7 })).toMatch(/wrong/)
    expect(nextStep({ recentAccuracy: 0.9, retention: 0.4, speedVsTarget: 0.7 })).toMatch(/forget/)
    expect(nextStep({ recentAccuracy: 0.9, retention: 0.9, speedVsTarget: 0.85 }, 80)).toBeNull()
    expect(nextStep({ recentAccuracy: 0.9, retention: 0.9, speedVsTarget: 0.85 }, 60)).toMatch(/more days/)
  })
})

describe('dashboard gap wording', () => {
  it('does not talk about "this topic" for the overall score', () => {
    expect(gapSummary(-12, true).note).not.toMatch(/topic\./)
    expect(gapSummary(12, true).note).toMatch(/Readiness page/)
  })
})
