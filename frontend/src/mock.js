import { useEffect, useState, useSyncExternalStore } from 'react'

// Mock interview sessions live in localStorage (one per learner), so a refresh or switching pages
// never ends one. Components subscribe through useMock(); changes in other tabs are picked up too.
//
// session: { id, problemIds, durationMin, startedAt, endedAt | null,
//            results: { [problemId]: { attempts, solved, solvedAt, lastVerdict } } }

const EVENT = 'mockchange'
const key = (userId) => `mock:${userId}`

function read(userId) {
  try {
    const raw = localStorage.getItem(key(userId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function write(userId, session) {
  try {
    if (session) localStorage.setItem(key(userId), JSON.stringify(session))
    else localStorage.removeItem(key(userId))
  } catch {
    // storage blocked: the session still works for this page view
  }
  cache.delete(userId)
  window.dispatchEvent(new Event(EVENT))
}

// useSyncExternalStore needs a stable snapshot per change, so parsed sessions are cached by raw string.
const cache = new Map()
function snapshot(userId) {
  let raw = null
  try {
    raw = localStorage.getItem(key(userId))
  } catch {
    // ignore
  }
  const hit = cache.get(userId)
  if (hit && hit.raw === raw) return hit.value
  const value = raw ? JSON.parse(raw) : null
  cache.set(userId, { raw, value })
  return value
}

function subscribe(callback) {
  window.addEventListener(EVENT, callback)
  window.addEventListener('storage', callback)
  return () => {
    window.removeEventListener(EVENT, callback)
    window.removeEventListener('storage', callback)
  }
}

export function useMock(userId) {
  return useSyncExternalStore(subscribe, () => snapshot(userId))
}

export function endsAt(session) {
  return session.startedAt + session.durationMin * 60_000
}

export function isActive(session, now = Date.now()) {
  return !!session && !session.endedAt && now < endsAt(session)
}

export function startMock(userId, problemIds, durationMin) {
  const session = {
    id: Date.now(),
    problemIds,
    durationMin,
    startedAt: Date.now(),
    endedAt: null,
    results: Object.fromEntries(problemIds.map((id) => [id, { attempts: 0, solved: false, solvedAt: null, lastVerdict: null }])),
  }
  write(userId, session)
  return session
}

export function endMock(userId) {
  const s = read(userId)
  if (s && !s.endedAt) write(userId, { ...s, endedAt: Math.min(Date.now(), endsAt(s)) })
}

export function clearMock(userId) {
  write(userId, null)
}

/** Called after every submission: counts it if it belongs to the running interview. */
export function recordSubmission(userId, problemId, verdict) {
  const s = read(userId)
  if (!isActive(s) || !s.problemIds.includes(problemId)) return
  const r = s.results[problemId] ?? { attempts: 0, solved: false, solvedAt: null }
  const solved = r.solved || verdict === 'ACCEPTED'
  const next = {
    ...s,
    results: {
      ...s.results,
      [problemId]: { attempts: r.attempts + 1, solved, solvedAt: r.solvedAt ?? (solved ? Date.now() : null), lastVerdict: verdict },
    },
  }
  // Everything solved: the interview is over.
  if (next.problemIds.every((id) => next.results[id]?.solved)) next.endedAt = Date.now()
  write(userId, next)
}

/**
 * Picks problems for a new interview: from unlocked topics, unsolved first, one per difficulty
 * step (Easy, then Medium, then Hard/Medium) so the set ramps up like a real interview.
 */
export function pickProblems(problems, unlockedTopicIds, statusById, count) {
  const shuffle = (a) => a.map((x) => [Math.random(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1])
  const rank = (p) => (statusById[p.id] === 'SOLVED' ? 2 : statusById[p.id] === 'ATTEMPTED' ? 1 : 0)
  const pool = shuffle(problems.filter((p) => unlockedTopicIds.has(p.topicId)))
    .sort((a, b) => rank(a) - rank(b))
  const wanted = count === 3 ? ['EASY', 'MEDIUM', 'HARD'] : ['EASY', 'MEDIUM']
  const chosen = []
  for (const d of wanted) {
    const pick = pool.find((p) => !chosen.includes(p) && p.difficulty === d)
      ?? pool.find((p) => !chosen.includes(p) && p.difficulty !== 'EASY')
      ?? pool.find((p) => !chosen.includes(p))
    if (pick) chosen.push(pick)
  }
  return chosen.map((p) => p.id)
}

/** Current time, re-rendering every intervalMs (for countdowns). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}
