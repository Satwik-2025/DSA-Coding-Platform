import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { DifficultyBadge, LockedTag } from '../components/Badges.jsx'
import { EmptyState, ErrorBox, PageHeader } from '../components/Status.jsx'
import Select from '../components/Select.jsx'
import { IconChevronRight, IconFilter } from '../components/Icons.jsx'

const DIFFICULTIES = [
  { value: '', label: 'All' },
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
]

// Filters live in the URL (?topicId=&difficulty=) so the topic map can link straight to a filtered list.
export default function Problems() {
  const { userId } = useUser()
  const [params, setParams] = useSearchParams()
  const topicId = params.get('topicId') ?? ''
  const difficulty = params.get('difficulty') ?? ''

  const problems = useApi(() => api.problems({ topicId, difficulty }), [topicId, difficulty])
  // The graph gives topic names for the filter and per-learner lock state for the badges.
  const graph = useApi(() => api.topicGraph(userId), [userId])
  const locked = new Set(graph.data?.nodes.filter((n) => !n.unlocked).map((n) => n.id))

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    value ? next.set(key, value) : next.delete(key)
    setParams(next)
  }

  const topicOptions = [{ value: '', label: 'All' }, ...(graph.data?.nodes.map((n) => ({ value: String(n.id), label: n.name })) ?? [])]

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Practice" title="Problems">
        Java problems across every topic. Locked topics stay open for practice; the tag is information only.
      </PageHeader>

      <div className="glass rounded-2xl p-2 flex flex-col sm:flex-row sm:items-center gap-2 relative z-20">
        <span className="hidden sm:flex items-center gap-2 pl-2 pr-1 text-faint"><IconFilter size={16} /></span>
        <Select className="sm:w-60" label="Topic" value={topicId} onChange={(v) => setFilter('topicId', v)} options={topicOptions} />
        <Select className="sm:w-52" label="Difficulty" value={difficulty} onChange={(v) => setFilter('difficulty', v)} options={DIFFICULTIES} />
        {problems.data && (
          <span className="sm:ml-auto px-3 text-xs text-faint tabular-nums">
            {problems.data.length} {problems.data.length === 1 ? 'problem' : 'problems'}
          </span>
        )}
      </div>

      {problems.error && <ErrorBox error={problems.error} onRetry={problems.reload} />}
      {problems.loading && !problems.data && <div className="skeleton h-96" />}
      {problems.data && (problems.data.length === 0 ? (
        <EmptyState icon={<IconFilter />}>No problems match these filters.</EmptyState>
      ) : (
        <div className={`glass rounded-2xl overflow-x-auto transition-opacity duration-200 ${problems.loading ? 'opacity-60' : ''}`}>
          <table className="data-table min-w-[560px]">
            <thead>
              <tr><th>Title</th><th>Topic</th><th>Difficulty</th><th className="w-10"><span className="sr-only">Open</span></th></tr>
            </thead>
            <tbody className="stagger">
              {problems.data.map((p) => (
                <tr key={p.id} className="group">
                  <td>
                    <Link to={`/problems/${p.id}`} className="font-medium text-ink group-hover:text-accent transition-colors">{p.title}</Link>
                  </td>
                  <td>
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span className="text-muted">{p.topicName}</span>
                      {/* Locked topics are still open for manual practice (CONTRACT.md 2.3); the tag is information only. */}
                      {locked.has(p.topicId) && <LockedTag />}
                    </span>
                  </td>
                  <td><DifficultyBadge difficulty={p.difficulty} /></td>
                  <td className="text-right">
                    <Link to={`/problems/${p.id}`} aria-label={`Open ${p.title}`} tabIndex={-1}
                      className="inline-flex text-faint group-hover:text-accent group-hover:translate-x-0.5 transition-all">
                      <IconChevronRight size={18} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}
