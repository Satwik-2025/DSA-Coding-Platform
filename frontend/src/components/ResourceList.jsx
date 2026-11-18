import { IconBook, IconExternal, IconPlay } from './Icons.jsx'

// Study links returned by the backend (CONTRACT.md section 4.5).
// Search links say "YouTube search: ..." in their title; direct articles get their source named.
export default function ResourceList({ resources }) {
  if (!resources?.length) return null
  return (
    <ul className="space-y-1.5 text-sm">
      {resources.map((r) => (
        <li key={r.url}>
          <a href={r.url} target="_blank" rel="noopener noreferrer"
            className="group flex items-center gap-3 rounded-xl px-3 py-2 border border-line bg-sunken hover:border-line-strong hover:bg-accent-soft transition-colors">
            <span className="text-accent">{r.source === 'YOUTUBE' ? <IconPlay size={15} /> : <IconBook size={15} />}</span>
            <span className="min-w-0 flex-1 truncate text-ink/90 group-hover:text-ink">
              {r.title}
              {!r.generated && (
                <span className="text-faint"> ({r.source === 'YOUTUBE' ? 'YouTube' : 'GeeksforGeeks'})</span>
              )}
            </span>
            <IconExternal size={14} className="text-faint group-hover:text-accent transition-colors" />
          </a>
        </li>
      ))}
    </ul>
  )
}
