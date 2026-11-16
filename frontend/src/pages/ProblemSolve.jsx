import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Markdown from 'react-markdown'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { ERROR_CATEGORY } from '../format.js'
import { DifficultyBadge, VerdictBadge } from '../components/Badges.jsx'
import ResourceList from '../components/ResourceList.jsx'
import { ErrorBox, Loading, Spinner } from '../components/Status.jsx'
import { IconChevronRight, IconClock, IconPlay, IconRefresh, IconTarget } from '../components/Icons.jsx'

export default function ProblemSolve() {
  const { id } = useParams()
  const { userId } = useUser()
  const problem = useApi(() => api.problem(id), [id])

  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const [submitError, setSubmitError] = useState(null)
  // Contract: timeSpentSeconds is measured "from problem open to submit" (feeds speed_vs_target).
  const openedAt = useRef(Date.now())

  // New problem loaded: start from its starter code and restart the clock.
  useEffect(() => {
    if (problem.data) {
      setCode(problem.data.starterCode)
      setResult(null)
      openedAt.current = Date.now()
    }
  }, [problem.data?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (problem.error) return <ErrorBox error={problem.error} onRetry={problem.reload} />
  if (!problem.data) return <Loading />
  const p = problem.data

  async function submit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const seconds = Math.round((Date.now() - openedAt.current) / 1000)
      setResult(await api.submit(userId, p.id, code, seconds))
    } catch (e) {
      setSubmitError(e)
    } finally {
      setSubmitting(false)
    }
  }

  // A plain textarea moves focus on Tab, which makes indenting code impossible; insert spaces instead.
  function onKeyDown(e) {
    if (e.key !== 'Tab') return
    e.preventDefault()
    const { selectionStart: start, selectionEnd: end } = e.target
    setCode(code.slice(0, start) + '    ' + code.slice(end))
    requestAnimationFrame(() => { e.target.selectionStart = e.target.selectionEnd = start + 4 })
  }

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-faint">
        <Link to="/problems" className="hover:text-ink transition-colors">Problems</Link>
        <IconChevronRight size={13} />
        <span className="text-muted truncate">{p.title}</span>
      </nav>

      {/* Editor column is the wider one (55% on laptops, 60% on large screens). */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,9fr)_minmax(0,11fr)] xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start">
        <section className="glass rounded-2xl p-5 sm:p-7 space-y-6 min-w-0">
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
        </section>

        <section className="space-y-4 min-w-0 lg:sticky lg:top-8">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 h-12 border-b border-line">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center h-7 px-3 rounded-lg bg-sunken border border-line font-mono text-xs text-ink">Main.java</span>
                <h2 className="text-xs text-faint truncate">Your solution (Java, class Main)</h2>
              </div>
              <button onClick={() => setCode(p.starterCode)} className="btn btn-ghost h-8 px-2.5 text-xs shrink-0">
                <IconRefresh size={13} /> Reset to starter code
              </button>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={onKeyDown}
              spellCheck={false}
              className="block w-full h-[520px] lg:h-[max(560px,calc(100dvh-14rem))] font-mono text-[13px] leading-6 px-4 py-3 text-ink resize-y outline-none border-0 focus:shadow-[inset_0_0_0_1px_var(--accent)] transition-shadow"
              style={{ background: 'var(--code-bg)', tabSize: 4, caretColor: 'var(--accent)' }}
              aria-label="Code editor"
            />
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-line">
              <span className="text-xs text-faint">Each test runs in its own JVM.</span>
              <button
                onClick={submit}
                disabled={submitting || !code.trim()}
                className="btn btn-primary min-w-36"
              >
                {/* Compiling and running every test in its own JVM takes a few seconds. */}
                {submitting ? <><Spinner /> Running all tests…</> : <><IconPlay size={15} /> Submit</>}
              </button>
            </div>
          </div>

          {submitError && <ErrorBox error={submitError} />}
          {result && <SubmissionResult key={result.attemptId} r={result} />}
        </section>
      </div>
    </div>
  )
}

function Block({ title, children, mono }) {
  return (
    <div className="min-w-0">
      <h3 className="eyebrow mb-1.5">{title}</h3>
      <pre className={`whitespace-pre-wrap rounded-xl border border-line bg-sunken px-3 py-2.5 text-sm text-ink ${mono ? 'font-mono text-[13px] overflow-x-auto' : 'font-sans'}`}>
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

  return (
    <div className={`glass rounded-2xl p-5 space-y-5 animate-fade-up ${ok ? 'ring-1 ring-moss/25' : 'ring-1 ring-brick/20'}`} aria-live="polite">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <VerdictBadge verdict={r.verdict} size="lg" />
          {r.totalCount > 0 && <span className="text-sm text-muted">{r.passedCount} of {r.totalCount} tests passed</span>}
        </div>
        {r.totalCount > 0 && (
          <div className="h-1.5 rounded-full bg-sunken overflow-hidden" aria-hidden="true">
            <div className={`h-full rounded-full animate-grow-x ${ok ? 'bg-moss' : 'bg-brick'}`}
              style={{ width: `${(r.passedCount / r.totalCount) * 100}%` }} />
          </div>
        )}
      </div>

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
