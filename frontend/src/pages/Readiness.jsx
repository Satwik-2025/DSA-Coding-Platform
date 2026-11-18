import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { dateTime, pct, score } from '../format.js'
import { gapSummary, nextStep, readinessLevel } from '../readinessText.js'
import { EmptyState, ErrorBox, Loading, PageHeader } from '../components/Status.jsx'
import { IconArrowRight, IconGauge } from '../components/Icons.jsx'
import { CHART, useTheme } from '../theme.jsx'

// The four parts of the readiness score and their weights (CONTRACT.md 4.4). Wording only; the
// backend does the maths.
const PARTS = [
  ['35%', 'Right answers', 'How many of your last 10 tries in the topic were correct.'],
  ['30%', 'Memory', 'How well you still remember the topic. It slowly drops when you stop practising it.'],
  ['20%', 'Practising often', 'On how many of the last 14 days you practised any topic.'],
  ['15%', 'Speed', 'How close you get to the target time when you solve a question.'],
]

const TONE = {
  moss: 'border-moss/30 bg-moss-soft text-moss',
  accent: 'border-accent/25 bg-accent-soft text-accent',
  amber: 'border-amber/30 bg-amber-soft text-amber',
  muted: 'border-line text-muted',
}

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
  const daysPractised = consistency == null ? null : Math.round(consistency * 14)

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
        Readiness tells you how prepared you are for coding interviews, topic by topic. It is a score
        from 0 to 100: the higher it is, the more ready you are. It is worked out from your own answers.
      </PageHeader>

      <section className="space-y-4" aria-labelledby="how-title">
        <div>
          <h2 id="how-title" className="text-lg font-semibold text-ink">How your score is worked out</h2>
          <p className="text-sm text-muted mt-1">Four things are added together. The percentage shows how much each one counts.</p>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 stagger">
          {PARTS.map(([weight, name, what]) => (
            <li key={name} className="glass rounded-2xl p-4 space-y-1.5">
              <div className="flex items-baseline gap-2">
                <span className="display text-3xl text-accent tabular-nums">{weight}</span>
                <span className="font-medium text-ink">{name}</span>
              </div>
              <p className="text-sm text-muted leading-snug">{what}</p>
              {name === 'Practising often' && daysPractised != null && (
                <p className="text-xs text-ink">You practised on <span className="font-semibold">{daysPractised} of the last 14 days</span>. This part is the same for every topic.</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">Your score over time</h2>
            <p className="text-sm text-muted mt-1">The line goes up as you solve more questions correctly and keep practising.</p>
          </div>
          {chartData.length >= 2 && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
              <span className="flex items-center gap-2"><span className="h-0.5 w-5 rounded bg-accent" /> Your readiness score</span>
              <span className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-amber" /> How ready you said you feel</span>
            </div>
          )}
        </div>
        {chartData.length < 2 ? (
          <EmptyState icon={<IconGauge />}>Your chart will appear here after you submit two answers or rate yourself twice.</EmptyState>
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
                  formatter={(v) => (v == null ? '—' : `${Number(v).toFixed(1)} out of 100`)}
                />
                <Line dataKey="computed" name="Your readiness score" stroke={c.accent} strokeWidth={2.25} dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: c.accent }} connectNulls />
                <Line dataKey="self" name="How ready you said you feel" stroke={c.amber} strokeWidth={2} strokeDasharray="5 4" dot={false}
                  activeDot={{ r: 4, strokeWidth: 0, fill: c.amber }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-ink">Topic by topic</h2>
          <p className="text-sm text-muted">
            For each topic, pick how ready you feel from 1 (not at all) to 5 (ready for an interview). You can
            rate a topic even before you try it. We then compare your rating with your real results, so you
            can see where you are ahead and where you need more practice.
          </p>
        </div>
        {saveError && <ErrorBox error={saveError} />}
        <ul className="grid gap-4 lg:grid-cols-2 stagger">
          {topics.map((t) => (
            <TopicCard key={t.topicId} t={t} saving={saving === t.topicId} onRate={(n) => rate(t.topicId, n)} />
          ))}
        </ul>
        <p className="text-xs text-faint leading-relaxed">
          How the comparison works: your rating of 1 to 5 is turned into a score out of 100 by multiplying it
          by 20 (so 3 becomes 60). That is the level you expect of yourself. We then compare it with your
          readiness score. The difference is in points out of 100, not a percentage.
        </p>
      </section>
    </div>
  )
}

function TopicCard({ t, saving, onRate }) {
  const level = readinessLevel(t.readiness)
  const gap = gapSummary(t.gap)
  const tip = nextStep(t.components, t.readiness)

  return (
    <li className="glass rounded-2xl p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <h3 className="text-base font-semibold text-ink">{t.name}</h3>
          <span className={`inline-flex items-center h-6 px-2.5 rounded-full border text-xs font-medium ${TONE[level.tone]}`}>{level.label}</span>
        </div>
        <div className="text-right">
          <span className="display text-4xl text-ink tabular-nums">{score(t.readiness)}</span>
          {t.readiness != null && <span className="text-xs text-faint"> / 100</span>}
          <p className="text-[11px] text-faint">Readiness score</p>
        </div>
      </div>

      {t.readiness != null && (
        <div className="grid grid-cols-3 gap-3">
          <Meter label="Correct" value={t.components?.recentAccuracy}
            title="Share of your last 10 tries in this topic that were correct" />
          <Meter label="Memory" value={t.components?.retention}
            title="How well you still remember this topic, predicted by the learning model" />
          <Meter label="Speed" value={t.components?.speedVsTarget}
            title="How close you get to the target time on correct answers (100% = on target or faster)" />
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-ink">How ready do you feel?</p>
        <div className={`inline-flex gap-0.5 p-0.5 rounded-xl bg-sunken border border-line transition-opacity ${saving ? 'opacity-50' : ''}`}
          role="group" aria-label={`How ready do you feel in ${t.name}? 1 is not at all, 5 is ready for an interview`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} type="button" disabled={saving} onClick={() => onRate(n)}
              aria-pressed={t.selfRating === n}
              className={`w-9 h-9 rounded-lg text-sm font-medium tabular-nums transition-all duration-200 cursor-pointer disabled:cursor-wait
                ${t.selfRating === n ? 'bg-accent text-accent-ink shadow-sm' : 'text-muted hover:text-ink hover:bg-surface-strong'}`}>
              {n}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-faint">1 = not at all · 5 = ready for an interview</p>
      </div>

      <GapIndicator gap={gap} hasRating={t.selfRating != null} hasScore={t.readiness != null} />

      <div className="rounded-xl px-4 py-3 bg-sunken border border-line text-sm space-y-1">
        <p className="font-medium text-ink">What to do next</p>
        <p className="text-muted">{level.advice}{tip && ` ${tip}`}</p>
        {t.readiness == null && (
          <Link to={`/problems?topicId=${t.topicId}`} className="link inline-flex items-center gap-1 text-sm">
            Practise {t.name} <IconArrowRight size={14} />
          </Link>
        )}
      </div>
    </li>
  )
}

function Meter({ label, value, title }) {
  return (
    <div className="min-w-0" title={title}>
      <div className="flex items-baseline justify-between gap-1">
        <span className="text-[11px] text-muted truncate">{label}</span>
        <span className="text-xs font-medium text-ink tabular-nums">{pct(value)}</span>
      </div>
      <span className="mt-1 block h-1 rounded-full bg-sunken overflow-hidden" aria-hidden="true">
        {value != null && <span className="block h-full rounded-full bg-accent animate-grow-x" style={{ width: `${value * 100}%` }} />}
      </span>
    </div>
  )
}

// Ahead / behind the level the learner expects of themselves (their rating x 20), in points out of 100.
function GapIndicator({ gap, hasRating, hasScore }) {
  if (!gap) {
    return (
      <div className="rounded-xl px-4 py-3 border border-dashed border-line text-sm text-muted">
        {!hasRating && !hasScore && 'Rate yourself and solve a question here to see if you are ahead or behind.'}
        {!hasRating && hasScore && 'Pick how ready you feel above to see if you are ahead or behind.'}
        {hasRating && !hasScore && 'Solve a question in this topic to see if you are ahead or behind.'}
      </div>
    )
  }
  const ahead = gap.direction === 'ahead'
  const behind = gap.direction === 'behind'
  const color = ahead ? 'text-moss' : behind ? 'text-amber' : 'text-ink'
  const fill = ahead ? 'bg-moss' : 'bg-amber'
  // Half the bar = 100 points, so the bar grows from the middle: left when behind, right when ahead.
  const width = `${Math.min(gap.points, 100) / 2}%`

  return (
    <div className={`rounded-xl px-4 py-3 border text-sm space-y-2.5 ${ahead ? 'bg-moss-soft border-moss/20' : behind ? 'bg-amber-soft border-amber/20' : 'bg-sunken border-line'}`}>
      <p className={`font-medium ${color} flex items-center gap-2`}>
        <span aria-hidden="true">{ahead ? '▲' : behind ? '▼' : '●'}</span>
        {gap.headline}
      </p>
      {gap.direction !== 'even' && (
        <div aria-hidden="true">
          <div className="relative h-2 rounded-full bg-surface overflow-hidden">
            <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
            <span className={`absolute inset-y-0 ${fill} rounded-full`} style={ahead ? { left: '50%', width } : { right: '50%', width }} />
          </div>
          <div className="flex justify-between text-[10px] text-faint mt-1">
            <span>Behind</span><span>Your expected level</span><span>Ahead</span>
          </div>
        </div>
      )}
      <p className="text-muted">{gap.note}</p>
    </div>
  )
}
