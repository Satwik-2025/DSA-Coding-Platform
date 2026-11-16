import { useEffect, useId, useRef, useState } from 'react'
import { IconCheck, IconChevronDown } from './Icons.jsx'

// Styled, animated replacement for <select>. Same contract as before: a value and an onChange
// that receives the chosen option's value. Keyboard: Up/Down/Home/End to move, Enter/Space to
// pick, Escape to close. Options are { value, label }.
export default function Select({ value, onChange, options, label, ariaLabel, icon, className = '', align = 'left', placement = 'down' }) {
  const [open, setOpen] = useState(false)
  const [active, setActiveState] = useState(0)
  // Mirrors `active` synchronously, so Enter right after fast arrow presses picks the highlighted option.
  const activeRef = useRef(0)
  const setActive = (i) => { activeRef.current = i; setActiveState(i) }
  const rootRef = useRef(null)
  const listRef = useRef(null)
  const id = useId()
  const selected = options.find((o) => String(o.value) === String(value))

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  useEffect(() => {
    if (open) listRef.current?.focus()
  }, [open])

  function openList() {
    const i = options.findIndex((o) => String(o.value) === String(value))
    setActive(i < 0 ? 0 : i)
    setOpen(true)
  }

  function choose(o) {
    setOpen(false)
    rootRef.current?.querySelector('button')?.focus() // keep keyboard focus on the control, not <body>
    if (String(o.value) !== String(value)) onChange(o.value)
  }

  function onListKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(options.length - 1, activeRef.current + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(0, activeRef.current - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(options.length - 1) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(options[activeRef.current]) }
    else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.stopPropagation() // close only this list, not the mobile menu around it
      setOpen(false)
      rootRef.current?.querySelector('button')?.focus()
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={(label || ariaLabel) ? `${label || ariaLabel}: ${selected?.label ?? ''}` : undefined}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={(e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); openList() } }}
        className="field w-full h-10 pl-3 pr-2.5 flex items-center gap-2 text-sm text-left cursor-pointer"
      >
        {icon}
        {label && <span className="text-faint">{label}</span>}
        <span className="truncate font-medium">{selected?.label ?? '—'}</span>
        <IconChevronDown size={16} className={`ml-auto text-faint transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKey}
          className={`glass-strong animate-pop-in absolute z-50 min-w-full w-max max-w-72 max-h-72 overflow-auto rounded-xl p-1.5 outline-none
            ${placement === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'} ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {options.map((o, i) => {
            const isSel = String(o.value) === String(value)
            return (
              <li
                key={o.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={isSel}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(o)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors
                  ${i === active ? 'bg-accent-soft text-ink' : 'text-muted'}`}
              >
                <span className="truncate">{o.label}</span>
                {isSel && <IconCheck size={16} className="ml-auto text-accent" />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
