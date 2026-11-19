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
  SYNTAX_COMPILATION: { label: 'Code does not run', hint: 'There is a typing (syntax) mistake, so the code could not even start.' },
  OFF_BY_ONE: { label: 'Off by one', hint: 'A loop or index went one step too far, or stopped one step too early.' },
  MISSED_EDGE_CASE: { label: 'Missed a special case', hint: 'Unusual inputs, like an empty list, one item, repeats or negative numbers, were not handled.' },
  WRONG_ALGORITHM: { label: 'Wrong approach', hint: 'The idea behind the solution does not work, even on normal inputs.' },
  STATE_TRANSITION: { label: 'Wrong step-by-step rule', hint: 'The rule that builds each answer from the earlier answers (or the value carried from step to step) is wrong.' },
  BAD_COMPLEXITY: { label: 'Too slow', hint: 'The code took longer than the time limit on a big input. A faster method is needed.' },
  SUBOPTIMAL: { label: 'Slower than it could be', hint: 'The answer is right, but there is a faster way to get it.' },
}
