import { beforeEach, describe, expect, it } from 'vitest'
import { clearDraft, loadDraft, saveDraft } from './drafts.js'
import { clearMock, endMock, isActive, pickProblems, recordSubmission, startMock } from './mock.js'

const read = () => JSON.parse(localStorage.getItem('mock:1'))

describe('mock interviews', () => {
  beforeEach(() => localStorage.clear())

  it('counts submissions for problems in the running interview only', () => {
    startMock(1, [3, 7], 45)
    recordSubmission(1, 3, 'WRONG_ANSWER')
    recordSubmission(1, 99, 'ACCEPTED') // not part of the interview
    expect(read().results[3]).toMatchObject({ attempts: 1, solved: false })
    expect(read().results[99]).toBeUndefined()

    recordSubmission(1, 3, 'ACCEPTED')
    expect(read().results[3]).toMatchObject({ attempts: 2, solved: true })
    expect(isActive(read())).toBe(true)
  })

  it('ends by itself when every problem is solved', () => {
    startMock(1, [3, 7], 45)
    recordSubmission(1, 3, 'ACCEPTED')
    recordSubmission(1, 7, 'ACCEPTED')
    expect(read().endedAt).not.toBeNull()
    expect(isActive(read())).toBe(false)
  })

  it('is over when the time is up, and can be ended or cleared', () => {
    const s = startMock(1, [3], 30)
    expect(isActive(s, s.startedAt + 29 * 60_000)).toBe(true)
    expect(isActive(s, s.startedAt + 31 * 60_000)).toBe(false)
    endMock(1)
    expect(read().endedAt).not.toBeNull()
    clearMock(1)
    expect(read()).toBeNull()
  })

  it('picks from unlocked topics, unsolved first, ramping difficulty', () => {
    const problems = [
      { id: 1, topicId: 1, difficulty: 'EASY' },
      { id: 2, topicId: 1, difficulty: 'MEDIUM' },
      { id: 3, topicId: 2, difficulty: 'EASY' },
      { id: 4, topicId: 9, difficulty: 'MEDIUM' }, // locked topic
    ]
    const ids = pickProblems(problems, new Set([1, 2]), { 1: 'SOLVED' }, 2)
    expect(ids).toEqual([3, 2])
  })
})

describe('drafts', () => {
  beforeEach(() => localStorage.clear())

  it('keeps one draft per learner, problem and language', () => {
    saveDraft(1, 5, 'JAVA', 'java code')
    saveDraft(1, 5, 'PYTHON', 'python code')
    expect(loadDraft(1, 5, 'JAVA')).toBe('java code')
    expect(loadDraft(1, 5, 'PYTHON')).toBe('python code')
    expect(loadDraft(2, 5, 'JAVA')).toBeNull()
    clearDraft(1, 5, 'JAVA')
    expect(loadDraft(1, 5, 'JAVA')).toBeNull()
  })
})
