import { Link, useLocation } from 'react-router-dom'
import { endsAt, isActive, useMock, useNow } from '../mock.js'
import { formatClock } from './SolveTimer.jsx'
import { IconArrowRight, IconStopwatch } from './Icons.jsx'

// While a mock interview is running, a slim bar on the other pages shows the time left, so the clock
// is visible while solving. Once it has ended, its result is shown only on the Mock interview page.
export default function MockBanner({ userId }) {
  const session = useMock(userId)
  const now = useNow()
  const { pathname } = useLocation()
  if (!session || pathname === '/mock' || !isActive(session, now)) return null

  const solved = session.problemIds.filter((id) => session.results[id]?.solved).length
  const left = endsAt(session) - now
  return (
    <div className={`glass rounded-2xl mb-6 px-4 h-12 flex items-center gap-3 text-sm animate-fade-up
      ${left < 5 * 60_000 ? 'ring-1 ring-brick/30' : ''}`} role="status">
      <IconStopwatch size={17} className="text-accent" />
      <span className="font-medium text-ink">Mock interview</span>
      <span className={`font-mono tabular-nums ${left < 5 * 60_000 ? 'text-brick' : 'text-ink'}`}>{formatClock(left, true)}</span>
      <span className="hidden sm:inline text-muted">left · {solved}/{session.problemIds.length} solved</span>
      <Link to="/mock" className="ml-auto inline-flex items-center gap-1 text-xs link">
        Open <IconArrowRight size={13} />
      </Link>
    </div>
  )
}
