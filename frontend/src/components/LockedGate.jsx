import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { pct } from '../format.js'
import { prerequisiteMet, prerequisitesOf, problemToPractise, topicToPractise } from '../locks.js'
import { DifficultyBadge } from './Badges.jsx'
import { IconArrowRight, IconCheck, IconChevronRight, IconLock } from './Icons.jsx'

// Shown instead of a problem whose topic is still locked for this learner. The learner can go to the
// recommended practice problem or open this one anyway; opening it does not unlock the topic.
export default function LockedGate({ problem, graph, userId, onProceed }) {
  const navigate = useNavigate()
  const problems = useApi(() => api.problems(), [])
  const status = useApi(() => api.problemStatus(userId), [userId])

  const prereqs = prerequisitesOf(graph, problem.topic.id)
  const practiseTopic = topicToPractise(graph, problem.topic.id)
  const statusById = new Map((status.data ?? []).map((s) => [s.problemId, s.status]))
  const practice = practiseTopic && problems.data ? problemToPractise(problems.data, statusById, practiseTopic.id) : null
  const { minRetention, minCorrectCount } = graph.thresholds

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-faint min-w-0">
        <Link to="/problems" className="hover:text-ink transition-colors shrink-0">Problems</Link>
        <IconChevronRight size={13} className="shrink-0" />
        <span className="text-muted truncate">{problem.title}</span>
      </nav>

      <section className="glass rounded-3xl p-6 sm:p-10 max-w-2xl mx-auto space-y-7 animate-fade-up" aria-labelledby="locked-title">
        <div className="space-y-4">
          <span className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-amber-soft text-amber border border-amber/25">
            <IconLock size={22} />
          </span>
          <h1 id="locked-title" className="display text-3xl sm:text-4xl text-ink">This question is currently locked!</h1>
          <p className="text-[15px] text-muted leading-relaxed">
            Before attempting <span className="text-ink font-medium">{problem.title}</span>, we recommend practising an
            easier question first. It will help you understand the ideas you need to solve this one.
          </p>
        </div>

        {prereqs.length > 0 && (
          <div className="space-y-2.5">
            <h2 className="eyebrow">Why it is locked</h2>
            <p className="text-sm text-muted">
              {problem.topic.name} opens up when you are comfortable with {joinNames(prereqs)}. For each of
              them, solve at least {minCorrectCount} questions correctly and keep your memory score at {pct(minRetention)} or more.
            </p>
            <ul className="space-y-1.5">
              {prereqs.map((t) => {
                const met = prerequisiteMet(t, graph.thresholds)
                return (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2 bg-sunken border border-line text-sm">
                    <span className="flex items-center gap-2 text-ink">
                      {met ? <IconCheck size={14} className="text-moss" /> : <IconLock size={13} className="text-amber" />}
                      {t.name}
                    </span>
                    <span className={`text-xs ${met ? 'text-moss' : 'text-amber'}`}>
                      {met ? 'Done'
                        : t.predictedRetention == null ? 'Not started yet'
                          : `${Math.min(t.correctCount, minCorrectCount)} of ${minCorrectCount} solved, memory score ${pct(t.predictedRetention)}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <div className="space-y-2.5">
          <h2 className="eyebrow">Recommended practice</h2>
          {practiseTopic && !prereqs.some((t) => t.id === practiseTopic.id) && (
            <p className="text-sm text-muted">
              Those topics are locked too, so start with {practiseTopic.name}. It is the first step on the way to {problem.topic.name}.
            </p>
          )}
          {practice ? (
            <Link to={`/problems/${practice.id}`}
              className="group flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 border border-line bg-surface hover:border-line-strong hover:bg-accent-soft transition-colors">
              <span className="font-medium text-ink group-hover:text-accent transition-colors">{practice.title}</span>
              <span className="text-xs text-muted">{practice.topicName}</span>
              <DifficultyBadge difficulty={practice.difficulty} />
              {statusById.get(practice.id) === 'SOLVED' && <span className="text-xs text-moss">Solved before: try it again</span>}
            </Link>
          ) : problems.loading || status.loading ? (
            <div className="skeleton h-12" />
          ) : (
            <p className="text-sm text-muted">Practise {practiseTopic?.name ?? 'the earlier topics'} first.</p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
          <button type="button" onClick={onProceed} className="btn btn-ghost sm:flex-1">
            I still want to proceed
          </button>
          <button type="button" disabled={!practice} onClick={() => navigate(`/problems/${practice.id}`)}
            className="btn btn-primary sm:flex-1">
            Go to recommended practice <IconArrowRight size={16} />
          </button>
        </div>
      </section>
    </div>
  )
}

function joinNames(topics) {
  const names = topics.map((t) => t.name)
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`
}
