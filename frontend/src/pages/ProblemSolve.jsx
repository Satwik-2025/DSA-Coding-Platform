import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Markdown from 'react-markdown'
import { api, submitAndWait } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { ERROR_CATEGORY, dateTime } from '../format.js'
import { clearDraft, loadDraft, preferredLanguage, saveDraft, setPreferredLanguage } from '../drafts.js'
import { recordSubmission } from '../mock.js'
import { DifficultyBadge, VerdictBadge } from '../components/Badges.jsx'
import CodeEditor from '../components/CodeEditor.jsx'
import ResourceList from '../components/ResourceList.jsx'
import Select from '../components/Select.jsx'
import SolveTimer from '../components/SolveTimer.jsx'
import { ErrorBox, Loading, Spinner } from '../components/Status.jsx'
import {
  IconCheck, IconChevronDown, IconChevronRight, IconClock, IconCode, IconPlay, IconRefresh, IconSpark, IconTarget,
} from '../components/Icons.jsx'

const FILE = { JAVA: 'Main.java', PYTHON: 'Main.py', CPP: 'main.cpp' }
const LANG_NAME = { JAVA: 'Java', PYTHON: 'Python', CPP: 'C++' }

export default function ProblemSolve() {
  const { id } = useParams()
  const { userId } = useUser()
  const problem = useApi(() => api.problem(id), [id])
  const languages = useApi(api.languages, [])

  const [preferred, setPreferred] = useState(preferredLanguage)
  const [code, setCode] = useState('')
  const [savedAt, setSavedAt] = useState(null)
  const [leftTab, setLeftTab] = useState('description')
  const [historyVersion, setHistoryVersion] = useState(0)

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

  const available = languages.data?.languages.filter((l) => l.available) ?? [{ id: 'JAVA', name: 'Java' }]
  const language = available.some((l) => l.id === preferred) ? preferred : 'JAVA'
  const p = problem.data
  const starter = p ? (p.starters?.[language] ?? p.starterCode) : ''

  // New problem or language: restore the saved draft, otherwise the starter code.
  useEffect(() => {
    if (p) setCode(loadDraft(userId, p.id, language) ?? starter)
  }, [p?.id, language, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // New problem: clear old results and restart the clock.
  useEffect(() => {
    if (!p) return
    setResult(null)
    setRunResult(null)
    setCustomInput(p.sampleTests[0]?.input ?? '')
    openedAt.current = Date.now()
  }, [p?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save half a second after typing stops. Only code is a dependency: problem / language changes
  // first load the right code, and only then is it saved under the new key.
  useEffect(() => {
    if (!p) return undefined
    const t = setTimeout(() => {
      if (code === starter) clearDraft(userId, p.id, language)
      else if (saveDraft(userId, p.id, language, code)) setSavedAt(Date.now())
    }, 500)
    return () => clearTimeout(t)
  }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keyboard shortcuts call the latest handlers through refs, so the editor never needs re-creating.
  const runRef = useRef(null)
  const submitRef = useRef(null)
  const stableRun = useRef(() => runRef.current?.()).current
  const stableSubmit = useRef(() => submitRef.current?.()).current

  if (problem.error) return <ErrorBox error={problem.error} onRetry={problem.reload} />
  if (!p) return <Loading />

  async function run() {
    if (running || submitting || !code.trim()) return
    setRunning(true)
    setRunError(null)
    setConsoleTab('result')
    try {
      setRunResult(await api.run(userId, p.id, code, language, customOn ? customInput : undefined))
    } catch (e) {
      setRunError(e)
    } finally {
      setRunning(false)
    }
  }

  async function submit() {
    if (running || submitting || !code.trim()) return
    setSubmitting(true)
    setSubmitError(null)
    setProgress({ status: 'QUEUED' })
    try {
      const seconds = Math.round((Date.now() - openedAt.current) / 1000)
      const r = await submitAndWait(userId, p.id, code, seconds, language, setProgress)
      setResult(r)
      setHistoryVersion((v) => v + 1)
      recordSubmission(userId, p.id, r.verdict) // counts toward a running mock interview, if any
    } catch (e) {
      setSubmitError(e)
    } finally {
      setSubmitting(false)
      setProgress(null)
    }
  }
  runRef.current = run
  submitRef.current = submit

  function changeLanguage(next) {
    setPreferred(next)
    setPreferredLanguage(next)
  }

  function loadFromHistory(item) {
    changeLanguage(item.language)
    // The draft effect would load the stored draft for that language; write this code there first.
    saveDraft(userId, p.id, item.language, item.code)
    if (item.language === language) setCode(item.code)
  }

  function resetCode() {
    clearDraft(userId, p.id, language)
    setCode(starter)
  }

  return (
    <div className="space-y-6">
      {/* z-30 keeps the timer panel above the glass cards below it. */}
      <div className="relative z-30 flex items-center justify-between gap-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-faint min-w-0">
          <Link to="/problems" className="hover:text-ink transition-colors shrink-0">Problems</Link>
          <IconChevronRight size={13} className="shrink-0" />
          <span className="text-muted truncate">{p.title}</span>
        </nav>
        <SolveTimer key={p.id} problemId={p.id} />
      </div>

      {/* Editor column is the wider one (55% on laptops, 60% on large screens). */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)] xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
        <section className="glass rounded-2xl min-w-0 overflow-hidden">
          <div className="flex items-center gap-1 px-3 h-12 border-b border-line" role="tablist">
            {[['description', 'Description'], ['submissions', 'Submissions']].map(([key, label]) => (
              <button key={key} role="tab" aria-selected={leftTab === key} onClick={() => setLeftTab(key)}
                className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors
                  ${leftTab === key ? 'bg-accent-soft text-ink' : 'text-muted hover:text-ink hover:bg-sunken'}`}>
                {label}
              </button>
            ))}
          </div>
          {leftTab === 'description'
            ? <Description p={p} />
            : <SubmissionHistory key={historyVersion} userId={userId} problemId={p.id} onLoad={loadFromHistory} />}
        </section>

        <section className="space-y-4 min-w-0">
          <div className="glass rounded-2xl overflow-hidden relative z-20">
            <div className="flex items-center justify-between gap-2 px-3 h-12 border-b border-line">
              <div className="flex items-center gap-2 min-w-0">
                <Select className="w-36" value={language} onChange={changeLanguage} ariaLabel="Language"
                  options={available.map((l) => ({ value: l.id, label: l.name }))} />
                <span className="hidden sm:inline-flex items-center h-7 px-3 rounded-lg bg-sunken border border-line font-mono text-xs text-ink">
                  {FILE[language]}
                </span>
                {savedAt && <span className="hidden md:inline text-[11px] text-faint">Draft saved</span>}
              </div>
              <button onClick={resetCode} className="btn btn-ghost h-8 px-2.5 text-xs shrink-0" title="Discard changes and restore the starter code">
                <IconRefresh size={13} /> Reset
              </button>
            </div>
            <div className="h-[520px] lg:h-[max(560px,calc(100dvh-14rem))]">
              <CodeEditor value={code} onChange={setCode} language={language} onRun={stableRun} onSubmit={stableSubmit} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-line">
              <span className="text-xs text-faint hidden sm:inline">
                <kbd className="font-mono">Ctrl+'</kbd> Run · <kbd className="font-mono">Ctrl+Enter</kbd> Submit
              </span>
              <div className="flex items-center gap-2 ml-auto">
                <button onClick={run} disabled={running || submitting || !code.trim()} className="btn btn-ghost min-w-24">
                  {running ? <><Spinner /> Running…</> : <><IconPlay size={14} /> Run</>}
                </button>
                <button onClick={submit} disabled={submitting || running || !code.trim()} className="btn btn-primary min-w-40">
                  {submitting ? <><Spinner /> {progressLabel(progress)}</> : <><IconCheck size={15} /> Submit</>}
                </button>
              </div>
            </div>
          </div>

          <Console
            tab={consoleTab} setTab={setConsoleTab} samples={p.sampleTests}
            customOn={customOn} setCustomOn={setCustomOn} customInput={customInput} setCustomInput={setCustomInput}
            running={running} runResult={runResult} runError={runError}
          />

          {submitError && <ErrorBox error={submitError} />}
          {result && <SubmissionResult key={result.attemptId} r={result} />}
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
      <p className="text-xs text-faint">Python gets 3× the time limit, because limits are set for Java.</p>
    </div>
  )
}

// The learner's own past attempts on this problem, newest first; any of them can be loaded back.
function SubmissionHistory({ userId, problemId, onLoad }) {
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
              <button onClick={() => onLoad(h)} className="btn btn-ghost h-8 px-3 text-xs">
                <IconCode size={14} /> Load into editor
              </button>
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
        <span className="ml-auto text-[11px] text-faint pr-1">Runs are not recorded</span>
      </div>
      <div className="p-4 max-h-96 overflow-auto">
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
          <pre className="font-mono text-[13px] whitespace-pre-wrap bg-brick-soft border border-brick/20 text-ink px-3 py-2.5 rounded-xl overflow-x-auto">
            {runResult.compileError}
          </pre>
        ) : (
          <div className="space-y-4">
            {runResult.cases.map((c) => (
              <div key={c.ordinal} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center h-6 px-2.5 rounded-full border text-xs font-medium ${STATUS_STYLE[c.status]}`}>
                    {c.kind === 'CUSTOM' ? 'Your input' : `Example ${c.ordinal}`}: {STATUS_TEXT[c.status]}
                  </span>
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
          <p className="text-muted">First problem on {ft.tag.toLowerCase()} test #{ft.ordinal}.</p>
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
          <h3 className="eyebrow mb-2">Every test, in run order</h3>
          <ul className="flex flex-wrap gap-1.5 stagger">
            {r.testResults.map((t) => (
              <li key={t.ordinal}
                title={`${t.tag} #${t.ordinal}: ${t.verdict} in ${t.runtimeMs} ms`}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border text-xs tabular-nums
                  ${t.verdict === 'ACCEPTED' ? 'bg-moss-soft text-moss border-moss/20' : 'bg-brick-soft text-brick border-brick/20'}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                {t.tag.toLowerCase()} {t.ordinal}: {t.runtimeMs} ms
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.largeRuntimeMs != null && r.optimalRuntimeMs != null && (
        <p className="text-sm text-muted">Largest input took {r.largeRuntimeMs} ms; reference solution takes about {r.optimalRuntimeMs} ms.</p>
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
