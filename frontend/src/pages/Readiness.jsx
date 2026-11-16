import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { dateTime, pct, score, signed } from '../format.js'
import { EmptyState, ErrorBox, Loading, PageHeader } from '../components/Status.jsx'
import { IconGauge } from '../components/Icons.jsx'
import { CHART, useTheme } from '../theme.jsx'

const WEIGHTS = [
  ['35%', 'recent accuracy'],
  ['30%', 'retention'],
  ['20%', 'consistency'],
  ['15%', 'speed'],
]

// CONTRACT.md 4.4 / 5.6 / 5.7: computed readiness vs the learner's own rating, per topic and over time.
export default function Readiness() {
  const { userId } = useUser()
  const { theme } = useTheme()
  const readiness = useApi(() => api.readiness(userId), [userId])
  const [saving, setSaving] = useState(null)
  const [saveError, setSaveError] = useState(null)

  if (readiness.error) return <ErrorBox error={readiness.error} onRetry={readiness.reload} />
  if (!readiness.data) return <Loading />
  const { topics, history, consistency } = readiness.data

  async function rate(topicId, rating) {
    setSaving(topicId)
    setSaveError(null)
    try {
      await api.setSelfRating(userId, topicId, rating)
      readiness.reload() // gap and history both change, so re-read instead of patching locally
    } catch (e) {
      setSaveError(e)
    } finally {
      setSaving(null)
    }
  }

  // Self-rating is 1-5; x20 puts it on the same 0-100 axis as computed readiness (same as the gap formula).
  const chartData = history.map((h) => ({
    at: dateTime(h.takenAt),
    computed: h.overallComputed,
    self: h.overallSelfRating == null ? null : h.overallSelfRating * 20,
  }))
  const c = CHART[theme]

  return (
    <div className="space-y-10">
      <PageHeader eyebrow="Progress" title="Readiness">
        <p className="sr-only">Readiness = 35% recent accuracy + 30% retention + 20% consistency + 15% speed.</p>
        <div className="flex flex-wrap gap-2 mb-3" aria-hidden="true">
          <span className="text-muted self-center mr-1">Readiness =</span>
          {WEIGHTS.map(([w, what]) => (
            <span key={what} className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full border border-line bg-surface text-xs">
              <span className="font-semibold text-accent tabular-nums">{w}</span>
              <span className="text-muted">{what}</span>
            </span>
          ))}
        </div>
        Consistency is the same for every topic: you practised on {pct(consistency)} of the last 14 days.
      </PageHeader>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-ink">Over time</h2>
          {chartData.length >= 2 && (
            <div className="flex items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-2"><span className="h-0.5 w-5 rounded bg-accent" /> From your results</span>
              <span className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-amber" /> Your self-rating ×20</span>
            </div>
          )}
        </div>
        {chartData.length < 2 ? (
          <EmptyState icon={<IconGauge />}>The chart appears after two submissions or self-ratings.</EmptyState>
        ) : (
          <div className="glass rounded-2xl p-4 sm:p-6 h-80 animate-fade-up">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <CartesianGrid stroke={c.grid} vertical={false} />
                <XAxis dataKey="at" tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={{ stroke: c.grid }} minTickGap={40} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: c.axis }} tickLine={false} axisLine={false} />
                <Tooltip
                  cursor={{ stroke: c.grid, strokeWidth: 1 }}
                  contentStyle={{
                    background: 'var(--surface-strong)', border: '1px solid var(--line-strong)', borderRadius: 12,
                    boxShadow: 'var(--shadow-pop)', backdropFilter: 'blur(20px)', fontSize: 12, color: 'var(--ink)',
                  }}
                  labelStyle={{ color: 'var(--muted)', marginBottom: 4 }}
                  itemStyle={{ color: 'var(--ink)' }}
                />
                <Line dataKey="computed" name="From your results" stroke={c.accent} strokeWidth={2.25} dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: c.accent }} connectNulls />
                <Line dataKey="self" name="Your self-rating ×20" stroke={c.amber} strokeWidth={2} strokeDasharray="5 4" dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: c.amber }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">By topic</h2>
          <p className="text-sm text-muted mt-1">Rate how ready you feel (1 = not at all, 5 = interview-ready). You can rate topics you haven't tried.</p>
        </div>
        {saveError && <ErrorBox error={saveError} />}
        <div className="glass rounded-2xl overflow-x-auto">
          <table className="data-table min-w-[760px]">
            <thead>
              <tr>
                <th>Topic</th>
                <th>Readiness</th>
                <th>Accuracy</th>
                <th>Retention</th>
                <th>Speed</th>
                <th>Your rating</th>
                <th className="text-right!">Gap</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => (
                <tr key={t.topicId}>
                  <td className="font-medium text-ink">{t.name}</td>
                  <td>
                    <span className="flex items-center gap-3">
                      <span className="w-10 font-semibold tabular-nums text-ink">{score(t.readiness)}</span>
                      {t.readiness != null && (
                        <span className="h-1 w-16 rounded-full bg-sunken overflow-hidden" aria-hidden="true">
                          <span className="block h-full rounded-full bg-accent animate-grow-x" style={{ width: `${t.readiness}%` }} />
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="tabular-nums text-muted">{pct(t.components?.recentAccuracy)}</td>
                  <td className="tabular-nums text-muted">{pct(t.components?.retention)}</td>
                  <td className="tabular-nums text-muted">{pct(t.components?.speedVsTarget)}</td>
                  <td>
                    <div className={`inline-flex gap-0.5 p-0.5 rounded-xl bg-sunken border border-line transition-opacity ${saving === t.topicId ? 'opacity-50' : ''}`}
                      role="group" aria-label={`Rate ${t.name}`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} disabled={saving === t.topicId} onClick={() => rate(t.topicId, n)}
                          aria-pressed={t.selfRating === n}
                          className={`w-8 h-8 rounded-lg text-xs font-medium tabular-nums transition-all duration-200 cursor-pointer disabled:cursor-wait
                            ${t.selfRating === n ? 'bg-accent text-accent-ink shadow-sm' : 'text-muted hover:text-ink hover:bg-surface-strong'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className={`text-right tabular-nums font-medium ${t.gap > 0 ? 'text-amber' : 'text-muted'}`}>{signed(t.gap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-faint">Gap = your rating ×20 minus readiness. Positive means you rate yourself higher than your results show.</p>
      </section>
    </div>
  )
}
