import { useEffect, useRef, useState } from 'react'
import { IconHourglass, IconMinus, IconPause, IconPlay, IconPlus, IconRefresh, IconStopwatch } from './Icons.jsx'

// Personal stopwatch (counts up) and countdown timer for the solve page. Purely a study aid: it
// does not change the timeSpentSeconds sent with a submission, which ProblemSolve measures itself.
//
// Time is computed from timestamps (not by counting ticks), so it stays accurate when the tab is in
// the background, and the state is kept per problem in sessionStorage so a refresh doesn't lose it.

const PRESETS = [10, 15, 20, 30, 45, 60]
const MAX_MINUTES = 180

// status: idle | running | paused | done
const fresh = (mode = 'stopwatch', minutes = 30) => ({ mode, minutes, status: 'idle', startedAt: null, elapsedBefore: 0 })

function load(key) {
  try {
    const s = JSON.parse(sessionStorage.getItem(key))
    if (s && (s.mode === 'stopwatch' || s.mode === 'timer')) {
      // A countdown that ran out while the page was closed shows as finished, without a sound.
      if (s.mode === 'timer' && s.status === 'running' && s.elapsedBefore + Date.now() - s.startedAt >= s.minutes * 60000) {
        return { ...s, status: 'done', startedAt: null, elapsedBefore: s.minutes * 60000 }
      }
      return s
    }
  } catch {
    // Unreadable or blocked storage: start clean.
  }
  return fresh()
}

// 0:00 style under an hour, 1:02:03 above. Countdowns round up so "00:01" shows until the very end.
export function formatClock(ms, roundUp = false) {
  const total = Math.max(0, roundUp ? Math.ceil(ms / 1000) : Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const sec = total % 60
  const pad = (n) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

// Three short soft beeps through Web Audio, so no sound file is needed.
function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    const ctx = new Ctx()
    ;[0, 0.32, 0.64].forEach((t) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      const at = ctx.currentTime + t
      gain.gain.setValueAtTime(0.0001, at)
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.26)
      osc.connect(gain).connect(ctx.destination)
      osc.start(at)
      osc.stop(at + 0.28)
    })
    window.setTimeout(() => ctx.close(), 1500)
  } catch {
    // No audio available: the visual "Time's up" state is still shown.
  }
}

export default function SolveTimer({ problemId }) {
  const key = `solve-timer:${problemId}`
  const [s, setS] = useState(() => load(key))
  const [open, setOpen] = useState(false)
  const [view, setView] = useState(s.mode)
  const [now, setNow] = useState(() => Date.now())
  const rootRef = useRef(null)

  useEffect(() => {
    try { sessionStorage.setItem(key, JSON.stringify(s)) } catch { /* not remembered */ }
  }, [key, s])

  // Re-render a few times a second while running; the value itself comes from timestamps.
  useEffect(() => {
    if (s.status !== 'running') return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [s.status])

  const elapsed = s.elapsedBefore + (s.status === 'running' ? Math.max(0, now - s.startedAt) : 0)
  const remaining = s.minutes * 60000 - elapsed
  const running = s.status === 'running'
  const done = s.status === 'done'
  const active = s.status !== 'idle'

  // Countdown reached zero.
  useEffect(() => {
    if (s.mode === 'timer' && running && remaining <= 0) {
      setS((p) => ({ ...p, status: 'done', startedAt: null, elapsedBefore: p.minutes * 60000 }))
      chime()
    }
  }, [s.mode, running, remaining])

  // Close the panel on outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const start = (mode) => {
    const t = Date.now()
    setS((p) => ({ ...fresh(mode, p.minutes), status: 'running', startedAt: t }))
    setNow(t)
    setOpen(false)
  }
  const pause = () => setS((p) => ({ ...p, status: 'paused', elapsedBefore: p.elapsedBefore + Date.now() - p.startedAt, startedAt: null }))
  const resume = () => { const t = Date.now(); setS((p) => ({ ...p, status: 'running', startedAt: t })); setNow(t) }
  const reset = () => setS((p) => fresh(p.mode, p.minutes))
  // Accepts a number or an updater (m => m + 5), so quick repeated steps build on each other.
  const setMinutes = (m) => setS((p) => {
    const next = typeof m === 'function' ? m(p.minutes) : m
    return { ...p, minutes: Math.min(MAX_MINUTES, Math.max(1, Math.round(next) || 1)) }
  })

  const clock = s.mode === 'timer' ? formatClock(remaining, true) : formatClock(elapsed)
  const ModeIcon = s.mode === 'timer' ? IconHourglass : IconStopwatch
  const togglePanel = () => { if (!open) setView(s.mode); setOpen((o) => !o) }

  return (
    <div ref={rootRef} className="relative flex items-center">
      {!active ? (
        <button type="button" onClick={togglePanel} aria-expanded={open} aria-haspopup="dialog"
          className="btn btn-ghost h-9 px-3 text-xs">
          <IconStopwatch size={16} /> Stopwatch / timer
        </button>
      ) : (
        <div className={`flex items-center h-9 gap-0.5 rounded-xl border pl-1 pr-1 transition-colors
          ${done ? 'border-brick/40 bg-brick-soft text-brick animate-pulse-soft' : 'border-line bg-surface text-ink'}`}>
          <button type="button" onClick={togglePanel} aria-expanded={open} aria-haspopup="dialog"
            aria-label={`${s.mode === 'timer' ? 'Timer' : 'Stopwatch'} ${done ? "time's up" : clock}${running ? '' : ', paused'}. Open controls`}
            className="flex items-center gap-2 h-7 px-2 rounded-lg hover:bg-sunken transition-colors">
            <ModeIcon size={15} className={done ? '' : running ? 'text-accent' : 'text-faint'} />
            <span role="timer" className={`font-mono text-sm tabular-nums ${!running && !done ? 'text-muted' : ''}`}>
              {done ? "Time's up" : clock}
            </span>
          </button>
          {!done && (
            <button type="button" onClick={running ? pause : resume} aria-label={running ? 'Pause' : 'Resume'} title={running ? 'Pause' : 'Resume'}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-sunken transition-colors">
              {running ? <IconPause size={15} /> : <IconPlay size={14} />}
            </button>
          )}
          <button type="button" onClick={reset} aria-label="Reset" title="Reset"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-sunken transition-colors">
            <IconRefresh size={14} />
          </button>
        </div>
      )}

      <span className="sr-only" aria-live="assertive">{done ? "Time's up" : ''}</span>

      {open && (
        <div role="dialog" aria-label="Stopwatch and timer"
          className="glass-strong animate-pop-in absolute right-0 top-full mt-2 z-50 w-[19rem] rounded-2xl p-4 space-y-4">
          <div className="grid grid-cols-2 p-1 rounded-xl bg-sunken border border-line text-xs font-medium" role="tablist">
            {[['stopwatch', 'Stopwatch', IconStopwatch], ['timer', 'Timer', IconHourglass]].map(([m, label, I]) => (
              <button key={m} type="button" role="tab" aria-selected={view === m} onClick={() => setView(m)}
                className={`flex items-center justify-center gap-1.5 h-8 rounded-lg transition-colors
                  ${view === m ? 'bg-surface-strong text-ink shadow-sm border border-line-strong' : 'text-faint hover:text-ink'}`}>
                <I size={14} /> {label}
              </button>
            ))}
          </div>

          {view === 'stopwatch' ? (
            <StopwatchPanel
              isCurrent={s.mode === 'stopwatch' && active}
              running={running}
              display={s.mode === 'stopwatch' ? formatClock(elapsed) : '00:00'}
              onStart={() => start('stopwatch')} onPause={pause} onResume={resume} onReset={reset}
            />
          ) : (
            <TimerPanel
              isCurrent={s.mode === 'timer' && active}
              running={running}
              done={done}
              minutes={s.minutes}
              display={s.mode === 'timer' && active ? (done ? '00:00' : formatClock(remaining, true)) : formatClock(s.minutes * 60000)}
              onMinutes={setMinutes}
              onStart={() => start('timer')} onPause={pause} onResume={resume} onReset={reset}
            />
          )}
        </div>
      )}
    </div>
  )
}

