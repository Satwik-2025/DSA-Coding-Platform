import { IconSpark } from './Icons.jsx'

// Submissions per day as a calendar heatmap: one column per week (Sunday at the top), newest on the right.
// Colour steps are relative to the busiest day, so a light week still shows its shape.
export default function ActivityHeatmap({ activity }) {
  const days = activity.days
  const max = Math.max(1, ...days.map((d) => d.submissions))
  const level = (n) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)))

  // Pad the start so the first column begins on a Sunday.
  const first = new Date(`${days[0].date}T00:00:00Z`)
  const cells = [...Array(first.getUTCDay()).fill(null), ...days]
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  // Month label above the first week that starts a new month.
  const monthOf = (w) => w.find(Boolean)?.date.slice(0, 7)
  const labels = weeks.map((w, i) => (i === 0 || monthOf(w) !== monthOf(weeks[i - 1])
    ? new Date(`${w.find(Boolean).date}T00:00:00Z`).toLocaleDateString([], { month: 'short', timeZone: 'UTC' })
    : ''))

  return (
    <div className="glass rounded-2xl p-5 sm:p-6 space-y-5">
      <div className="grid grid-cols-3 gap-3 max-w-md">
        <Stat value={activity.currentStreak} label="Day streak" highlight />
        <Stat value={activity.longestStreak} label="Longest streak" />
        <Stat value={activity.activeDays} label="Active days" />
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex flex-col gap-1.5 min-w-full">
          <div className="flex gap-[3px] pl-0 text-[10px] text-faint h-3">
            {labels.map((l, i) => <span key={i} className="w-3 shrink-0 overflow-visible whitespace-nowrap">{l}</span>)}
          </div>
          <div className="flex gap-[3px]" role="img"
            aria-label={`${activity.totalSubmissions} submissions on ${activity.activeDays} days in the last ${days.length} days`}>
            {weeks.map((w, i) => (
              <div key={i} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }, (_, j) => {
                  const d = w[j]
                  if (!d) return <span key={j} className="h-3 w-3" />
                  const lv = level(d.submissions)
                  return (
                    <span key={j} title={`${d.date}: ${d.submissions} submission${d.submissions === 1 ? '' : 's'}, ${d.accepted} accepted`}
                      className="h-3 w-3 rounded-[3px] border border-line"
                      style={{ background: lv === 0 ? 'var(--sunken)' : `color-mix(in srgb, var(--accent) ${[0, 30, 55, 78, 100][lv]}%, transparent)` }} />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 text-xs text-faint">
        <span>{activity.totalSubmissions} submissions in the last {Math.round(days.length / 30)} months</span>
        <span className="flex items-center gap-1.5">
          Less
          {[0, 1, 2, 3, 4].map((lv) => (
            <span key={lv} className="h-2.5 w-2.5 rounded-[3px] border border-line"
              style={{ background: lv === 0 ? 'var(--sunken)' : `color-mix(in srgb, var(--accent) ${[0, 30, 55, 78, 100][lv]}%, transparent)` }} />
          ))}
          More
        </span>
      </div>
    </div>
  )
}

function Stat({ value, label, highlight }) {
  return (
    <div className="rounded-xl px-3 py-2.5 bg-sunken border border-line">
      <div className={`display text-3xl tabular-nums flex items-center gap-1.5 ${highlight && value > 0 ? 'text-accent' : 'text-ink'}`}>
        {value}{highlight && value > 0 && <IconSpark size={16} />}
      </div>
      <div className="text-[11px] text-faint mt-0.5">{label}</div>
    </div>
  )
}
