import { Link, useLocation } from 'react-router-dom'
import { endsAt, isActive, useMock, useNow } from '../mock.js'
import { formatClock } from './SolveTimer.jsx'
import { IconArrowRight, IconStopwatch } from './Icons.jsx'

// While a mock interview runs, a slim bar on every page shows the time left and progress.
export default function MockBanner({ userId }) {
  const session = useMock(userId)
  const now = useNow()
  const { pathname } = useLocation()
  if (!session || pathname === '/mock') return null

  const active = isActive(session, now)
  const solved = session.problemIds.filter((id) => session.results[id]?.solved).length
  const left = endsAt(session) - now
  return (
    <div className={`glass rounded-2xl mb-6 px-4 h-12 flex items-center gap-3 text-sm animate-fade-up
      ${active && left < 5 * 60_000 ? 'ring-1 ring-brick/30' : ''}`} role="status">
      <IconStopwatch size={17} className={active ? 'text-accent' : 'text-faint'} />
      <span className="font-medium text-ink">Mock interview</span>
      {active ? (
        <>
          <span className={`font-mono tabular-nums ${left < 5 * 60_000 ? 'text-brick' : 'text-ink'}`}>{formatClock(left, true)}</span>
          <span className="hidden sm:inline text-muted">left · {solved}/{session.problemIds.length} solved</span>
        </>
      ) : (
        <span className="text-muted">finished · {solved}/{session.problemIds.length} solved</span>
      )}
      <Link to="/mock" className="ml-auto inline-flex items-center gap-1 text-xs link">
        {active ? 'Open' : 'See results'} <IconArrowRight size={13} />
      </Link>
    </div>
  )
}