function BigClock({ children, tone = 'text-ink' }) {
  return <div className={`text-center font-mono text-4xl tabular-nums tracking-tight py-1 ${tone}`}>{children}</div>
}

function Controls({ running, onPause, onResume, onReset }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={running ? onPause : onResume} className="btn btn-primary">
        {running ? <><IconPause size={15} /> Pause</> : <><IconPlay size={14} /> Resume</>}
      </button>
      <button type="button" onClick={onReset} className="btn btn-ghost"><IconRefresh size={14} /> Reset</button>
    </div>
  )
}

function StopwatchPanel({ isCurrent, running, display, onStart, onPause, onResume, onReset }) {
  return (
    <div className="space-y-4">
      <BigClock>{display}</BigClock>
      <p className="text-xs text-muted text-center">Counts up from zero. Pause whenever you step away.</p>
      {isCurrent ? (
        <Controls running={running} onPause={onPause} onResume={onResume} onReset={onReset} />
      ) : (
        <button type="button" onClick={onStart} className="btn btn-primary w-full"><IconPlay size={14} /> Start stopwatch</button>
      )}
    </div>
  )
}

function TimerPanel({ isCurrent, running, done, minutes, display, onMinutes, onStart, onPause, onResume, onReset }) {
  if (isCurrent) {
    return (
      <div className="space-y-4">
        <BigClock tone={done ? 'text-brick' : 'text-ink'}>{display}</BigClock>
        <p className="text-xs text-muted text-center">
          {done ? "Time's up. Reset to start another countdown." : `Counting down from ${minutes} min.`}
        </p>
        {done ? (
          <button type="button" onClick={onReset} className="btn btn-primary w-full"><IconRefresh size={14} /> Reset</button>
        ) : (
          <Controls running={running} onPause={onPause} onResume={onResume} onReset={onReset} />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <BigClock>{display}</BigClock>
      <div className="flex items-center justify-center gap-2">
        <button type="button" onClick={() => onMinutes((m) => m - 5)} aria-label="5 minutes less"
          className="btn btn-ghost h-9 w-9 p-0"><IconMinus size={15} /></button>
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="number" min={1} max={MAX_MINUTES} value={minutes}
            onChange={(e) => onMinutes(Number(e.target.value))}
            className="field h-9 w-16 text-center text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            aria-label="Countdown minutes" />
          min
        </label>
        <button type="button" onClick={() => onMinutes((m) => m + 5)} aria-label="5 minutes more"
          className="btn btn-ghost h-9 w-9 p-0"><IconPlus size={15} /></button>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {PRESETS.map((m) => (
          <button key={m} type="button" onClick={() => onMinutes(m)} aria-pressed={minutes === m}
            className={`h-7 rounded-lg text-xs tabular-nums border transition-colors
              ${minutes === m ? 'bg-accent text-accent-ink border-transparent' : 'border-line text-muted hover:text-ink hover:border-line-strong'}`}>
            {m}
          </button>
        ))}
      </div>
      <button type="button" onClick={onStart} className="btn btn-primary w-full"><IconPlay size={14} /> Start timer</button>
    </div>
  )
}
