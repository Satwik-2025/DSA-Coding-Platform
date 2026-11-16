// Study links returned by the backend (CONTRACT.md section 4.5).
// Generated links already say "... search: ..." in their title; curated ones get their source named.
export default function ResourceList({ resources }) {
  if (!resources?.length) return null
  return (
    <ul className="space-y-1 text-sm">
      {resources.map((r) => (
        <li key={r.url}>
          <a href={r.url} target="_blank" rel="noreferrer" className="text-moss underline">
            {r.title}
          </a>
          {!r.generated && (
            <span className="text-muted"> ({r.source === 'YOUTUBE' ? 'YouTube' : 'GeeksforGeeks'})</span>
          )}
        </li>
      ))}
    </ul>
  )
}
