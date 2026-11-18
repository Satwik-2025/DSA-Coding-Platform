import { useCallback, useEffect, useState } from 'react'

// Every page needs the same loading / error / data triple. One hook keeps pages about
// WHAT to show, not HOW to fetch. Old data is kept while reloading so the page doesn't flicker.
export function useApi(fetcher, deps) {
  const [state, setState] = useState({ data: null, error: null, loading: true })

  // The caller passes the dependencies (like useEffect), so the linter cannot check them here.
  const load = useCallback(() => {
    let cancelled = false // ignore a slow response that arrives after the user switched learner
    setState((s) => ({ ...s, loading: true, error: null }))
    fetcher().then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (error) => !cancelled && setState({ data: null, error, loading: false }),
    )
    return () => { cancelled = true }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(load, [load])
  return { ...state, reload: load }
}
