import { VERDICT } from '../format.js'

const DIFFICULTY_STYLE = {
  EASY: 'bg-moss-soft text-moss',
  MEDIUM: 'bg-amber-soft text-amber',
  HARD: 'bg-brick-soft text-brick',
}

export function DifficultyBadge({ difficulty }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_STYLE[difficulty]}`}>
      {difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}
    </span>
  )
}

export function VerdictBadge({ verdict, size = 'sm' }) {
  const ok = verdict === 'ACCEPTED'
  const style = ok ? 'bg-moss-soft text-moss' : 'bg-brick-soft text-brick'
  const text = size === 'lg' ? 'text-lg px-3 py-1' : 'text-xs px-2 py-0.5'
  return <span className={`rounded font-medium ${style} ${text}`}>{VERDICT[verdict] ?? verdict}</span>
}

export function LockedTag() {
  return <span className="text-xs px-2 py-0.5 rounded border border-line text-muted">Locked</span>
}
