import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Markdown from 'react-markdown'
import { api, submitAndWait } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { ERROR_CATEGORY, dateTime } from '../format.js'
import { forgetSavedCode, preferredLanguage, setPreferredLanguage } from '../drafts.js'
import { isActive, recordSubmission, useMock } from '../mock.js'
import { DifficultyBadge, VerdictBadge } from '../components/Badges.jsx'
import CodeEditor from '../components/CodeEditor.jsx'
import LearnTopic from '../components/LearnTopic.jsx'
import LockedGate from '../components/LockedGate.jsx'
import ResourceList from '../components/ResourceList.jsx'
import Select from '../components/Select.jsx'
import SolveTimer from '../components/SolveTimer.jsx'
import { ErrorBox, Loading, Spinner } from '../components/Status.jsx'
import {
  IconCheck, IconChevronDown, IconChevronRight, IconClock, IconCode, IconPlay, IconRefresh, IconSpark, IconTarget,
} from '../components/Icons.jsx'

// The two languages the judge supports. Python is the default.
const FILE = { PYTHON: 'Main.py', JAVA: 'Main.java' }
const FALLBACK_LANGUAGES = [{ id: 'PYTHON', name: 'Python 3' }, { id: 'JAVA', name: 'Java' }]
// Display names for the history list; CPP only appears on old attempts from when C++ was offered.
const LANG_NAME = { JAVA: 'Java', PYTHON: 'Python', CPP: 'C++' }

// Grey hint text shown while the editor is empty. It is not code and disappears as soon as you type.
const PLACEHOLDER = {
  JAVA: 'Write your complete Java program here.\nRead the input from System.in.\nPrint the answer with System.out.\nYour class must be called Main.',
  PYTHON: 'Write your complete Python program here.\nRead the input with input() or sys.stdin.\nPrint the answer with print().',
}

