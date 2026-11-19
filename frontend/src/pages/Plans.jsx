import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { DifficultyBadge } from '../components/Badges.jsx'
import { ErrorBox, Loading, PageHeader } from '../components/Status.jsx'
import { IconArrowRight, IconCheck, IconChevronDown, IconChevronRight } from '../components/Icons.jsx'

// The full course is long, so it is shown topic by topic (like a roadmap): one row per topic with its
// progress, opened to see that topic's problems. The other plans are short and stay a single list.
const GROUPED_PLAN = 'full-path'

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
              {isOpen && (plan.slug === GROUPED_PLAN
                ? <TopicGroups items={plan.items} />
                : (
                  <ol className="border-t border-line divide-y divide-line animate-fade-up">
                    {plan.items.map((item, i) => <ProblemRow key={item.problemId} item={item} number={i + 1} showTopic />)}
                  </ol>
                ))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// Splits the plan into topics, keeping the plan's own order (topics in prerequisite order,
// easiest problem first within each topic).
export function groupByTopic(items) {
  const groups = []
  for (const item of items) {
    let g = groups.at(-1)
    if (!g || g.topic !== item.topicName) {
      g = groups.find((x) => x.topic === item.topicName)
      if (!g) {
        g = { topic: item.topicName, items: [] }
        groups.push(g)
      }
    }
    g.items.push(item)
  }
  return groups.map((g) => ({ ...g, solved: g.items.filter((i) => i.status === 'SOLVED').length }))
}

function TopicGroups({ items }) {
  const groups = groupByTopic(items)
  // The first topic with something left to solve starts open; the rest start closed.
  const [open, setOpen] = useState(() => new Set([groups.find((g) => g.solved < g.items.length)?.topic].filter(Boolean)))
  const toggle = (topic) => setOpen((prev) => {
    const next = new Set(prev)
    if (next.has(topic)) next.delete(topic)
    else next.add(topic)
    return next
  })

  return (
    <div className="border-t border-line p-3 sm:p-4 space-y-2 animate-fade-up">
      {groups.map((g) => {
        const isOpen = open.has(g.topic)
        const done = g.solved === g.items.length
        const id = `topic-${g.topic.replace(/\W+/g, '-')}`
        return (
          <section key={g.topic} className="rounded-xl border border-line bg-surface overflow-hidden">
            <button type="button" onClick={() => toggle(g.topic)} aria-expanded={isOpen} aria-controls={id}
              className="w-full flex items-center gap-3 sm:gap-4 px-4 py-3.5 text-left hover:bg-sunken transition-colors">
              <IconChevronRight size={16} className={`text-faint shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
              <span className="flex-1 min-w-0 truncate font-semibold text-ink">{g.topic}</span>
              {done && <IconCheck size={15} className="text-moss shrink-0" aria-label="Topic complete" />}
              <span className="font-mono text-xs text-muted tabular-nums shrink-0">{g.solved}/{g.items.length}</span>
              <span className="w-20 sm:w-48 lg:w-72 h-1.5 rounded-full bg-sunken overflow-hidden shrink-0" aria-hidden="true">
                <span className={`block h-full rounded-full transition-[width] duration-500 ${done ? 'bg-moss' : 'bg-accent'}`}
                  style={{ width: `${(g.solved / g.items.length) * 100}%` }} />
              </span>
            </button>
            {isOpen && (
              <ol id={id} className="border-t border-line divide-y divide-line animate-fade-up">
                {g.items.map((item, i) => <ProblemRow key={item.problemId} item={item} number={i + 1} />)}
              </ol>
            )}
          </section>
        )
      })}
    </div>
  )
}

function ProblemRow({ item, number, showTopic = false }) {
  return (
    <li>
      <Link to={`/problems/${item.problemId}`}
        className="group flex items-center gap-4 px-5 sm:px-6 py-3 hover:bg-sunken transition-colors">
        <StatusDot status={item.status} />
        <span className="text-xs text-faint tabular-nums w-5">{number}</span>
        <span className="flex-1 min-w-0 truncate text-sm text-ink group-hover:text-accent transition-colors">{item.title}</span>
        {showTopic && <span className="hidden sm:inline text-xs text-faint">{item.topicName}</span>}
        <DifficultyBadge difficulty={item.difficulty} />
      </Link>
    </li>
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
