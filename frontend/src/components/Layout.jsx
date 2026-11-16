import { NavLink } from 'react-router-dom'
import { useUser } from '../UserContext.jsx'
import { ErrorBox, Loading } from './Status.jsx'

const LINKS = [
  { to: '/', label: 'Today' },
  { to: '/topics', label: 'Topic map' },
  { to: '/problems', label: 'Problems' },
  { to: '/readiness', label: 'Readiness' },
  { to: '/mistakes', label: 'Mistakes' },
]

export default function Layout({ children }) {
  const { users, userId, setUserId, error, reload } = useUser()

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="font-semibold">DSA Learning Platform</span>
          <nav className="flex flex-wrap gap-1 text-sm">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded ${isActive ? 'bg-moss text-white' : 'text-muted hover:text-ink'}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          {users && (
            <label className="ml-auto text-sm text-muted flex items-center gap-2">
              Learner
              <select
                className="border border-line rounded px-2 py-1 text-ink bg-white"
                value={userId ?? ''}
                onChange={(e) => setUserId(Number(e.target.value))}
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.displayName}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Pages assume a learner is selected, so nothing renders until /api/users has answered. */}
        {error ? <ErrorBox error={error} onRetry={reload} /> : userId ? children : <Loading />}
      </main>
    </div>
  )
}