export default function ProblemSolve() {
  const { id } = useParams()
  const { userId } = useUser()
  const problem = useApi(() => api.problem(id), [id])
  const languages = useApi(api.languages, [])
  // Lock state is per learner; a locked topic shows a recommendation before the problem opens.
  const graph = useApi(() => api.topicGraph(userId), [userId])
  // Problem id the learner chose to open despite the lock. Only for this visit: it is never saved,
  // so the topic stays locked and the recommendation shows again next time.
  const [proceededWith, setProceededWith] = useState(null)
  // Problems picked for a running mock interview open directly: the clock is already ticking.
  const mock = useMock(userId)

  const [preferred, setPreferred] = useState(preferredLanguage)
  const [code, setCode] = useState('')
  // Code per language for this visit only (switching Java -> Python -> Java keeps the Java code).
  // Nothing is stored: leaving the problem and coming back always starts with an empty editor.
  const codeByLanguage = useRef({})
  const [leftTab, setLeftTab] = useState('description')
  const [historyVersion, setHistoryVersion] = useState(0)
  const [notice, setNotice] = useState(null)

  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [submitError, setSubmitError] = useState(null)

  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState(null)
  const [runError, setRunError] = useState(null)
  const [consoleTab, setConsoleTab] = useState('tests')
  const [customOn, setCustomOn] = useState(false)
  const [customInput, setCustomInput] = useState('')

  // Contract: timeSpentSeconds is measured "from problem open to submit" (feeds speed_vs_target).
  const openedAt = useRef(Date.now())
  // State updates are not instant, so a quick double click could start two runs. This ref is.
  const busy = useRef(false)
  // The problem currently on screen; a result that arrives after switching problems is dropped.
  const shownId = useRef(null)
  // Number of the newest Run / Submit. An answer is shown only if it belongs to the newest one,
  // so a slow older request can never overwrite a newer result.
  const latest = useRef(0)
  const consoleRef = useRef(null)
  const resultRef = useRef(null)

  // Python first, then Java; only languages this server can actually run.
  const available = languages.data
    ? FALLBACK_LANGUAGES.map((f) => languages.data.languages.find((l) => l.id === f.id && l.available)).filter(Boolean)
    : FALLBACK_LANGUAGES
  const language = available.some((l) => l.id === preferred) ? preferred : (available[0]?.id ?? 'PYTHON')
  const p = problem.data
  shownId.current = p?.id ?? null
  const topicNode = p && graph.data?.nodes.find((n) => n.id === p.topic.id)
  const inMock = Boolean(p && isActive(mock) && mock.problemIds.includes(p.id))
  const gated = Boolean(topicNode && !topicNode.unlocked && proceededWith !== p.id && !inMock)

  // Older versions saved code in the browser and restored it; remove those copies once.
  useEffect(() => { forgetSavedCode() }, [])

  // New problem (or another learner): an empty editor, no results, and a fresh clock.
  useEffect(() => {
    if (!p) return
    codeByLanguage.current = {}
    setCode('')
    setResult(null)
    setRunResult(null)
    setRunError(null)
    setSubmitError(null)
    setNotice(null)
    setConsoleTab('tests')
    setCustomInput(p.sampleTests[0]?.input ?? '')
    openedAt.current = Date.now()
  }, [p?.id, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts call the latest handlers through refs, so the editor never needs re-creating.
  const runRef = useRef(null)
  const submitRef = useRef(null)
  const stableRun = useRef(() => runRef.current?.()).current
  const stableSubmit = useRef(() => submitRef.current?.()).current

  if (problem.error) return <ErrorBox error={problem.error} onRetry={problem.reload} />
  // Wait for the lock state too (unless it failed to load), so a locked problem never flashes open.
  if (!p || (graph.loading && !graph.data)) return <Loading />
  if (gated) {
    return (
      <LockedGate problem={p} graph={graph.data} userId={userId}
        onProceed={() => { setProceededWith(p.id); openedAt.current = Date.now() }} />
    )
  }

  // Runs or submits only when nothing else is running and the editor has code in it.
  function start(what) {
    if (busy.current) return false
    if (!code.trim()) {
      setNotice(`Your editor is empty. Write your program first, then press ${what}.`)
      return false
    }
    busy.current = true
    setNotice(null)
    // The panel must only ever show the newest attempt: remove every earlier output, error and verdict.
    setRunResult(null)
    setRunError(null)
    setResult(null)
    setSubmitError(null)
    latest.current += 1
    return true
  }

  async function run() {
    if (!start('Run')) return
    const pid = p.id
    const ticket = latest.current
    const current = () => shownId.current === pid && latest.current === ticket
    setRunning(true)
    setConsoleTab('result')
    consoleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    try {
      const r = await api.run(userId, pid, code, language, customOn ? customInput : undefined)
      if (current()) setRunResult(r)
    } catch (e) {
      if (current()) setRunError(e)
    } finally {
      busy.current = false
      setRunning(false)
    }
  }

  async function submit() {
    if (!start('Submit')) return
    const pid = p.id
    const ticket = latest.current
    const current = () => shownId.current === pid && latest.current === ticket
    setSubmitting(true)
    setProgress({ status: 'QUEUED' })
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
    try {
      const seconds = Math.round((Date.now() - openedAt.current) / 1000)
      const r = await submitAndWait(userId, pid, code, seconds, language, (job) => { if (current()) setProgress(job) })
      recordSubmission(userId, pid, r.verdict) // counts toward a running mock interview, if any
      if (current()) {
        setResult(r)
        setHistoryVersion((v) => v + 1)
        // The verdict appears below the console; bring it on screen.
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
      }
    } catch (e) {
      if (current()) {
        setSubmitError(e)
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
      }
    } finally {
      busy.current = false
      setSubmitting(false)
      setProgress(null)
    }
  }
  runRef.current = run
  submitRef.current = submit

  function changeLanguage(next) {
    if (next === language) return
    codeByLanguage.current[language] = code
    setPreferred(next)
    setPreferredLanguage(next)
    setCode(codeByLanguage.current[next] ?? '')
  }

  function editCode(next) {
    setCode(next)
    if (notice) setNotice(null)
  }

  // Only when the learner asks for it: put an earlier submission back into the editor.
  function loadFromHistory(item) {
    codeByLanguage.current[language] = code
    codeByLanguage.current[item.language] = item.code
    setPreferred(item.language)
    setPreferredLanguage(item.language)
    setCode(item.code)
  }

  function clearCode() {
    if (code.trim() && !window.confirm('Clear the editor? The code you wrote will be removed.')) return
    codeByLanguage.current[language] = ''
    setCode('')
  }

  const busyNow = running || submitting

  return (
    // From lg up the page is a fixed workspace exactly one screen tall: the header row stays put and
    // the description, the code and the results each scroll inside their own panel, so long code never
    // moves the page. Below lg the panels stack and the page scrolls as usual (the editor keeps a fixed
    // height and scrolls inside). 4.5rem = Layout's top + bottom padding on problem pages.
    <div className="space-y-6 lg:space-y-0 lg:flex lg:flex-col lg:gap-5 lg:h-[calc(100dvh-4.5rem)] lg:min-h-[34rem]">
      {/* z-30 keeps the timer panel above the glass cards below it. */}
      <div className="relative z-30 flex items-center justify-between gap-3 lg:shrink-0">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-faint min-w-0">
          <Link to="/problems" className="hover:text-ink transition-colors shrink-0">Problems</Link>
          <IconChevronRight size={13} className="shrink-0" />
          <span className="text-muted truncate">{p.title}</span>
        </nav>
        <SolveTimer key={p.id} problemId={p.id} />
      </div>

      {/* Editor column is the wider one (55% on laptops, 60% on large screens). */}
      <div className="grid gap-6 items-start lg:items-stretch lg:flex-1 lg:min-h-0 lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)] xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="glass rounded-2xl min-w-0 overflow-hidden lg:flex lg:flex-col lg:min-h-0">
          <div className="flex items-center gap-1 px-3 h-12 border-b border-line shrink-0 overflow-x-auto" role="tablist">
            {[['description', 'Description'], ['learn', 'Learn This Topic'], ['submissions', 'Submissions']].map(([key, label]) => (
              <button key={key} role="tab" aria-selected={leftTab === key} onClick={() => setLeftTab(key)}
                className={`h-8 px-3 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors
                  ${leftTab === key ? 'bg-accent-soft text-ink' : 'text-muted hover:text-ink hover:bg-sunken'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="lg:flex-1 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
            {leftTab === 'description' && <Description p={p} />}
            {leftTab === 'learn' && <LearnTopic key={p.id} learn={p.learn} problemTitle={p.title} />}
            {leftTab === 'submissions' && <SubmissionHistory key={historyVersion} userId={userId} problemId={p.id} onLoad={loadFromHistory}
                  canLoad={(lang) => available.some((l) => l.id === lang)} />}
          </div>
        </section>

        <section className="space-y-4 min-w-0 lg:space-y-0 lg:flex lg:flex-col lg:gap-4 lg:min-h-0">
          <div className="glass rounded-2xl overflow-hidden relative z-20 lg:flex lg:flex-col lg:flex-1 lg:min-h-[15rem]">
            {/* Run and Submit live in the top bar, so they are on screen at every screen size. */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 min-h-12 border-b border-line shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Select className="w-32 sm:w-36" value={language} onChange={changeLanguage} ariaLabel="Language"
                  options={available.map((l) => ({ value: l.id, label: l.name }))} />
                <span className="hidden sm:inline-flex items-center h-7 px-3 rounded-lg bg-sunken border border-line font-mono text-xs text-ink">
                  {FILE[language]}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 ml-auto">
                <button type="button" onClick={clearCode} disabled={busyNow || !code}
                  className="btn btn-ghost h-9 px-2.5 text-xs" title="Clear the editor">
                  <IconRefresh size={13} /> <span className="hidden sm:inline">Clear</span>
                </button>
                <button type="button" onClick={run} disabled={busyNow} aria-busy={running}
                  className="btn btn-ghost h-9 px-3.5 min-w-[5.5rem]" title="Run on the examples (Ctrl+')">
                  {running ? <><Spinner /> Running…</> : <><IconPlay size={14} /> Run</>}
                </button>
                <button type="button" onClick={submit} disabled={busyNow} aria-busy={submitting}
                  className="btn btn-primary h-9 px-4 min-w-[6.5rem] 2xl:min-w-40 max-w-full" title="Submit for judging (Ctrl+Enter)">
                  {submitting
                    ? <><Spinner /> <span className="truncate">{progressLabel(progress)}</span></>
                    : <><IconCheck size={15} /> Submit</>}
                </button>
              </div>
            </div>
            {notice && (
              <p role="alert" className="px-4 py-2 text-sm text-amber bg-amber-soft border-b border-amber/20 shrink-0">{notice}</p>
            )}
            {/* Fixed height: long code scrolls inside the editor instead of making the page taller. */}
            <div className="h-[420px] sm:h-[480px] lg:h-auto lg:flex-1 lg:min-h-0">
              <CodeEditor value={code} onChange={editCode} language={language} onRun={stableRun} onSubmit={stableSubmit}
                placeholder={PLACEHOLDER[language]} />
            </div>
          </div>

          {/* Test input, run output and the verdict share one panel that scrolls on its own. */}
          <div className="space-y-4 lg:h-[36%] lg:[@media(max-height:760px)]:h-[30%] lg:shrink-0 lg:overflow-y-auto lg:overscroll-contain lg:rounded-2xl">
          <div ref={consoleRef} className="scroll-mt-6">
            <Console
              tab={consoleTab} setTab={setConsoleTab} samples={p.sampleTests}
              customOn={customOn} setCustomOn={setCustomOn} customInput={customInput} setCustomInput={setCustomInput}
              running={running} runResult={runResult} runError={runError}
            />
          </div>

          <div ref={resultRef} className="scroll-mt-6 space-y-4">
            {submitting && (
              <div className="glass rounded-2xl p-5 flex items-center gap-3 text-sm text-muted animate-fade-up" role="status">
                <Spinner /> Judging your code: {progressLabel(progress).toLowerCase()}
              </div>
            )}
            {submitError && <ErrorBox error={submitError} />}
            {result && <SubmissionResult key={result.attemptId} r={result} />}
          </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function progressLabel(progress) {
  if (!progress || progress.status === 'QUEUED') {
    return progress?.position ? `In queue · #${progress.position}` : 'Queued…'
  }
  if (!progress.testsTotal) return 'Compiling…'
  return `Running test ${Math.min(progress.testsDone + 1, progress.testsTotal)} of ${progress.testsTotal}`
}

function Description({ p }) {
  return (
    <div className="p-5 sm:p-7 space-y-6">
      <div className="space-y-4">
        <h1 className="display text-4xl sm:text-[2.75rem] text-ink">{p.title}</h1>
        <div className="flex flex-wrap gap-2 items-center text-xs text-muted">
          <span className="inline-flex items-center h-6 px-2.5 rounded-full border border-line bg-sunken text-ink">{p.topic.name}</span>
          <DifficultyBadge difficulty={p.difficulty} />
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-line"><IconClock size={13} /> Time limit {p.timeLimitMs} ms</span>
          <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border border-line"><IconTarget size={13} /> Aim for {Math.round(p.targetSolveSeconds / 60)} min</span>
        </div>
      </div>

      <div className="markdown text-[15px]"><Markdown>{p.statement}</Markdown></div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Block title="Input">{p.inputFormat}</Block>
        <Block title="Output">{p.outputFormat}</Block>
      </div>

      <div>
        <h2 className="text-sm font-semibold text-ink mb-3">
          Examples <span className="text-xs text-faint font-normal">({p.sampleTests.length} of {p.testCount} tests are shown; the rest are hidden)</span>
        </h2>
        <div className="space-y-3">
          {p.sampleTests.map((t) => (
            <div key={t.ordinal} className="grid grid-cols-2 gap-3">
              <Block title="Input" mono>{t.input}</Block>
              <Block title="Expected output" mono>{t.expectedOutput}</Block>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl px-4 py-3 bg-accent-soft border border-accent/15 text-sm text-ink space-y-1">
        <p className="font-medium">How to answer</p>
        <p className="text-muted">
          Write a complete program in Python or Java. Read the input exactly as described above, and print
          only the answer. In Python, read with <code className="font-mono text-[13px] text-ink">input()</code> and
          print with <code className="font-mono text-[13px] text-ink">print()</code>. In Java, your class must be
          called <code className="font-mono text-[13px] text-ink">Main</code>.
        </p>
      </div>
      <p className="text-xs text-faint">Python gets 3× the time limit, because limits are set for Java.</p>
    </div>
  )
}

// The learner's own past attempts on this problem, newest first; any of them can be loaded back.
function SubmissionHistory({ userId, problemId, onLoad, canLoad }) {
  const history = useApi(() => api.history(userId, problemId), [userId, problemId])
  const [open, setOpen] = useState(null)

  if (history.error) return <div className="p-5"><ErrorBox error={history.error} onRetry={history.reload} /></div>
  if (!history.data) return <div className="p-5 space-y-2"><div className="skeleton h-12" /><div className="skeleton h-12" /></div>
  if (history.data.length === 0) {
    return <p className="p-7 text-sm text-muted text-center">No submissions yet. Your attempts on this problem will appear here.</p>
  }
  return (
    <ul className="divide-y divide-line">
      {history.data.map((h) => (
        <li key={h.attemptId}>
          <button onClick={() => setOpen(open === h.attemptId ? null : h.attemptId)} aria-expanded={open === h.attemptId}
            className="w-full flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 text-left hover:bg-sunken transition-colors">
            <VerdictBadge verdict={h.verdict} />
            <span className="text-xs text-muted tabular-nums">{h.passedCount}/{h.totalCount} tests</span>
            <span className="text-xs text-muted">{LANG_NAME[h.language] ?? h.language}</span>
            {h.largeRuntimeMs != null && <span className="text-xs text-muted tabular-nums">{h.largeRuntimeMs} ms</span>}
            <span className="ml-auto text-xs text-faint">{dateTime(h.submittedAt)}</span>
            <IconChevronDown size={15} className={`text-faint transition-transform ${open === h.attemptId ? 'rotate-180' : ''}`} />
          </button>
          {open === h.attemptId && (
            <div className="px-5 pb-4 space-y-3 animate-fade-up">
              <div className="rounded-xl overflow-hidden border border-line h-72">
                <CodeEditor value={h.code} language={h.language} readOnly ariaLabel="Submitted code" />
              </div>
              {canLoad(h.language) ? (
                <button onClick={() => onLoad(h)} className="btn btn-ghost h-8 px-3 text-xs">
                  <IconCode size={14} /> Load into editor
                </button>
              ) : (
                <p className="text-xs text-faint">{LANG_NAME[h.language] ?? h.language} is no longer offered, so this code can only be viewed.</p>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

const STATUS_STYLE = {
  ACCEPTED: 'bg-moss-soft text-moss border-moss/25',
  OK: 'bg-moss-soft text-moss border-moss/25',
  WRONG_ANSWER: 'bg-brick-soft text-brick border-brick/25',
  RUNTIME_ERROR: 'bg-brick-soft text-brick border-brick/25',
  TIME_LIMIT_EXCEEDED: 'bg-amber-soft text-amber border-amber/25',
}
const STATUS_TEXT = {
  ACCEPTED: 'Passed', OK: 'Ran', WRONG_ANSWER: 'Wrong answer', RUNTIME_ERROR: 'Runtime error', TIME_LIMIT_EXCEEDED: 'Too slow',
}

// Run console: pick samples or a custom input, then see each case's output, stderr and time.
function Console({ tab, setTab, samples, customOn, setCustomOn, customInput, setCustomInput, running, runResult, runError }) {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="flex items-center gap-1 px-3 h-11 border-b border-line" role="tablist">
        {[['tests', 'Test input'], ['result', 'Run result']].map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}
            className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors
              ${tab === key ? 'bg-accent-soft text-ink' : 'text-muted hover:text-ink hover:bg-sunken'}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-faint pr-1 text-right">
          Runs are not saved<span className="hidden md:inline"> · <kbd className="font-mono">Ctrl+&apos;</kbd> run · <kbd className="font-mono">Ctrl+Enter</kbd> submit</span>
        </span>
      </div>
      <div className="p-4 max-h-96 lg:max-h-none overflow-auto">
        {tab === 'tests' ? (
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-ink cursor-pointer w-fit">
              <input type="checkbox" checked={customOn} onChange={(e) => setCustomOn(e.target.checked)} className="accent-[var(--accent)] h-4 w-4" />
              Use my own input
            </label>
            {customOn ? (
              <textarea value={customInput} onChange={(e) => setCustomInput(e.target.value)} spellCheck={false}
                aria-label="Custom input" rows={6}
                className="field w-full font-mono text-[13px] px-3 py-2.5 resize-y" />
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted">Run checks your code against the {samples.length} example tests.</p>
                {samples.map((s) => <Block key={s.ordinal} title={`Example ${s.ordinal}`} mono>{s.input}</Block>)}
              </div>
            )}
          </div>
        ) : running ? (
          <div className="flex items-center gap-2 text-sm text-muted"><Spinner /> Running…</div>
        ) : runError ? (
          <ErrorBox error={runError} />
        ) : !runResult ? (
          <p className="text-sm text-muted">Press Run to try your code without submitting it.</p>
        ) : !runResult.compiled ? (
          <div className="space-y-2">
          <p className="text-sm font-medium text-brick">Your code did not compile. The compiler says:</p>
          <pre className="font-mono text-[13px] whitespace-pre-wrap bg-brick-soft border border-brick/20 text-ink px-3 py-2.5 rounded-xl overflow-x-auto">
            {runResult.compileError}
          </pre>
          </div>
        ) : runResult.cases.length === 0 ? (
          <p className="text-sm text-muted">Nothing ran: this problem has no example tests. Tick &ldquo;Use my own input&rdquo; to try your code.</p>
        ) : (
          <div className="space-y-4">
            {runResult.cases.map((c) => (
              <div key={c.ordinal} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center h-6 px-2.5 rounded-full border text-xs font-medium ${STATUS_STYLE[c.status] ?? 'border-line text-muted'}`}>
                    {c.kind === 'CUSTOM' ? 'Your input' : `Example ${c.ordinal}`}: {STATUS_TEXT[c.status] ?? c.status}
                  </span>
                  {c.exceptionType && <span className="text-xs text-brick font-mono">{c.exceptionType}</span>}
                  <span className="text-xs text-faint tabular-nums">{c.runtimeMs} ms</span>
                  {c.memoryKb != null && <span className="text-xs text-faint tabular-nums">{(c.memoryKb / 1024).toFixed(1)} MB</span>}
                </div>
                <div className={`grid gap-2 ${c.expectedOutput != null ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                  <Block title="Input" mono>{c.input}</Block>
                  {c.expectedOutput != null && <Block title="Expected" mono>{c.expectedOutput}</Block>}
                  <Block title="Your output" mono>{c.actualOutput || ' '}</Block>
                </div>
                {c.stderr && <Block title="stderr" mono>{c.stderr}</Block>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Block({ title, children, mono }) {
  return (
    <div className="min-w-0">
      <h3 className="eyebrow mb-1.5">{title}</h3>
      <pre className={`whitespace-pre-wrap rounded-xl border border-line bg-sunken px-3 py-2.5 text-sm text-ink max-h-64 overflow-auto ${mono ? 'font-mono text-[13px]' : 'font-sans'}`}>
        {children}
      </pre>
    </div>
  )
}

// Test kinds in plain words: examples, unusual inputs, inputs at the limits, and one very big input.
const TEST_NAME = { SAMPLE: 'example', EDGE: 'special case', BOUNDARY: 'limit', LARGE: 'big input' }
const TEST_KIND = { SAMPLE: 'an example', EDGE: 'a special-case', BOUNDARY: 'a limit', LARGE: 'the big-input' }

// Renders POST /api/submissions response (CONTRACT.md 5.1).
function SubmissionResult({ r }) {
  const category = r.errorCategory && ERROR_CATEGORY[r.errorCategory]
  const ft = r.failedTest
  const ok = r.verdict === 'ACCEPTED'
  const [hintsShown, setHintsShown] = useState(0)
  const hints = r.hints ?? []
  const lang = LANG_NAME[r.language] ?? 'Java'

  return (
    <div className={`glass rounded-2xl p-5 space-y-5 animate-fade-up ${ok ? 'ring-1 ring-moss/25' : 'ring-1 ring-brick/20'}`} aria-live="polite">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <VerdictBadge verdict={r.verdict} size="lg" />
          {r.totalCount > 0 && <span className="text-sm text-muted">{r.passedCount} of {r.totalCount} tests passed</span>}
          <span className="text-xs text-faint">{lang}</span>
        </div>
        {r.totalCount > 0 && (
          <div className="h-1.5 rounded-full bg-sunken overflow-hidden" aria-hidden="true">
            <div className={`h-full rounded-full animate-grow-x ${ok ? 'bg-moss' : 'bg-brick'}`}
              style={{ width: `${(r.passedCount / r.totalCount) * 100}%` }} />
          </div>
        )}
      </div>

      {ok && r.largeRuntimeMs != null && (
        <p className="text-sm text-ink">
          {r.runtimePercentile != null
            ? <>Faster than <span className="font-semibold text-accent">{r.runtimePercentile}%</span> of accepted {lang} submissions on this problem.</>
            : <>The first accepted {lang} solution here, so there is nothing to compare its speed with yet.</>}
          {r.maxMemoryKb != null && <span className="text-muted"> Peak memory {(r.maxMemoryKb / 1024).toFixed(1)} MB.</span>}
        </p>
      )}

      {r.message && (
        // Compiler output keeps its line breaks and caret alignment, so it must be monospace.
        <pre className={`text-sm whitespace-pre-wrap ${r.verdict === 'COMPILE_ERROR' ? 'font-mono text-[13px] bg-brick-soft text-ink border border-brick/20 px-3 py-2.5 rounded-xl overflow-x-auto' : 'font-sans text-ink'}`}>
          {r.message}
        </pre>
      )}

      {category && (
        <p className="text-sm rounded-xl px-3 py-2.5 bg-sunken border border-line">
          <span className="font-medium text-ink">Mistake type: {category.label}.</span>{' '}
          <span className="text-muted">{category.hint}</span>
        </p>
      )}

      {hints.length > 0 && (
        <div className="space-y-2">
          {hints.slice(0, hintsShown).map((h, i) => (
            <p key={i} className="flex gap-2.5 text-sm text-ink rounded-xl px-3 py-2.5 bg-accent-soft border border-accent/15 animate-fade-up">
              <IconSpark size={15} className="text-accent mt-0.5" /> <span><span className="font-medium">Hint {i + 1}.</span> {h}</span>
            </p>
          ))}
          {hintsShown < hints.length && (
            <button onClick={() => setHintsShown((n) => n + 1)} className="btn btn-ghost h-8 px-3 text-xs">
              <IconSpark size={14} /> {hintsShown === 0 ? 'Show a hint' : 'Show another hint'} ({hints.length - hintsShown} left)
            </button>
          )}
        </div>
      )}

      {ft && (
        <div className="text-sm space-y-2">
          <p className="text-muted">It first went wrong on {TEST_KIND[ft.tag] ?? 'a'} test (test #{ft.ordinal}).</p>
          {/* Only SAMPLE tests carry data; hidden tests come back null on purpose so they can't be copied. */}
          {ft.input != null && (
            <div className="grid sm:grid-cols-3 gap-2">
              <Block title="Input" mono>{ft.input}</Block>
              <Block title="Expected" mono>{ft.expectedOutput}</Block>
              <Block title="Your output" mono>{ft.actualOutput}</Block>
            </div>
          )}
        </div>
      )}

      {r.testResults.length > 0 && (
        <div>
          <h3 className="eyebrow mb-2">Every test, in the order they ran</h3>
          <ul className="flex flex-wrap gap-1.5 stagger">
            {r.testResults.map((t) => (
              <li key={t.ordinal}
                title={`${TEST_NAME[t.tag] ?? t.tag} test #${t.ordinal}: ${t.verdict === 'ACCEPTED' ? 'passed' : 'failed'} in ${t.runtimeMs} ms`}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs tabular-nums
                  ${t.verdict === 'ACCEPTED' ? 'bg-moss-soft text-moss border-moss/20' : 'bg-brick-soft text-brick border-brick/20'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {TEST_NAME[t.tag] ?? t.tag} {t.ordinal}: {t.runtimeMs} ms
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.largeRuntimeMs != null && r.optimalRuntimeMs != null && (
        <p className="text-sm text-muted">Your code took {r.largeRuntimeMs} ms on the biggest input; a fast solution takes about {r.optimalRuntimeMs} ms.</p>
      )}

      {r.resources.length > 0 && (
        <div>
          <h3 className="eyebrow mb-2">Study this</h3>
          <ResourceList resources={r.resources} />
        </div>
      )}
    </div>
  )
}
