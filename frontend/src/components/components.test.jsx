import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import Select from './Select.jsx'
import ActivityHeatmap from './ActivityHeatmap.jsx'
import ErrorBoundary from './ErrorBoundary.jsx'
import { api } from '../api.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Select', () => {
  const options = [{ value: '', label: 'All' }, { value: 'EASY', label: 'Easy' }, { value: 'MEDIUM', label: 'Medium' }]

  it('opens on click and reports the clicked option', () => {
    const onChange = vi.fn()
    render(<Select label="Difficulty" value="" onChange={onChange} options={options} />)
    fireEvent.click(screen.getByRole('button', { name: 'Difficulty: All' }))
    fireEvent.click(screen.getByRole('option', { name: 'Medium' }))
    expect(onChange).toHaveBeenCalledWith('MEDIUM')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('supports the keyboard: arrows move, Enter picks, Escape closes', () => {
    const onChange = vi.fn()
    render(<Select label="Difficulty" value="" onChange={onChange} options={options} />)
    const trigger = screen.getByRole('button', { name: 'Difficulty: All' })
    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const list = screen.getByRole('listbox')
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'ArrowDown' })
    fireEvent.keyDown(list, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('MEDIUM')

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})

describe('ActivityHeatmap', () => {
  it('draws one cell per day and the streak numbers', () => {
    const days = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-11-${String(i + 3).padStart(2, '0')}`, submissions: i % 3, accepted: 0,
    }))
    render(<ActivityHeatmap activity={{ currentStreak: 2, longestStreak: 5, activeDays: 9, totalSubmissions: 13, days }} />)
    expect(screen.getByRole('img').querySelectorAll('span[title]')).toHaveLength(14)
    expect(screen.getByText('Longest streak').previousSibling.textContent).toBe('5')
  })
})

describe('api', () => {
  it('surfaces the backend error message and status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'TOO_MANY_REQUESTS', message: 'Too many runs' }), { status: 429 }))
    await expect(api.run(1, 2, 'x', 'JAVA')).rejects.toMatchObject({ message: 'Too many runs', status: 429 })
  })

  it('explains an unreachable backend when the proxy answers without JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Bad Gateway', { status: 502 }))
    await expect(api.users()).rejects.toThrow(/Is Spring Boot running/)
  })
})

describe('ErrorBoundary', () => {
  it('shows a message instead of blanking the app when a page throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Broken = () => { throw new Error('boom') }
    render(<div><p>sidebar</p><ErrorBoundary><Broken /></ErrorBoundary></div>)
    expect(screen.getByText('sidebar')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('This page ran into a problem')
    expect(screen.getByRole('button', { name: /Reload the page/ })).toBeTruthy()
  })

  it('explains a failed page download as an update', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const Stale = () => { throw new TypeError('Failed to fetch dynamically imported module: /assets/x.js') }
    render(<ErrorBoundary><Stale /></ErrorBoundary>)
    expect(screen.getByRole('alert').textContent).toContain('The site was updated')
  })
})
