import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { dateTime, pct } from '../format.js'
import { ErrorBox, Loading, PageHeader } from '../components/Status.jsx'
import { IconArrowRight, IconCheck, IconLock } from '../components/Icons.jsx'

// Hand-placed coordinates instead of a graph-layout library: topic ids are fixed and never
// renumbered (CONTRACT.md 2.1), and every edge points forward, so columns = prerequisite depth.
// Rows are chosen so no arrow passes behind an unrelated node.
const POS = {
  2: [90, 50], 1: [90, 170], 6: [90, 380],     // roots
  3: [300, 120], 5: [300, 230], 7: [300, 330], // depth 1
  4: [510, 50], 8: [510, 380],                 // depth 2
  9: [720, 200], 10: [720, 300],               // depth 3
}
const W = 140
const H = 48

// Green only when retention meets the unlock threshold, so colour = "would this unlock the next topic?"
// Colours are theme variables, applied through style so they switch with the theme.
function nodeStyle(node, minRetention) {
  if (!node.unlocked) return { fill: 'var(--sunken)', stroke: 'var(--line-strong)', text: 'var(--faint)', dash: '5 4' }
  if (node.predictedRetention == null) return { fill: 'var(--surface-strong)', stroke: 'var(--accent)', text: 'var(--ink)' }
  if (node.predictedRetention >= minRetention) return { fill: 'var(--moss-soft)', stroke: 'var(--moss)', text: 'var(--ink)' }
  return { fill: 'var(--amber-soft)', stroke: 'var(--amber)', text: 'var(--ink)' }
}

export default function TopicMap() {
  const { userId } = useUser()
  const graph = useApi(() => api.topicGraph(userId), [userId])
  const retention = useApi(() => api.retention(userId), [userId])
  const [selected, setSelected] = useState(1)

  const error = graph.error || retention.error
  if (error) return <ErrorBox error={error} onRetry={() => { graph.reload(); retention.reload() }} />
  if (!graph.data || !retention.data) return <Loading />

  const { nodes, edges, thresholds } = graph.data
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Learning path" title="Topic map">
        A topic unlocks when every arrow into it comes from a topic with at least{' '}
        {pct(thresholds.minRetention)} predicted retention and {thresholds.minCorrectCount} correct
        answers. Retention fades over time, so a topic can lock again.
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <svg viewBox="0 0 810 420" className="min-w-[640px] w-full" role="img" aria-label="Topic prerequisite graph"
              style={{ fontFamily: 'var(--font-sans)' }}>
              <defs>
                <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--faint)' }} />
                </marker>
                <marker id="arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L10,5 L0,10 z" style={{ fill: 'var(--accent)' }} />
                </marker>
              </defs>
              {edges.map((e) => {
                const [x1, y1] = POS[e.from]
                const [x2, y2] = POS[e.to]
                const active = e.to === selected || e.from === selected
                return (
                  <line key={`${e.from}-${e.to}`} x1={x1 + W / 2} y1={y1} x2={x2 - W / 2} y2={y2}
                    style={{ stroke: active ? 'var(--accent)' : 'var(--line-strong)', transition: 'stroke 250ms' }}
                    strokeWidth={active ? 1.75 : 1.25} markerEnd={active ? 'url(#arrow-active)' : 'url(#arrow)'} />
                )
              })}
              {nodes.map((n) => {
                const [cx, cy] = POS[n.id]
                const s = nodeStyle(n, thresholds.minRetention)
                const isSel = selected === n.id
                return (
                  <g key={n.id} onClick={() => setSelected(n.id)} className="cursor-pointer outline-none group"
                    tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && setSelected(n.id)}
                    role="button" aria-pressed={isSel} aria-label={`${n.name}: ${n.unlocked ? (n.attempted ? `retention ${pct(n.predictedRetention)}` : 'not started') : 'locked'}`}>
                    {isSel && (
                      <rect x={cx - W / 2 - 5} y={cy - H / 2 - 5} width={W + 10} height={H + 10} rx="14"
                        style={{ fill: 'none', stroke: 'var(--accent)', strokeOpacity: 0.35, strokeWidth: 4 }} />
                    )}
                    <rect x={cx - W / 2} y={cy - H / 2} width={W} height={H} rx="11"
                      style={{ fill: s.fill, stroke: isSel ? 'var(--accent)' : s.stroke, transition: 'stroke 200ms, fill 200ms' }}
                      strokeDasharray={s.dash} strokeWidth={isSel ? 1.75 : 1.25}
                      className="group-hover:[stroke-width:1.75] group-focus-visible:[stroke-width:2]" />
                    <text x={cx} y={cy - 3} textAnchor="middle" fontSize="13.5" fontWeight="500" style={{ fill: s.text }}>{n.name}</text>
                    <text x={cx} y={cy + 14} textAnchor="middle" fontSize="11" style={{ fill: 'var(--muted)' }}>
                      {n.unlocked ? (n.attempted ? `retention ${pct(n.predictedRetention)}` : 'not started') : 'locked'}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
          <Legend />
        </div>

        <TopicDetail
          key={selected}
          node={byId[selected]}
          detail={retention.data.topics.find((t) => t.topicId === selected)}
          prerequisites={edges.filter((e) => e.to === selected).map((e) => byId[e.from])}
          thresholds={thresholds}
        />
      </div>
    </div>
  )
}

function Legend() {
  const item = (fill, stroke, label, dash) => (
    <span className="flex items-center gap-2">
      <svg width="20" height="14" aria-hidden="true">
        <rect x="1" y="1" width="18" height="12" rx="4" style={{ fill, stroke }} strokeDasharray={dash} />
      </svg>
      {label}
    </span>
  )
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 px-5 py-3 border-t border-line text-xs text-muted">
      {item('var(--moss-soft)', 'var(--moss)', 'Retained')}
      {item('var(--amber-soft)', 'var(--amber)', 'Fading')}
      {item('var(--surface-strong)', 'var(--accent)', 'Unlocked, not started')}
      {item('var(--sunken)', 'var(--line-strong)', 'Locked', '3 2')}
    </div>
  )
}

