import { Suspense, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Routes, useLocation } from 'react-router-dom'
import { prefersReducedMotion } from '../theme.jsx'
import { Loading } from './Status.jsx'

// Main sections in navigation order. Moving right in this list slides the new page in from the
// right; moving left slides it in from the left. Sub-pages (a problem) fade up instead.
export const SECTIONS = ['/', '/topics', '/problems', '/plans', '/mock', '/readiness', '/mistakes']

export function sectionIndex(pathname) {
  if (pathname === '/') return 0
  return SECTIONS.findIndex((s, i) => i > 0 && (pathname === s || pathname.startsWith(`${s}/`)))
}

function direction(from, to) {
  const a = sectionIndex(from)
  const b = sectionIndex(to)
  if (a < 0 || b < 0 || a === b) return 0
  return b > a ? 1 : -1
}

let nextId = 0

// Drop-in replacement for <Routes>: while the URL path changes, the outgoing page stays on screen
// for a moment and slides out as the new one slides in. The outgoing page is frozen on its old
// location (so it doesn't re-fetch) and cannot be clicked. Query-string changes (filters) don't animate.
export default function AnimatedRoutes({ children }) {
  const location = useLocation()
  const [pages, setPages] = useState(() => [{ id: nextId++, location, out: false, dir: 0 }])
  const pathRef = useRef(location.pathname)

  useLayoutEffect(() => {
    const prevPath = pathRef.current
    if (location.pathname === prevPath) return
    pathRef.current = location.pathname
    if (prefersReducedMotion()) {
      setPages([{ id: nextId++, location, out: false, dir: 0 }])
      return
    }
    const dir = direction(prevPath, location.pathname)
    setPages((ps) => {
      const current = ps.find((p) => !p.out)
      return [
        { ...current, out: true, dir },
        { id: nextId++, location, out: false, dir },
      ]
    })
  }, [location])

  const removeOld = (id) => setPages((ps) => ps.filter((p) => p.id !== id))

  // animationend is the normal signal, but it never fires if the tab is throttled or animations are
  // paused, so the outgoing page is also removed on a timer just after the exit animation's length.
  const outId = pages.find((p) => p.out)?.id
  useEffect(() => {
    if (outId == null) return
    const t = window.setTimeout(() => removeOld(outId), 320)
    return () => window.clearTimeout(t)
  }, [outId])

  return (
    <div className="relative" style={{ overflowX: 'clip' }}>
      {pages.map((p) =>
        p.out ? (
          <div
            key={p.id}
            className="page-out absolute inset-x-0 top-0 pointer-events-none"
            style={{ '--dir': p.dir }}
            aria-hidden="true"
            inert=""
            onAnimationEnd={(e) => e.target === e.currentTarget && removeOld(p.id)}
          >
            <Suspense fallback={null}><Routes location={p.location}>{children}</Routes></Suspense>
          </div>
        ) : (
          <div key={p.id} className="page-in" style={{ '--dir': p.dir }}>
            {/* Pages are lazy-loaded: the skeleton shows while a page's code downloads. */}
            <Suspense fallback={<Loading />}><Routes location={location}>{children}</Routes></Suspense>
          </div>
        ),
      )}
    </div>
  )
}
