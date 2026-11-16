import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Markdown from 'react-markdown'
import { api } from '../api.js'
import { useApi } from '../useApi.js'
import { useUser } from '../UserContext.jsx'
import { ERROR_CATEGORY } from '../format.js'
import { DifficultyBadge, VerdictBadge } from '../components/Badges.jsx'
import ResourceList from '../components/ResourceList.jsx'
import { ErrorBox, Loading } from '../components/Status.jsx'

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
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="space-y-5 min-w-0">
        <div>
          <h1 className="text-2xl font-semibold">{p.title}</h1>
          <div className="flex gap-3 items-center mt-2 text-sm text-muted">
            <span>{p.topic.name}</span>
            <DifficultyBadge difficulty={p.difficulty} />
            <span>Time limit {p.timeLimitMs} ms</span>
            <span>Aim for {Math.round(p.targetSolveSeconds / 60)} min</span>
          </div>
        </div>

        <div className="markdown"><Markdown>{p.statement}</Markdown></div>

        <Block title="Input">{p.inputFormat}</Block>
        <Block title="Output">{p.outputFormat}</Block>

        <div>
          <h2 className="font-medium mb-2">
            Examples <span className="text-sm text-muted font-normal">({p.sampleTests.length} of {p.testCount} tests are shown; the rest are hidden)</span>
          </h2>
          {p.sampleTests.map((t) => (
            <div key={t.ordinal} className="grid grid-cols-2 gap-3 mb-3">
              <Block title="Input" mono>{t.input}</Block>
              <Block title="Expected output" mono>{t.expectedOutput}</Block>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4 min-w-0">
        <div className="flex justify-between items-center">
          <h2 className="font-medium">Your solution (Java, class Main)</h2>
          <button onClick={() => setCode(p.starterCode)} className="text-sm text-muted underline">
            Reset to starter code
          </button>
        </div>
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={onKeyDown}
          spellCheck={false}
          className="w-full h-[480px] font-mono text-sm p-3 border border-line rounded bg-white resize-y"
          aria-label="Code editor"
        />
        <button
          onClick={submit}
          disabled={submitting || !code.trim()}
          className="bg-moss text-white rounded px-5 py-2 disabled:opacity-50"
        >
          {/* Compiling and running every test in its own JVM takes a few seconds. */}
          {submitting ? 'Running all tests…' : 'Submit'}
        </button>

        {submitError && <ErrorBox error={submitError} />}
        {result && <SubmissionResult r={result} />}
      </section>
    </div>
  )
}

function Block({ title, children, mono }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm text-muted mb-1">{title}</h3>
      <pre className={`whitespace-pre-wrap bg-white border border-line rounded p-2 text-sm ${mono ? 'font-mono overflow-x-auto' : 'font-sans'}`}>
        {children}
      </pre>
    </div>
  )
}

// Renders POST /api/submissions response (CONTRACT.md 5.1).
function SubmissionResult({ r }) {
  const category = r.errorCategory && ERROR_CATEGORY[r.errorCategory]
  const ft = r.failedTest

  return (
    <div className="border border-line rounded bg-white p-4 space-y-4" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <VerdictBadge verdict={r.verdict} size="lg" />
        {r.totalCount > 0 && <span className="text-sm text-muted">{r.passedCount} of {r.totalCount} tests passed</span>}
      </div>

      {r.message && (
        // Compiler output keeps its line breaks and caret alignment, so it must be monospace.
        <pre className={`text-sm whitespace-pre-wrap ${r.verdict === 'COMPILE_ERROR' ? 'font-mono bg-brick-soft p-2 rounded overflow-x-auto' : 'font-sans'}`}>
          {r.message}
        </pre>
      )}

      {category && (
        <p className="text-sm">
          <span className="font-medium">Mistake type: {category.label}.</span>{' '}
          <span className="text-muted">{category.hint}</span>
        </p>
      )}

      {ft && (
        <div className="text-sm">
          <p>First problem on {ft.tag.toLowerCase()} test #{ft.ordinal}.</p>
          {/* Only SAMPLE tests carry data; hidden tests come back null on purpose so they can't be copied. */}
          {ft.input != null && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              <Block title="Input" mono>{ft.input}</Block>
              <Block title="Expected" mono>{ft.expectedOutput}</Block>
              <Block title="Your output" mono>{ft.actualOutput}</Block>
            </div>
          )}
        </div>
      )}

      {r.testResults.length > 0 && (
        <div>
          <h3 className="text-sm text-muted mb-1">Every test, in run order</h3>
          <ul className="flex flex-wrap gap-1.5">
            {r.testResults.map((t) => (
              <li key={t.ordinal}
                title={`${t.tag} #${t.ordinal}: ${t.verdict} in ${t.runtimeMs} ms`}
                className={`text-xs px-2 py-1 rounded ${t.verdict === 'ACCEPTED' ? 'bg-moss-soft text-moss' : 'bg-brick-soft text-brick'}`}>
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
          <h3 className="text-sm text-muted mb-1">Study this</h3>
          <ResourceList resources={r.resources} />
        </div>
      )}
    </div>
  )
}
