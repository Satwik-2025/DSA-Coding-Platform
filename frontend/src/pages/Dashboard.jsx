import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { pct, score, signed } from '../format.js'
import { DifficultyBadge } from '../components/Badges.jsx'
import { ErrorBox, Loading } from '../components/Status.jsx'

// Landing page: "where do I stand?" and "what should I solve next?" (CONTRACT.md 5.6 overall + 5.4).
export default function Dashboard() {
  const { userId, users } = useUser()
  const readiness = useApi(() => api.readiness(userId), [userId])
  const recs = useApi(() => api.recommendations(userId, 5), [userId])
  const name = users?.find((u) => u.id === userId)?.displayName

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-semibold mb-4">Hi {name}</h1>
        {readiness.error && <ErrorBox error={readiness.error} onRetry={readiness.reload} />}
        {readiness.data && <Overall overall={readiness.data.overall} />}
        {readiness.loading && !readiness.data && <Loading />}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1">Solve next</h2>
        <p className="text-sm text-muted mb-4">
          Picked from unlocked topics only. Each reason says what the pick does for you.
        </p>
        {recs.error && <ErrorBox error={recs.error} onRetry={recs.reload} />}
        {recs.loading && !recs.data && <Loading />}
        {recs.data && (recs.data.items.length === 0 ? (
          <p className="text-muted">No recommendations right now. Browse <Link to="/problems" className="underline">all problems</Link> instead.</p>
        ) : (
          <ol className="divide-y divide-line border-y border-line">
            {recs.data.items.map((item) => (
              <li key={item.problemId} className="py-3 grid gap-1 sm:grid-cols-[20rem_11rem_1fr] sm:items-baseline sm:gap-4">
                <Link to={`/problems/${item.problemId}`} className="font-medium text-moss hover:underline">
                  {item.title}
                </Link>
                <span className="flex gap-2 items-center text-sm">
                  <span className="text-muted">{item.topicName}</span>
                  <DifficultyBadge difficulty={item.difficulty} />
                </span>
                <span className="text-sm text-muted">{item.reason}</span>
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
      <p className="text-muted">
        No readiness score yet. Solve any problem and the platform starts measuring.
        {' '}<Link to="/problems" className="underline text-moss">Pick a problem</Link>
      </p>
    )
  }
  return (
    <div className="grid gap-6 sm:grid-cols-3 border-l-4 border-moss pl-5">
      <Figure value={score(overall.computed)} label="Readiness from your submissions (0–100)" />
      <Figure
        value={overall.selfRatingScaled == null ? '—' : score(overall.selfRatingScaled)}
        label="What you rated yourself, scaled to 0–100"
      />
      <Figure
        value={signed(overall.gap)}
        label={gapText(overall.gap)}
      />
      <p className="sm:col-span-3 text-sm text-muted">
        Based on {pct(overall.evidenceCoverage)} of topics. <Link to="/readiness" className="underline">See the breakdown</Link>
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

function Figure({ value, label }) {
  return (
    <div>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  )
}
