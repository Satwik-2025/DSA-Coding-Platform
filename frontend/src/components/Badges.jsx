import { VERDICT } from '../format.js'
import { IconCheck, IconClose, IconLock } from './Icons.jsx'

const DIFFICULTY_STYLE = {
  EASY: 'bg-moss-soft text-moss border-moss/25',
  MEDIUM: 'bg-amber-soft text-amber border-amber/25',
  HARD: 'bg-brick-soft text-brick border-brick/25',
}

export function DifficultyBadge({ difficulty }) {
  return (
    <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-xs font-medium whitespace-nowrap ${DIFFICULTY_STYLE[difficulty]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
      {difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}
    </span>
  )
}

export function VerdictBadge({ verdict, size = 'sm' }) {
  const ok = verdict === 'ACCEPTED'
  const style = ok ? 'bg-moss-soft text-moss border-moss/30' : 'bg-brick-soft text-brick border-brick/30'
  const text = size === 'lg' ? 'h-9 px-3.5 text-sm gap-2' : 'h-6 px-2.5 text-xs gap-1.5'
  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${style} ${text}`}>
      {ok ? <IconCheck size={size === 'lg' ? 16 : 13} /> : <IconClose size={size === 'lg' ? 16 : 13} />}
      {VERDICT[verdict] ?? verdict}
    </span>
  )
}

export function LockedTag() {
  return (
    <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-line text-faint text-xs whitespace-nowrap">
      <IconLock size={12} /> Locked
    </span>
  )
}
