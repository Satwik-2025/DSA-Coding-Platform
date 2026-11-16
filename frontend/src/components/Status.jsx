export function Loading({ text = 'Loading…' }) {
  return <p className="text-muted">{text}</p>
}

export function ErrorBox({ error, onRetry }) {
  return (
    <div className="border border-brick bg-brick-soft text-brick rounded p-4">
      <p>{error.message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 underline">Try again</button>
      )}
    </div>
  )
}
