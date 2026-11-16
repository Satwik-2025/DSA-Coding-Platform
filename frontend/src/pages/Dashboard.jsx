import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { pct, score, signed } from '../format.js'
import { DifficultyBadge } from '../components/Badges.jsx'
import { EmptyState, ErrorBox, Loading, PageHeader } from '../components/Status.jsx'
import { IconArrowRight, IconSpark } from '../components/Icons.jsx'

// Landing page: "where do I stand?" and "what should I solve next?" (CONTRACT.md 5.6 overall + 5.4).
export default function Dashboard() {
  const { userId, users } = useUser()
  const readiness = useApi(() => api.readiness(userId), [userId])
  const recs = useApi(() => api.recommendations(userId, 5), [userId])
  const name = users?.find((u) => u.id === userId)?.displayName
  const today = new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="space-y-12">
      <section className="space-y-6">
        <PageHeader eyebrow={today} title={`Hi ${name}`} />
        {readiness.error && <ErrorBox error={readiness.error} onRetry={readiness.reload} />}
        {readiness.data && <Overall overall={readiness.data.overall} />}
        {readiness.loading && !readiness.data && <Loading />}
      </section>

      <section>
        <div className="flex items-end justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Solve next</h2>
            <p className="text-sm text-muted mt-1">
              Picked from unlocked topics only. Each reason says what the pick does for you.
            </p>
          </div>
          <Link to="/problems" className="hidden sm:inline-flex btn btn-ghost h-9 px-3 text-xs shrink-0">
            All problems <IconArrowRight size={14} />
          </Link>
        </div>
        {recs.error && <ErrorBox error={recs.error} onRetry={recs.reload} />}
        {recs.loading && !recs.data && <div className="skeleton h-64" />}
        {recs.data && (recs.data.items.length === 0 ? (
          <EmptyState icon={<IconSpark />}>
            No recommendations right now. Browse <Link to="/problems" className="link">all problems</Link> instead.
          </EmptyState>
        ) : (
          <ol className="glass rounded-2xl divide-y divide-line overflow-hidden stagger">
            {recs.data.items.map((item, i) => (
              <li key={item.problemId}>
                <Link
                  to={`/problems/${item.problemId}`}
                  className="group grid grid-cols-[2.25rem_1fr_auto] gap-x-4 gap-y-1 px-4 sm:px-6 py-4 sm:py-5 transition-colors hover:bg-sunken"
                >
                  <span className="display text-2xl text-faint group-hover:text-accent transition-colors tabular-nums leading-none pt-0.5">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0 space-y-1.5">
                    <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-medium text-ink group-hover:text-accent transition-colors">{item.title}</span>
                      <span className="text-xs text-faint">{item.topicName}</span>
                      <DifficultyBadge difficulty={item.difficulty} />
                    </span>
                    <span className="block text-sm text-muted leading-relaxed">{item.reason}</span>
                  </span>
                  <IconArrowRight size={18} className="self-center text-faint transition-all duration-200 group-hover:text-accent group-hover:translate-x-1" />
                </Link>
              </li>
            ))}
          </ol>
        ))}
      </section>
    </div>
  )
}

function Overall({ overall }) {
  // null computed = no attempts yet; the contract says this is "no evidence", not a score of 0.
  if (overall.computed == null) {
    return (
      <EmptyState
        icon={<IconSpark />}
        action={<Link to="/problems" className="btn btn-primary mt-1">Pick a problem <IconArrowRight size={16} /></Link>}
      >
        No readiness score yet. Solve any problem and the platform starts measuring.
      </EmptyState>
    )
  }
  const gapTone = overall.gap == null ? 'text-ink' : overall.gap > 0 ? 'text-amber' : overall.gap < 0 ? 'text-moss' : 'text-ink'
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-3 stagger">
        <Figure
          eyebrow="Readiness"
          value={score(overall.computed)}
          label="Readiness from your submissions (0–100)"
          bar={overall.computed}
          highlight
        />
        <Figure
          eyebrow="Self-rating"
          value={overall.selfRatingScaled == null ? '—' : score(overall.selfRatingScaled)}
          label="What you rated yourself, scaled to 0–100"
          bar={overall.selfRatingScaled}
        />
        <Figure eyebrow="Gap" value={signed(overall.gap)} label={gapText(overall.gap)} tone={gapTone} />
      </div>
      <p className="text-sm text-muted px-1">
        Based on {pct(overall.evidenceCoverage)} of topics. <Link to="/readiness" className="link">See the breakdown</Link>
      </p>
    </div>
  )
}

function gapText(gap) {
  if (gap == null) return 'Gap: rate yourself on the Readiness page to see it'
  if (gap > 0) return 'Gap: you rate yourself higher than your results show'
  if (gap < 0) return 'Gap: your results are better than you think'
  return 'Gap: your self-rating matches your results'
}

function Figure({ eyebrow, value, label, bar, highlight = false, tone = 'text-ink' }) {
  return (
    <div className={`glass rounded-2xl p-5 sm:p-6 flex flex-col gap-3 relative overflow-hidden ${highlight ? 'ring-1 ring-accent/20' : ''}`}>
      {highlight && <span aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />}
      <span className="eyebrow">{eyebrow}</span>
      <span className={`display text-5xl tabular-nums ${tone}`}>{value}</span>
      {bar != null && (
        <span className="h-1 rounded-full bg-sunken overflow-hidden" aria-hidden="true">
          <span className="block h-full rounded-full bg-accent animate-grow-x" style={{ width: `${Math.max(0, Math.min(100, bar))}%` }} />
        </span>
      )}
      <span className="text-sm text-muted leading-snug">{label}</span>
    </div>
  )
}
