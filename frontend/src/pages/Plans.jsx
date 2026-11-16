import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { DifficultyBadge } from '../components/Badges.jsx'
import { ErrorBox, Loading, PageHeader } from '../components/Status.jsx'
import { IconArrowRight, IconCheck, IconChevronDown } from '../components/Icons.jsx'

// Curated sequences of problems with this learner's progress through each one.
export default function Plans() {
  const { userId } = useUser()
  const plans = useApi(() => api.studyPlans(userId), [userId])
  const [open, setOpen] = useState(null)

  if (plans.error) return <ErrorBox error={plans.error} onRetry={plans.reload} />
  if (!plans.data) return <Loading />

  // By default, expand the first plan that is not finished yet.
  const expanded = open ?? plans.data.find((p) => p.solved < p.total)?.id

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Practice" title="Study plans">
        Curated problem sequences. Work through one from top to bottom; progress updates as you solve.
      </PageHeader>

      <ul className="space-y-4 stagger">
        {plans.data.map((plan) => {
          const next = plan.items.find((i) => i.status !== 'SOLVED')
          const done = plan.solved === plan.total
          const isOpen = expanded === plan.id
          return (
            <li key={plan.id} className="glass rounded-2xl overflow-hidden">
              <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-ink">{plan.title}</h2>
                    {done && (
                      <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-moss/30 bg-moss-soft text-moss text-xs font-medium">
                        <IconCheck size={12} /> Complete
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted">{plan.description}</p>
                  <div className="flex items-center gap-3 pt-1">
                    <div className="h-1.5 flex-1 max-w-sm rounded-full bg-sunken overflow-hidden" aria-hidden="true">
                      <div className={`h-full rounded-full animate-grow-x ${done ? 'bg-moss' : 'bg-accent'}`}
                        style={{ width: `${(plan.solved / plan.total) * 100}%` }} />
                    </div>
                    <span className="text-xs text-muted tabular-nums">{plan.solved} / {plan.total} solved</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {next && (
                    <Link to={`/problems/${next.problemId}`} className="btn btn-primary h-9 px-4 text-xs">
                      {plan.solved === 0 ? 'Start' : 'Continue'} <IconArrowRight size={14} />
                    </Link>
                  )}
                  <button onClick={() => setOpen(isOpen ? 0 : plan.id)} aria-expanded={isOpen}
                    className="btn btn-ghost h-9 px-3 text-xs">
                    {isOpen ? 'Hide' : 'Show'} problems
                    <IconChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>
              {isOpen && (
                <ol className="border-t border-line divide-y divide-line animate-fade-up">
                  {plan.items.map((item, i) => (
                    <li key={item.problemId}>
                      <Link to={`/problems/${item.problemId}`}
                        className="group flex items-center gap-4 px-5 sm:px-6 py-3 hover:bg-sunken transition-colors">
                        <StatusDot status={item.status} />
                        <span className="text-xs text-faint tabular-nums w-5">{i + 1}</span>
                        <span className="flex-1 min-w-0 truncate text-sm text-ink group-hover:text-accent transition-colors">{item.title}</span>
                        <span className="hidden sm:inline text-xs text-faint">{item.topicName}</span>
                        <DifficultyBadge difficulty={item.difficulty} />
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function StatusDot({ status }) {
  if (status === 'SOLVED') {
    return (
      <span title="Solved" className="flex h-5 w-5 items-center justify-center rounded-full bg-moss text-paper">
        <IconCheck size={12} />
      </span>
    )
  }
  return (
    <span title={status === 'ATTEMPTED' ? 'Attempted' : 'Not started'}
      className={`h-5 w-5 rounded-full border-2 ${status === 'ATTEMPTED' ? 'border-amber bg-amber-soft' : 'border-line-strong'}`} />
  )
}
