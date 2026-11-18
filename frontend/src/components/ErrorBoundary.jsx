import { Component } from 'react'
import { IconAlert, IconRefresh } from './Icons.jsx'

// Catches an error thrown while a page renders (or while its code downloads) so only that page shows
// a message; the sidebar and the rest of the app keep working. Without it React unmounts everything
// and the whole screen goes blank.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Page crashed:', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    // A failed dynamic import usually means the site was updated while this tab was open.
    const stale = /dynamically imported module|Importing a module script failed|Loading chunk/i.test(error.message ?? '')
    return (
      <div role="alert" className="glass rounded-2xl p-6 sm:p-8 max-w-xl space-y-4 animate-fade-up">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brick-soft text-brick">
          <IconAlert size={20} />
        </span>
        <h1 className="text-lg font-semibold text-ink">This page ran into a problem</h1>
        <p className="text-sm text-muted">
          {stale
            ? 'The site was updated while this tab was open. Reload the page to get the new version.'
            : 'Something went wrong while showing this page. Reloading usually fixes it; your saved work is kept.'}
        </p>
        {!stale && error.message && <pre className="text-xs text-faint whitespace-pre-wrap break-words">{error.message}</pre>}
        <button type="button" onClick={() => window.location.reload()} className="btn btn-primary">
          <IconRefresh size={14} /> Reload the page
        </button>
      </div>
    )
  }
}