function TopicDetail({ node, detail, prerequisites, thresholds }) {
  // Explains the backend's unlocked flag; the backend stays the authority on the actual decision.
  const passes = (p) => (p.predictedRetention ?? 0) >= thresholds.minRetention && p.correctCount >= thresholds.minCorrectCount

  return (
    <aside className="glass rounded-2xl p-6 space-y-6 text-sm lg:sticky lg:top-8 animate-fade-up">
      <div className="space-y-3">
        <span className={`inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-xs font-medium
          ${node.unlocked ? 'border-moss/30 bg-moss-soft text-moss' : 'border-line text-faint'}`}>
          {node.unlocked ? <IconCheck size={12} /> : <IconLock size={12} />}
          {node.unlocked ? 'Unlocked' : 'Locked'}
        </span>
        <h2 className="display text-3xl text-ink">{node.name}</h2>
      </div>

      {prerequisites.length > 0 && (
        <div>
          <h3 className="eyebrow mb-2">Needs first</h3>
          <ul className="space-y-1.5">
            {prerequisites.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 bg-sunken border border-line">
                <span className="text-ink">{p.name}</span>
                <span className={`text-xs tabular-nums ${passes(p) ? 'text-moss' : 'text-amber'}`}>
                  {pct(p.predictedRetention)}, {p.correctCount} correct
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail.attempted ? (
        <dl className="grid grid-cols-2 gap-2">
          <Stat label="Predicted retention" value={pct(detail.predictedRetention)} />
          <Stat label="Half-life" value={`${detail.halfLifeDays?.toFixed(1)} days`} />
          <Stat label="Correct / wrong" value={`${detail.correctCount} / ${detail.wrongCount}`} />
          <Stat label="Mean difficulty" value={`${detail.meanDifficulty?.toFixed(2)} of 3`} />
          <Stat label="Last practised" value={dateTime(detail.lastPracticedAt)} wide />
          <Stat label="Days since" value={detail.daysSinceLastPractice?.toFixed(1)} />
        </dl>
      ) : (
        <p className="text-muted rounded-xl px-4 py-3 bg-sunken border border-line">No attempts yet, so there is no retention estimate.</p>
      )}

      <Link to={`/problems?topicId=${node.id}`} className="btn btn-primary w-full">
        Practise {node.name} <IconArrowRight size={16} />
      </Link>
    </aside>
  )
}

function Stat({ label, value, wide = false }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 bg-sunken border border-line ${wide ? 'col-span-2' : ''}`}>
      <dt className="text-[11px] text-faint">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink tabular-nums">{value}</dd>
    </div>
  )
}
