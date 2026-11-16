import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { clearMock, endMock, endsAt, isActive, pickProblems, startMock, useMock } from '../mock.js'
import { formatClock } from '../components/SolveTimer.jsx'
import { DifficultyBadge } from '../components/Badges.jsx'
import { ErrorBox, Loading, PageHeader } from '../components/Status.jsx'
import { IconArrowRight, IconCheck, IconPlay, IconRefresh, IconStopwatch } from '../components/Icons.jsx'

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

// Timed interview practice: 2-3 problems from unlocked topics, one countdown, and a summary at the end.
// Submissions made on the problem pages during the interview are counted automatically.
export default function Mock() {
  const { userId } = useUser()
  const session = useMock(userId)
  const now = useNow()
  const problems = useApi(() => api.problems(), [])

  if (problems.error) return <ErrorBox error={problems.error} onRetry={problems.reload} />
  if (!problems.data) return <Loading />
  const byId = Object.fromEntries(problems.data.map((p) => [p.id, p]))

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Practice" title="Mock interview">
        A timed set of problems that ramps from easy to harder, like a real interview round.
        Solve them on their problem pages; every submission during the interview is counted here.
      </PageHeader>
      {!session ? <Setup userId={userId} problems={problems.data} />
        : isActive(session, now) ? <Live userId={userId} session={session} byId={byId} now={now} />
          : <Summary userId={userId} session={session} byId={byId} />}
    </div>
  )
}

function Setup({ userId, problems }) {
  const graph = useApi(() => api.topicGraph(userId), [userId])
  const status = useApi(() => api.problemStatus(userId), [userId])
  const [duration, setDuration] = useState(45)
  const [count, setCount] = useState(2)

  if (graph.error || status.error) return <ErrorBox error={graph.error || status.error} />
  if (!graph.data || !status.data) return <div className="skeleton h-64" />

  const unlocked = new Set(graph.data.nodes.filter((n) => n.unlocked).map((n) => n.id))
  const statusById = Object.fromEntries(status.data.map((s) => [s.problemId, s.status]))
  const start = () => startMock(userId, pickProblems(problems, unlocked, statusById, count), duration)

  return (
    <div className="glass rounded-2xl p-6 sm:p-8 max-w-2xl space-y-7">
      <Choice label="Time limit" value={duration} onChange={setDuration} options={[30, 45, 60, 90]} format={(m) => `${m} min`} />
      <Choice label="Problems" value={count} onChange={setCount} options={[2, 3]} format={(n) => `${n} problems`} />
      <ul className="text-sm text-muted space-y-1.5 list-disc pl-5">
        <li>Problems come from topics you have unlocked, unsolved ones first.</li>
        <li>The clock keeps running if you switch pages or refresh; a banner shows the time left.</li>
        <li>The interview ends when time is up, when everything is solved, or when you end it.</li>
      </ul>
      <button onClick={start} className="btn btn-primary">
        <IconPlay size={14} /> Start interview
      </button>
    </div>
  )
}

function Choice({ label, value, onChange, options, format }) {
  return (
    <div className="space-y-2">
      <p className="eyebrow">{label}</p>
      <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-sunken border border-line" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o} role="radio" aria-checked={value === o} onClick={() => onChange(o)}
            className={`h-9 px-4 rounded-lg text-sm transition-colors
              ${value === o ? 'bg-accent text-accent-ink font-medium' : 'text-muted hover:text-ink'}`}>
            {format(o)}
          </button>
        ))}
      </div>
    </div>
  )
}

function Live({ userId, session, byId, now }) {
  const left = endsAt(session) - now
  const solved = session.problemIds.filter((id) => session.results[id]?.solved).length
  const urgent = left < 5 * 60_000
  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-6">
        <div className="flex-1">
          <p className="eyebrow mb-2">Time left</p>
          <p role="timer" className={`font-mono text-6xl tabular-nums tracking-tight ${urgent ? 'text-brick' : 'text-ink'}`}>
            {formatClock(left, true)}
          </p>
          <p className="text-sm text-muted mt-2">{solved} of {session.problemIds.length} solved</p>
        </div>
        <button onClick={() => endMock(userId)} className="btn btn-ghost self-start sm:self-center">End interview</button>
      </div>
      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 stagger">
        {session.problemIds.map((id, i) => <ProblemCard key={id} n={i + 1} p={byId[id]} r={session.results[id]} session={session} />)}
      </ol>
    </div>
  )
}

function ProblemCard({ n, p, r, session }) {
  if (!p) return null
  return (
    <li className="glass rounded-2xl p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <span className="display text-3xl text-faint leading-none">{String(n).padStart(2, '0')}</span>
        <DifficultyBadge difficulty={p.difficulty} />
      </div>
      <div>
        <p className="font-medium text-ink">{p.title}</p>
        <p className="text-xs text-faint mt-0.5">{p.topicName}</p>
      </div>
      <p className={`text-sm ${r?.solved ? 'text-moss' : r?.attempts ? 'text-amber' : 'text-muted'}`}>
        {r?.solved
          ? <span className="inline-flex items-center gap-1.5"><IconCheck size={14} /> Solved at {formatClock(r.solvedAt - session.startedAt)}</span>
          : r?.attempts ? `${r.attempts} attempt${r.attempts === 1 ? '' : 's'}, not solved yet` : 'Not started'}
      </p>
      <Link to={`/problems/${p.id}`} className="btn btn-ghost h-9 mt-auto text-xs">
        {r?.solved ? 'Review' : 'Open problem'} <IconArrowRight size={14} />
      </Link>
    </li>
  )
}

function Summary({ userId, session, byId }) {
  const finishedAt = Math.min(session.endedAt ?? endsAt(session), endsAt(session))
  const used = finishedAt - session.startedAt
  const solved = session.problemIds.filter((id) => session.results[id]?.solved).length
  const all = solved === session.problemIds.length
  return (
    <div className="space-y-6">
      <div className="glass rounded-2xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${all ? 'bg-moss-soft text-moss' : 'bg-accent-soft text-accent'}`}>
            {all ? <IconCheck size={20} /> : <IconStopwatch size={20} />}
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">{all ? 'All problems solved' : session.endedAt ? 'Interview ended' : "Time's up"}</h2>
            <p className="text-sm text-muted">
              {solved} of {session.problemIds.length} solved in {formatClock(used)} of {session.durationMin} minutes.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <button onClick={() => clearMock(userId)} className="btn btn-primary"><IconRefresh size={14} /> New interview</button>
          <Link to="/mistakes" className="btn btn-ghost">See your mistake profile</Link>
        </div>
      </div>
      <ol className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {session.problemIds.map((id, i) => <ProblemCard key={id} n={i + 1} p={byId[id]} r={session.results[id]} session={session} />)}
      </ol>
    </div>
  )
}
