import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { dateTime, ERROR_CATEGORY, pct } from '../format.js'
import ResourceList from '../components/ResourceList.jsx'
import { EmptyState, ErrorBox, Loading, PageHeader } from '../components/Status.jsx'
import { IconCheck } from '../components/Icons.jsx'

// Recurring-error profile (CONTRACT.md 5.5). The backend already sorts by count, then most recent.
export default function Mistakes() {
  const { userId } = useUser()
  const weakness = useApi(() => api.weakness(userId), [userId])

  if (weakness.error) return <ErrorBox error={weakness.error} onRetry={weakness.reload} />
  if (!weakness.data) return <Loading />
  const { totalErrorEvents, categories } = weakness.data

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Insights" title="Mistakes">
        Every failed submission is classified into one mistake type. {totalErrorEvents} so far.
      </PageHeader>

      {categories.length === 0 ? (
        <EmptyState icon={<IconCheck />}>No mistakes recorded yet. They show up here after a failed or slow submission.</EmptyState>
      ) : (
        <ul className="space-y-4 stagger">
          {categories.map((c, i) => {
            const info = ERROR_CATEGORY[c.category]
            return (
              <li key={c.category} className="glass rounded-2xl p-5 sm:p-6 grid gap-6 lg:grid-cols-[1fr_minmax(0,22rem)]">
                <div className="space-y-4 min-w-0">
                  <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                    <div className="flex items-center gap-3">
                      <span className="display text-2xl text-faint tabular-nums leading-none">{String(i + 1).padStart(2, '0')}</span>
                      <h2 className="text-lg font-semibold text-ink">{info.label}</h2>
                    </div>
                    <span className="text-xs text-muted pt-1.5">
                      <span className="text-ink font-medium">{c.count} times ({pct(c.share)})</span>, last {dateTime(c.lastSeenAt)}
                    </span>
                  </div>
                  {/* Bar width = share of all mistakes, so the biggest habit is visible at a glance. */}
                  <div className="h-1.5 bg-sunken rounded-full overflow-hidden" aria-hidden="true">
                    <div className="h-full bg-brick rounded-full animate-grow-x" style={{ width: pct(c.share) }} />
                  </div>
                  <p className="text-sm text-muted">{info.hint}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-faint text-xs">Mostly in:</span>
                    {c.topics.map((t) => (
                      <span key={t.topicId} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-line bg-sunken text-xs text-ink">
                        {t.name} <span className="text-faint tabular-nums">({t.count})</span>
                      </span>
                    ))}
                  </div>
                </div>
                {c.resources?.length > 0 && (
                  <div className="min-w-0 lg:border-l lg:border-line lg:pl-6">
                    <h3 className="eyebrow mb-2">Study this</h3>
                    <ResourceList resources={c.resources} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
