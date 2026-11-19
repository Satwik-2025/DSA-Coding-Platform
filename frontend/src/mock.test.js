import { beforeEach, describe, expect, it } from 'vitest'
import { forgetSavedCode, preferredLanguage, setPreferredLanguage } from './drafts.js'
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

  it('keeps to a chosen difficulty, filling from locked topics when needed', () => {
    const problems = [
      { id: 1, topicId: 1, difficulty: 'EASY' },
      { id: 2, topicId: 1, difficulty: 'MEDIUM' },
      { id: 3, topicId: 2, difficulty: 'MEDIUM' },
      { id: 4, topicId: 9, difficulty: 'MEDIUM' }, // locked topic
    ]
    const unlocked = new Set([1, 2])
    const two = pickProblems(problems, unlocked, { 2: 'SOLVED' }, 2, 'MEDIUM')
    expect(two).toEqual([3, 2]) // unlocked first, unsolved before solved
    const three = pickProblems(problems, unlocked, {}, 3, 'MEDIUM')
    expect(three.sort()).toEqual([2, 3, 4]) // the locked-topic one fills the gap
    expect(pickProblems(problems, unlocked, {}, 2, 'HARD')).toEqual([])
  })
})

describe('saved code', () => {
  beforeEach(() => localStorage.clear())

  it('removes code saved by older versions and keeps everything else', () => {
    localStorage.setItem('draft:1:5:JAVA', 'old java code')
    localStorage.setItem('draft:2:7:PYTHON', 'old python code')
    localStorage.setItem('theme', 'dark')
    setPreferredLanguage('PYTHON')
    forgetSavedCode()
    expect(localStorage.getItem('draft:1:5:JAVA')).toBeNull()
    expect(localStorage.getItem('draft:2:7:PYTHON')).toBeNull()
    expect(localStorage.getItem('theme')).toBe('dark')
    expect(preferredLanguage()).toBe('PYTHON')
  })
})
