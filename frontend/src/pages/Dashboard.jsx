import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { pct, score } from '../format.js'
import { gapSummary } from '../readinessText.js'
import { DifficultyBadge } from '../components/Badges.jsx'
import { EmptyState, ErrorBox, Loading, PageHeader } from '../components/Status.jsx'
import { IconArrowRight, IconRefresh, IconSpark } from '../components/Icons.jsx'
import ActivityHeatmap from '../components/ActivityHeatmap.jsx'

// Landing page: "where do I stand?" and "what should I solve next?" (CONTRACT.md 5.6 overall + 5.4).
export default function Dashboard() {
  const { userId, users } = useUser()
  const readiness = useApi(() => api.readiness(userId), [userId])
  const recs = useApi(() => api.recommendations(userId, 5), [userId])
  const review = useApi(() => api.review(userId, 3), [userId])
  const activity = useApi(() => api.activity(userId, 182), [userId])
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

      {review.data && review.data.items.length > 0 && <ReviewQueue review={review.data} />}

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

      <section>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-ink">Activity</h2>
          <p className="text-sm text-muted mt-1">Every day with at least one submission keeps your streak going.</p>
        </div>
        {activity.error && <ErrorBox error={activity.error} onRetry={activity.reload} />}
        {activity.loading && !activity.data && <div className="skeleton h-44" />}
        {activity.data && <ActivityHeatmap activity={activity.data} />}
      </section>
    </div>
  )
}

// Spaced repetition: topics the model says are being forgotten, with a problem to refresh each one.
function ReviewQueue({ review }) {
  return (
    <section>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
          <IconRefresh size={18} className="text-accent" /> Due for review
        </h2>
        <p className="text-sm text-muted mt-1">
          Predicted retention is below {Math.round(review.minRetention * 100)}% (or will be within {review.horizonDays} days).
          A quick re-solve resets the forgetting curve.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
        {review.items.map((it) => (
          <li key={it.topicId} className="glass rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-ink">{it.name}</p>
                <p className="text-xs text-muted mt-0.5">
                  {it.status === 'DUE' ? 'Due now' : `Due in ${it.dueInDays < 1 ? 'under a day' : `${Math.round(it.dueInDays)} day${Math.round(it.dueInDays) === 1 ? '' : 's'}`}`}
                  {' · '}retention {pct(it.predictedRetention)}
                </p>
              </div>
              <span className={`shrink-0 inline-flex items-center h-6 px-2.5 rounded-full border text-[11px] font-medium
                ${it.status === 'DUE' ? 'bg-amber-soft text-amber border-amber/25' : 'bg-sunken text-muted border-line'}`}>
                {it.status === 'DUE' ? 'Due' : 'Soon'}
              </span>
            </div>
            <div className="h-1 rounded-full bg-sunken overflow-hidden" aria-hidden="true">
              <div className={`h-full rounded-full animate-grow-x ${it.status === 'DUE' ? 'bg-amber' : 'bg-accent'}`}
                style={{ width: `${Math.round((it.predictedRetention ?? 0) * 100)}%` }} />
            </div>
            {it.suggestedProblem && (
              <Link to={`/problems/${it.suggestedProblem.id}`}
                className="group mt-auto flex items-center justify-between gap-2 text-sm rounded-xl px-3 py-2 bg-sunken border border-line hover:border-line-strong transition-colors">
                <span className="truncate text-ink group-hover:text-accent transition-colors">{it.suggestedProblem.title}</span>
                <IconArrowRight size={15} className="text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
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
  const gap = gapSummary(overall.gap, true)
  const gapTone = gap?.direction === 'behind' ? 'text-amber' : gap?.direction === 'ahead' ? 'text-moss' : 'text-ink'
  return (
    <div className="space-y-3">
      <div className="grid gap-4 sm:grid-cols-3 stagger">
        <Figure
          eyebrow="Readiness"
          value={score(overall.computed)}
          label="How ready you are, worked out from your answers (0 to 100)"
          bar={overall.computed}
          highlight
        />
        <Figure
          eyebrow="How ready you feel"
          value={overall.selfRatingScaled == null ? '—' : score(overall.selfRatingScaled)}
          label="Your own rating (1 to 5), turned into a score out of 100"
          bar={overall.selfRatingScaled}
        />
        <Figure
          eyebrow={gap?.direction === 'behind' ? 'Points behind' : gap?.direction === 'ahead' ? 'Points ahead' : 'Ahead or behind?'}
          value={gap ? gap.points : '—'}
          label={gap ? `${gap.headline} ${gap.note}` : 'Rate yourself on the Readiness page to see if you are ahead or behind.'}
          tone={gapTone}
        />
      </div>
      <p className="text-sm text-muted px-1">
        Based on the topics you have tried so far ({pct(overall.evidenceCoverage)} of all topics). <Link to="/readiness" className="link">See every topic</Link>
      </p>
    </div>
  )
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
