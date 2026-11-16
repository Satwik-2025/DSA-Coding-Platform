import { IconAlert, IconRefresh } from './Icons.jsx'

// Skeleton placeholder while data loads; the text is kept for screen readers.
export function Loading({ text = 'Loading…' }) {
  return (
    <div role="status" aria-live="polite" className="space-y-4 animate-fade-up">
      <span className="sr-only">{text}</span>
      <div className="skeleton h-9 w-56" />
      <div className="skeleton h-4 w-full max-w-xl" />
      <div className="grid gap-4 sm:grid-cols-3 pt-2">
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
        <div className="skeleton h-28" />
      </div>
      <div className="skeleton h-48" />
    </div>
  )
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div role="alert" className="glass animate-fade-up rounded-2xl p-4 sm:p-5 flex gap-3 items-start border-brick/30! bg-brick-soft!">
      <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-brick-soft text-brick">
        <IconAlert size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink leading-relaxed break-words">{error.message}</p>
        {onRetry && (
          <button onClick={onRetry} className="btn btn-ghost h-8 px-3 mt-3 text-xs">
            <IconRefresh size={14} /> Try again
          </button>
        )}
      </div>
    </div>
  )
}

// Friendly placeholder for "nothing here yet" states.
export function EmptyState({ icon, children, action }) {
  return (
    <div className="glass rounded-2xl px-6 py-10 text-center flex flex-col items-center gap-3 animate-fade-up">
      {icon && (
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">{icon}</span>
      )}
      <p className="text-sm text-muted max-w-md leading-relaxed">{children}</p>
      {action}
    </div>
  )
}

// Page title block used by every page: small eyebrow, serif title, optional description.
export function PageHeader({ eyebrow, title, children, aside }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="display text-4xl sm:text-5xl text-ink">{title}</h1>
        {children && <div className="text-sm text-muted mt-3 leading-relaxed">{children}</div>}
      </div>
      {aside}
    </header>
  )
}

export function Spinner({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="animate-spin-slow" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  )
}
