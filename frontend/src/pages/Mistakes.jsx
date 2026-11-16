import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { dateTime, ERROR_CATEGORY, pct } from '../format.js'
import ResourceList from '../components/ResourceList.jsx'
import { ErrorBox, Loading } from '../components/Status.jsx'

// Recurring-error profile (CONTRACT.md 5.5). The backend already sorts by count, then most recent.
export default function Mistakes() {
  const { userId } = useUser()
  const weakness = useApi(() => api.weakness(userId), [userId])

  if (weakness.error) return <ErrorBox error={weakness.error} onRetry={weakness.reload} />
  if (!weakness.data) return <Loading />
  const { totalErrorEvents, categories } = weakness.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mistakes</h1>
        <p className="text-sm text-muted mt-1">
          Every failed submission is classified into one mistake type. {totalErrorEvents} so far.
        </p>
      </div>

      {categories.length === 0 ? (
        <p className="text-muted">No mistakes recorded yet. They show up here after a failed or slow submission.</p>
      ) : (
        <ul className="space-y-4">
          {categories.map((c) => {
            const info = ERROR_CATEGORY[c.category]
            return (
              <li key={c.category} className="bg-white border border-line rounded p-4 space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-semibold">{info.label}</h2>
                  <span className="text-sm text-muted">{c.count} times ({pct(c.share)}), last {dateTime(c.lastSeenAt)}</span>
                </div>
                {/* Bar width = share of all mistakes, so the biggest habit is visible at a glance. */}
                <div className="h-2 bg-paper rounded">
                  <div className="h-2 bg-brick rounded" style={{ width: pct(c.share) }} />
                </div>
                <p className="text-sm text-muted">{info.hint}</p>
                <p className="text-sm">
                  Mostly in: {c.topics.map((t) => `${t.name} (${t.count})`).join(', ')}
                </p>
                <ResourceList resources={c.resources} />
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
