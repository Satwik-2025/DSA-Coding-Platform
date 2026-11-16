import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { dateTime, pct, score, signed } from '../format.js'
import { ErrorBox, Loading } from '../components/Status.jsx'

// CONTRACT.md 4.4 / 5.6 / 5.7: computed readiness vs the learner's own rating, per topic and over time.
export default function Readiness() {
  const { userId } = useUser()
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

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold">Readiness</h1>
        <p className="text-sm text-muted mt-1">
          Readiness = 35% recent accuracy + 30% retention + 20% consistency + 15% speed.
          Consistency is the same for every topic: you practised on {pct(consistency)} of the last 14 days.
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Over time</h2>
        {chartData.length < 2 ? (
          <p className="text-muted">The chart appears after two submissions or self-ratings.</p>
        ) : (
          <div className="bg-white border border-line rounded p-3 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid stroke="#e3e8e5" />
                <XAxis dataKey="at" tick={{ fontSize: 11 }} minTickGap={40} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line dataKey="computed" name="From your results" stroke="#2f5d50" strokeWidth={2} dot={false} connectNulls />
                <Line dataKey="self" name="Your self-rating ×20" stroke="#9a6512" strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-1">By topic</h2>
        <p className="text-sm text-muted mb-3">Rate how ready you feel (1 = not at all, 5 = interview-ready). You can rate topics you haven't tried.</p>
        {saveError && <ErrorBox error={saveError} />}
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white border border-line">
            <thead className="text-left text-muted border-b border-line">
              <tr>
                <th className="p-3 font-medium">Topic</th>
                <th className="p-3 font-medium">Readiness</th>
                <th className="p-3 font-medium">Accuracy</th>
                <th className="p-3 font-medium">Retention</th>
                <th className="p-3 font-medium">Speed</th>
                <th className="p-3 font-medium">Your rating</th>
                <th className="p-3 font-medium">Gap</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((t) => (
                <tr key={t.topicId} className="border-b border-line last:border-0">
                  <td className="p-3">{t.name}</td>
                  <td className="p-3 font-medium tabular-nums">{score(t.readiness)}</td>
                  <td className="p-3 tabular-nums">{pct(t.components?.recentAccuracy)}</td>
                  <td className="p-3 tabular-nums">{pct(t.components?.retention)}</td>
                  <td className="p-3 tabular-nums">{pct(t.components?.speedVsTarget)}</td>
                  <td className="p-3">
                    <div className="flex gap-1" role="group" aria-label={`Rate ${t.name}`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button key={n} disabled={saving === t.topicId} onClick={() => rate(t.topicId, n)}
                          aria-pressed={t.selfRating === n}
                          className={`w-7 h-7 rounded border ${t.selfRating === n ? 'bg-moss text-white border-moss' : 'border-line hover:border-moss'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </td>
                  <td className={`p-3 tabular-nums ${t.gap > 0 ? 'text-amber' : ''}`}>{signed(t.gap)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted mt-2">Gap = your rating ×20 minus readiness. Positive means you rate yourself higher than your results show.</p>
      </section>
    </div>
  )
}
