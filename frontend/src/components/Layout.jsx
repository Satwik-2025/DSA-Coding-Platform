import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useUser } from '../UserContext.jsx'
import { ErrorBox, Loading } from './Status.jsx'
import Select from './Select.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { sectionIndex } from './AnimatedRoutes.jsx'
import {
  IconAlert, IconBook, IconClose, IconCode, IconGauge, IconMap, IconMenu, IconSidebar, IconStopwatch, IconToday, IconUser,
} from './Icons.jsx'
import MockBanner from './MockBanner.jsx'

const LINKS = [
  { to: '/', label: 'Today', icon: IconToday },
  { to: '/topics', label: 'Topic map', icon: IconMap },
  { to: '/problems', label: 'Problems', icon: IconCode },
  { to: '/plans', label: 'Study plans', icon: IconBook },
  { to: '/mock', label: 'Mock interview', icon: IconStopwatch },
  { to: '/readiness', label: 'Readiness', icon: IconGauge },
  { to: '/mistakes', label: 'Mistakes', icon: IconAlert },
]

const ITEM_H = 44 // nav item height + gap, used to slide the active indicator

function readCollapsed() {
  try { return localStorage.getItem('sidebar') === 'collapsed' } catch { return false }
}

export default function Layout({ children }) {
  const { users, userId, setUserId, error, reload } = useUser()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(readCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    try { localStorage.setItem('sidebar', collapsed ? 'collapsed' : 'expanded') } catch { /* not remembered */ }
  }, [collapsed])

  // Close the mobile menu whenever the page changes.
  useEffect(() => { setDrawerOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (e) => e.key === 'Escape' && setDrawerOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  const learnerOptions = users?.map((u) => ({ value: u.id, label: u.displayName })) ?? []
  const learner = users?.find((u) => u.id === userId)
  const switcher = (placement) => users && (
    <Select
      label="Learner"
      icon={<IconUser size={16} className="text-faint" />}
      value={userId ?? ''}
      onChange={(v) => setUserId(Number(v))}
      options={learnerOptions}
      placement={placement}
    />
  )

  return (
    <div
      className="min-h-screen transition-[padding] duration-300 ease-out-soft lg:pl-[var(--sidebar-space)]"
      style={{ '--sidebar-space': collapsed ? '100px' : '284px' }}
    >
      {/* ---------- Desktop sidebar ---------- */}
      <aside
        className="glass hidden lg:flex fixed z-40 top-3 bottom-3 left-3 flex-col rounded-2xl p-3 transition-[width] duration-300 ease-out-soft overflow-hidden"
        style={{ width: collapsed ? 76 : 260 }}
        aria-label="Sidebar"
      >
        <div className={`flex items-center gap-3 h-12 px-1.5 ${collapsed ? 'justify-center' : ''}`}>
          <Brand collapsed={collapsed} />
          {!collapsed && (
            <button type="button" onClick={() => setCollapsed(true)} aria-label="Collapse sidebar" title="Collapse sidebar"
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:text-ink hover:bg-sunken transition-colors">
              <IconSidebar size={17} />
            </button>
          )}
        </div>
        {collapsed && (
          <button type="button" onClick={() => setCollapsed(false)} aria-label="Expand sidebar" title="Expand sidebar"
            className="mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:text-ink hover:bg-sunken transition-colors">
            <IconSidebar size={17} className="rotate-180" />
          </button>
        )}

        <p className={`eyebrow px-3 mt-6 mb-2 transition-opacity duration-200 ${collapsed ? 'opacity-0' : ''}`}>Navigate</p>
        <NavList collapsed={collapsed} pathname={location.pathname} />

        <div className="mt-auto space-y-2 pt-4 border-t border-line">
          {collapsed ? (
            <>
              <button type="button" onClick={() => setCollapsed(false)} title={`Learner: ${learner?.displayName ?? ''} (expand to switch)`}
                aria-label="Expand sidebar to switch learner"
                className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent font-medium text-sm">
                {learner?.displayName?.charAt(0) ?? '·'}
              </button>
              <div className="flex justify-center"><ThemeToggle compact /></div>
            </>
          ) : (
            <>
              {switcher('up')}
              <ThemeToggle />
            </>
          )}
        </div>
      </aside>

      {/* ---------- Mobile / tablet top bar ---------- */}
      <header className="lg:hidden sticky top-0 z-40 px-3 pt-3">
        <div className="glass rounded-2xl h-14 px-3 flex items-center gap-3">
          <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Open menu" aria-expanded={drawerOpen}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:text-ink hover:bg-sunken transition-colors">
            <IconMenu size={20} />
          </button>
          <Brand />
          <div className="ml-auto"><ThemeToggle compact /></div>
        </div>
      </header>

      {/* ---------- Mobile drawer ---------- */}
      <div className="lg:hidden">
        <div
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
          className={`fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${drawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        />
        <aside
          aria-label="Menu"
          aria-hidden={!drawerOpen}
          inert={drawerOpen ? undefined : ''}
          className={`glass-strong fixed z-50 top-3 bottom-3 left-3 w-[min(300px,calc(100vw-24px))] rounded-2xl p-3 flex flex-col
            transition-transform duration-300 ease-out-soft ${drawerOpen ? 'translate-x-0' : '-translate-x-[110%]'}`}
        >
          <div className="flex items-center gap-3 h-12 px-1.5">
            <Brand />
            <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Close menu"
              className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg text-faint hover:text-ink hover:bg-sunken transition-colors">
              <IconClose size={18} />
            </button>
          </div>
          <p className="eyebrow px-3 mt-6 mb-2">Navigate</p>
          <NavList pathname={location.pathname} />
          <div className="mt-auto space-y-2 pt-4 border-t border-line">
            {switcher('up')}
            <ThemeToggle />
          </div>
        </aside>
      </div>

      {/* The solve page gets a wider canvas so the code editor has room; other pages keep a readable width. */}
      <main className={`mx-auto ${/^\/problems\/[^/]+/.test(location.pathname) ? 'max-w-[96rem]' : 'max-w-6xl'} px-4 sm:px-6 lg:px-10 pt-6 pb-16 lg:pt-12`}>
        {/* Pages assume a learner is selected, so nothing renders until /api/users has answered. */}
        {userId && !error && <MockBanner userId={userId} />}
        {error ? <ErrorBox error={error} onRetry={reload} /> : userId ? children : <Loading />}
      </main>
    </div>
  )
}

function Brand({ collapsed = false }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-[0_8px_20px_-10px_var(--accent)]">
        <span className="display text-xl leading-none translate-y-[1px]">D</span>
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block text-sm font-semibold text-ink truncate">DSA Learning</span>
          <span className="block text-[11px] text-faint tracking-wide">Platform</span>
        </span>
      )}
    </div>
  )
}

function NavList({ collapsed = false, pathname }) {
  const active = sectionIndex(pathname)
  return (
    <nav className="relative flex flex-col gap-1 text-sm">
      {/* One highlight that glides to the active item instead of jumping. */}
      {active >= 0 && (
        <span
          aria-hidden="true"
          className="absolute left-0 right-0 top-0 h-10 rounded-xl bg-accent-soft border border-accent/15 transition-transform duration-300 ease-out-soft"
          style={{ transform: `translateY(${active * ITEM_H}px)` }}
        >
          <span className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-r-full bg-accent" />
        </span>
      )}
      {LINKS.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          end={l.to === '/'}
          title={collapsed ? l.label : undefined}
          className={({ isActive }) =>
            `relative z-10 flex items-center gap-3 h-10 rounded-xl transition-colors duration-200
            ${collapsed ? 'justify-center px-0' : 'px-3'}
            ${isActive ? 'text-ink font-medium' : 'text-muted hover:text-ink hover:bg-sunken'}`
          }
        >
          {({ isActive }) => (
            <>
              <l.icon size={18} className={isActive ? 'text-accent' : ''} />
              {!collapsed && <span className="truncate">{l.label}</span>}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
