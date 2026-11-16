import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { clearMock, endMock, endsAt, isActive, pickProblems, startMock, useMock, useNow } from '../mock.js'
import { formatClock } from '../components/SolveTimer.jsx'
import { DifficultyBadge } from '../components/Badges.jsx'
import { ErrorBox, Loading, PageHeader } from '../components/Status.jsx'
import { IconArrowRight, IconCheck, IconPlay, IconRefresh, IconStopwatch } from '../components/Icons.jsx'

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
        A timed set of problems, like a real interview round. Pick the time, how many problems and how hard.
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
  const [difficulty, setDifficulty] = useState('MIXED')

  if (graph.error || status.error) return <ErrorBox error={graph.error || status.error} />
  if (!graph.data || !status.data) return <div className="skeleton h-64" />

  const unlocked = new Set(graph.data.nodes.filter((n) => n.unlocked).map((n) => n.id))
  const statusById = Object.fromEntries(status.data.map((s) => [s.problemId, s.status]))
  const available = (d) => problems.filter((p) => p.difficulty === d).length
  const short = difficulty !== 'MIXED' && available(difficulty) < count
  const start = () => startMock(userId, pickProblems(problems, unlocked, statusById, count, difficulty), duration, difficulty)

  return (
    <div className="glass rounded-2xl p-6 sm:p-8 max-w-2xl space-y-7">
      <Choice label="Time limit" value={duration} onChange={setDuration} options={[30, 45, 60, 90]} format={(m) => `${m} min`} />
      <Choice label="Problems" value={count} onChange={setCount} options={[2, 3]} format={(n) => `${n} problems`} />
      <div className="space-y-2">
        <Choice label="Difficulty" value={difficulty} onChange={setDifficulty} options={['MIXED', 'EASY', 'MEDIUM', 'HARD']}
          format={(d) => (d === 'MIXED' ? 'Mixed' : DIFFICULTY_NAME[d])}
          disabled={(d) => d !== 'MIXED' && available(d) === 0}
          title={(d) => (d === 'MIXED' ? 'Starts easy and gets harder' : available(d) === 0 ? 'No problems at this level yet' : `${available(d)} problems at this level`)} />
        <p className="text-xs text-muted">
          {difficulty === 'MIXED'
            ? 'Mixed starts with an easy problem and gets harder, like a real interview round.'
            : `Every problem will be ${DIFFICULTY_NAME[difficulty].toLowerCase()}.`}
          {available('HARD') === 0 && ' There are no hard problems yet.'}
          {short && ` Only ${available(difficulty)} ${DIFFICULTY_NAME[difficulty].toLowerCase()} problem${available(difficulty) === 1 ? ' exists' : 's exist'}, so you will get ${available(difficulty)}.`}
        </p>
      </div>
      <ul className="text-sm text-muted space-y-1.5 list-disc pl-5">
        <li>Problems come from topics you have unlocked, unsolved ones first{difficulty !== 'MIXED' && ' (other topics fill in if there are not enough at that level)'}.</li>
        <li>The clock keeps running if you switch pages or refresh; a banner shows the time left.</li>
        <li>The interview ends when time is up, when everything is solved, or when you end it.</li>
      </ul>
      <button onClick={start} className="btn btn-primary">
        <IconPlay size={14} /> Start interview
      </button>
    </div>
  )
}

const DIFFICULTY_NAME = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard' }

// Sessions started before difficulty existed have none, which means Mixed.
const difficultyLabel = (session) =>
  !session.difficulty || session.difficulty === 'MIXED' ? 'mixed difficulty' : `${DIFFICULTY_NAME[session.difficulty].toLowerCase()} only`

function Choice({ label, value, onChange, options, format, disabled = () => false, title = () => undefined }) {
  return (
    <div className="space-y-2">
      <p className="eyebrow">{label}</p>
      <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-sunken border border-line" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={o} role="radio" aria-checked={value === o} onClick={() => onChange(o)}
            disabled={disabled(o)} title={title(o)}
            className={`h-9 px-4 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed
              ${value === o ? 'bg-accent text-accent-ink font-medium' : 'text-muted hover:text-ink disabled:hover:text-muted'}`}>
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
          <p className="text-sm text-muted mt-2">{solved} of {session.problemIds.length} solved · {difficultyLabel(session)}</p>
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
              {solved} of {session.problemIds.length} solved in {formatClock(used)} of {session.durationMin} minutes · {difficultyLabel(session)}.
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
