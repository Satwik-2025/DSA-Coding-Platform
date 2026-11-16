import { useTheme } from '../theme.jsx'
import { IconMoon, IconSun } from './Icons.jsx'

// Two-position switch (moon = dark, sun = light) with a sliding knob. compact = icon-only button.
export default function ThemeToggle({ compact = false }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'

  if (compact) {
    return (
      <button type="button" onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={dark ? 'Light mode' : 'Dark mode'}
        className="btn btn-ghost h-10 w-10 p-0 rounded-xl">
        {dark ? <IconSun size={18} /> : <IconMoon size={18} />}
      </button>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      onClick={toggle}
      className="relative grid grid-cols-2 h-10 w-full rounded-xl p-1 bg-sunken border border-line text-xs font-medium cursor-pointer"
    >
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-surface-strong border border-line-strong shadow-sm transition-transform duration-300 ease-out-soft"
        style={{ transform: dark ? 'translateX(0)' : 'translateX(100%)' }}
      />
      <span className={`relative z-10 flex items-center justify-center gap-1.5 transition-colors ${dark ? 'text-ink' : 'text-faint'}`}>
        <IconMoon size={15} /> Dark
      </span>
      <span className={`relative z-10 flex items-center justify-center gap-1.5 transition-colors ${dark ? 'text-faint' : 'text-ink'}`}>
        <IconSun size={15} /> Light
      </span>
    </button>
  )
}
