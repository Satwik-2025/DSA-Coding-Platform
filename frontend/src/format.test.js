import { describe, expect, it } from 'vitest'
import { DASH, pct, score, signed } from './format.js'
import { formatClock } from './components/SolveTimer.jsx'
import { sectionIndex } from './components/AnimatedRoutes.jsx'

describe('number formatting', () => {
  it('shows null as a dash, never as 0', () => {
    expect(pct(null)).toBe(DASH)
    expect(score(undefined)).toBe(DASH)
    expect(signed(null)).toBe(DASH)
  })

  it('formats percentages, scores and signed gaps', () => {
    expect(pct(0.456)).toBe('46%')
    expect(score(63.94)).toBe('63.9')
    expect(signed(48.6)).toBe('+48.6')
    expect(signed(-3.9)).toBe('-3.9')
    expect(signed(0)).toBe('0.0')
  })
})

describe('formatClock', () => {
  it('uses mm:ss under an hour and h:mm:ss above', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(65_000)).toBe('01:05')
    expect(formatClock(3_725_000)).toBe('1:02:05')
  })

  it('rounds countdowns up so 00:01 shows until the very end', () => {
    expect(formatClock(200, true)).toBe('00:01')
    expect(formatClock(200)).toBe('00:00')
    expect(formatClock(-5000, true)).toBe('00:00')
  })
})

describe('sectionIndex (page transition direction)', () => {
  it('maps every section and its sub-pages to the navigation order', () => {
    expect(sectionIndex('/')).toBe(0)
    expect(sectionIndex('/topics')).toBe(1)
    expect(sectionIndex('/problems')).toBe(2)
    expect(sectionIndex('/problems/7')).toBe(2)
    expect(sectionIndex('/mistakes')).toBe(6)
    expect(sectionIndex('/nope')).toBe(-1)
  })
})
