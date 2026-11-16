import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { DifficultyBadge, LockedTag } from '../components/Badges.jsx'
import { ErrorBox, Loading } from '../components/Status.jsx'

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Problems</h1>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          Topic
          <select value={topicId} onChange={(e) => setFilter('topicId', e.target.value)}
            className="border border-line rounded px-2 py-1 bg-white">
            <option value="">All</option>
            {graph.data?.nodes.map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-2">
          Difficulty
          <select value={difficulty} onChange={(e) => setFilter('difficulty', e.target.value)}
            className="border border-line rounded px-2 py-1 bg-white">
            <option value="">All</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
        </label>
      </div>

      {problems.error && <ErrorBox error={problems.error} onRetry={problems.reload} />}
      {problems.loading && !problems.data && <Loading />}
      {problems.data && (problems.data.length === 0 ? (
        <p className="text-muted">No problems match these filters.</p>
      ) : (
        <table className="w-full text-sm bg-white border border-line">
          <thead className="text-left text-muted border-b border-line">
            <tr><th className="p-3 font-medium">Title</th><th className="p-3 font-medium">Topic</th><th className="p-3 font-medium">Difficulty</th></tr>
          </thead>
          <tbody>
            {problems.data.map((p) => (
              <tr key={p.id} className="border-b border-line last:border-0">
                <td className="p-3"><Link to={`/problems/${p.id}`} className="text-moss hover:underline">{p.title}</Link></td>
                <td className="p-3">
                  <span className="mr-2">{p.topicName}</span>
                  {/* Locked topics are still open for manual practice (CONTRACT.md 2.3); the tag is information only. */}
                  {locked.has(p.topicId) && <LockedTag />}
                </td>
                <td className="p-3"><DifficultyBadge difficulty={p.difficulty} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}
    </div>
  )
}
