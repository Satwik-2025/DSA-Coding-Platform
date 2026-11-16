import { createContext, useCallback, useContext, useState } from 'react'
import { flushSync } from 'react-dom'

// Light is the default. index.html applies the saved theme before first paint, so this just reads it back.
const ThemeContext = createContext(null)

const current = () => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
export const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(current)

  const apply = useCallback((next) => {
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Private mode or blocked storage: the theme still switches, it just isn't remembered.
    }
    flushSync(() => setTheme(next)) // charts read the theme from React, so update them in the same frame
  }, [])

  const toggle = useCallback(() => {
    const next = current() === 'dark' ? 'light' : 'dark'
    if (prefersReducedMotion()) return apply(next)
    if (document.startViewTransition) {
      // One cross-fade of the whole page, no flicker. The browser runs the callback on its next
      // rendered frame; if frames are paused (background window), switch anyway after a moment.
      let done = false
      const run = () => { if (!done) { done = true; apply(next) } }
      document.startViewTransition(run)
      window.setTimeout(run, 400)
      return
    }
    const root = document.documentElement
    root.classList.add('theme-switching')
    apply(next)
    window.setTimeout(() => root.classList.remove('theme-switching'), 320)
  }, [apply])

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)

// SVG chart libraries take colours as attributes, where CSS variables don't resolve, so charts
// get concrete values per theme. They mirror the variables in index.css.
export const CHART = {
  dark: {
    accent: '#d6b886', moss: '#8cc4a4', amber: '#e2b062', grid: 'rgba(255,236,205,0.07)',
    axis: '#70685e', text: '#a69d90',
  },
  light: {
    accent: '#8a6a3d', moss: '#2d6a50', amber: '#96620f', grid: 'rgba(40,30,15,0.08)',
    axis: '#9b948a', text: '#6a645b',
  },
}
