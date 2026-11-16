// Display helpers. null always shows as a dash: the contract uses null for "no evidence yet",
// which is different from 0.

export const DASH = '—'

export const pct = (x) => (x == null ? DASH : `${Math.round(x * 100)}%`)

// Readiness and gap are already 0-100 with 1 decimal (CONTRACT.md section 0).
export const score = (x) => (x == null ? DASH : x.toFixed(1))

export const signed = (x) => (x == null ? DASH : `${x > 0 ? '+' : ''}${x.toFixed(1)}`)

export const dateTime = (iso) =>
  iso == null ? DASH : new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

// Plain-language names for the contract enums (CONTRACT.md section 1).
export const VERDICT = {
  ACCEPTED: 'Accepted',
  WRONG_ANSWER: 'Wrong answer',
  COMPILE_ERROR: 'Compile error',
  RUNTIME_ERROR: 'Runtime error',
  TIME_LIMIT_EXCEEDED: 'Time limit exceeded',
}

export const ERROR_CATEGORY = {
  SYNTAX_COMPILATION: { label: 'Compilation', hint: 'The code does not compile.' },
  OFF_BY_ONE: { label: 'Off by one', hint: 'Index or bound errors at the limits of the input.' },
  MISSED_EDGE_CASE: { label: 'Missed edge case', hint: 'Empty, single-element, duplicate or negative inputs are not handled.' },
  WRONG_ALGORITHM: { label: 'Wrong approach', hint: 'The approach is wrong even on typical inputs.' },
  STATE_TRANSITION: { label: 'DP state transition', hint: 'The recurrence or state update is wrong.' },
  BAD_COMPLEXITY: { label: 'Too slow', hint: 'Exceeded the time limit.' },
  SUBOPTIMAL: { label: 'Slower than optimal', hint: 'Correct, but slower than the reference solution.' },
}
