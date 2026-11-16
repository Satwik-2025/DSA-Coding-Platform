import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { dateTime, pct } from '../format.js'
import { ErrorBox, Loading } from '../components/Status.jsx'

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
function nodeStyle(node, minRetention) {
  if (!node.unlocked) return { fill: '#ffffff', stroke: '#a7b1ad', text: '#7b878d', dash: '5 4' }
  if (node.predictedRetention == null) return { fill: '#ffffff', stroke: '#2f5d50', text: '#1e2a33' }
  if (node.predictedRetention >= minRetention) return { fill: '#dce8e2', stroke: '#2f5d50', text: '#1e2a33' }
  return { fill: '#f5e8cf', stroke: '#9a6512', text: '#1e2a33' }
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Topic map</h1>
        <p className="text-sm text-muted mt-1">
          A topic unlocks when every arrow into it comes from a topic with at least{' '}
          {pct(thresholds.minRetention)} predicted retention and {thresholds.minCorrectCount} correct
          answers. Retention fades over time, so a topic can lock again.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="bg-white border border-line rounded overflow-x-auto">
          <svg viewBox="0 0 810 420" className="min-w-[640px] w-full" role="img" aria-label="Topic prerequisite graph">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
                <path d="M0,0 L10,5 L0,10 z" fill="#a7b1ad" />
              </marker>
            </defs>
            {edges.map((e) => {
              const [x1, y1] = POS[e.from]
              const [x2, y2] = POS[e.to]
              return (
                <line key={`${e.from}-${e.to}`} x1={x1 + W / 2} y1={y1} x2={x2 - W / 2} y2={y2}
                  stroke="#a7b1ad" strokeWidth="1.5" markerEnd="url(#arrow)" />
              )
            })}
            {nodes.map((n) => {
              const [cx, cy] = POS[n.id]
              const s = nodeStyle(n, thresholds.minRetention)
              return (
                <g key={n.id} onClick={() => setSelected(n.id)} className="cursor-pointer"
                  tabIndex={0} onKeyDown={(ev) => ev.key === 'Enter' && setSelected(n.id)}>
                  <rect x={cx - W / 2} y={cy - H / 2} width={W} height={H} rx="6"
                    fill={s.fill} stroke={s.stroke} strokeDasharray={s.dash}
                    strokeWidth={selected === n.id ? 3 : 1.5} />
                  <text x={cx} y={cy - 4} textAnchor="middle" fontSize="14" fontWeight="500" fill={s.text}>{n.name}</text>
                  <text x={cx} y={cy + 14} textAnchor="middle" fontSize="12" fill={s.text}>
                    {n.unlocked ? (n.attempted ? `retention ${pct(n.predictedRetention)}` : 'not started') : 'locked'}
                  </text>
                </g>
              )
            })}
          </svg>
          <Legend />
        </div>

        <TopicDetail
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
    <span className="flex items-center gap-1.5">
      <svg width="18" height="12"><rect x="1" y="1" width="16" height="10" rx="2" fill={fill} stroke={stroke} strokeDasharray={dash} /></svg>
      {label}
    </span>
  )
  return (
    <div className="flex flex-wrap gap-4 px-4 py-2 border-t border-line text-xs text-muted">
      {item('#dce8e2', '#2f5d50', 'Retained')}
      {item('#f5e8cf', '#9a6512', 'Fading')}
      {item('#ffffff', '#2f5d50', 'Unlocked, not started')}
      {item('#ffffff', '#a7b1ad', 'Locked', '3 2')}
    </div>
  )
}

function TopicDetail({ node, detail, prerequisites, thresholds }) {
  // Explains the backend's unlocked flag; the backend stays the authority on the actual decision.
  const passes = (p) => (p.predictedRetention ?? 0) >= thresholds.minRetention && p.correctCount >= thresholds.minCorrectCount

  return (
    <aside className="bg-white border border-line rounded p-4 space-y-4 text-sm">
      <div>
        <h2 className="text-lg font-semibold">{node.name}</h2>
        <p className="text-muted">{node.unlocked ? 'Unlocked' : 'Locked'}</p>
      </div>

      {prerequisites.length > 0 && (
        <div>
          <h3 className="font-medium mb-1">Needs first</h3>
          <ul className="space-y-1">
            {prerequisites.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>{p.name}</span>
                <span className={passes(p) ? 'text-moss' : 'text-amber'}>
                  {pct(p.predictedRetention)}, {p.correctCount} correct
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail.attempted ? (
        <dl className="grid grid-cols-2 gap-y-1">
          <dt className="text-muted">Predicted retention</dt><dd>{pct(detail.predictedRetention)}</dd>
          <dt className="text-muted">Half-life</dt><dd>{detail.halfLifeDays?.toFixed(1)} days</dd>
          <dt className="text-muted">Correct / wrong</dt><dd>{detail.correctCount} / {detail.wrongCount}</dd>
          <dt className="text-muted">Mean difficulty</dt><dd>{detail.meanDifficulty?.toFixed(2)} of 3</dd>
          <dt className="text-muted">Last practised</dt><dd>{dateTime(detail.lastPracticedAt)}</dd>
          <dt className="text-muted">Days since</dt><dd>{detail.daysSinceLastPractice?.toFixed(1)}</dd>
        </dl>
      ) : (
        <p className="text-muted">No attempts yet, so there is no retention estimate.</p>
      )}

      <Link to={`/problems?topicId=${node.id}`} className="inline-block bg-moss text-white rounded px-3 py-1.5">
        Practise {node.name}
      </Link>
    </aside>
  )
}
