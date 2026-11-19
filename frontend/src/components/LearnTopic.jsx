import { useState } from 'react'
import { IconBook, IconExternal, IconPlay, IconSpark } from './Icons.jsx'

// "Learn This Topic" tab on a problem page (GET /api/problems/{id} -> learn): the key idea the problem
// needs, hand-picked YouTube videos and reading. A video plays right here after a click (the player
// is only loaded then), or opens on YouTube in a new tab.
export default function LearnTopic({ learn, problemTitle }) {
  const [playing, setPlaying] = useState(null)
  const videos = learn?.videos ?? []
  const reading = learn?.reading ?? []

  if (videos.length === 0 && reading.length === 0) {
    return <p className="p-7 text-sm text-muted text-center">No learning resources for this problem yet.</p>
  }

  return (
    <div className="p-5 sm:p-7 space-y-8">
      {learn.concept && (
        <div className="rounded-2xl px-4 py-3.5 bg-accent-soft border border-accent/15 flex gap-3">
          <IconSpark size={18} className="text-accent mt-0.5 shrink-0" />
          <div className="space-y-0.5">
            <p className="eyebrow">Key idea</p>
            <p className="text-ink font-medium">{learn.concept}</p>
            <p className="text-sm text-muted">
              Watch a video and read an article about this idea first; then {problemTitle} will feel much easier.
            </p>
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <section className="space-y-3" aria-labelledby="learn-videos">
          <h2 id="learn-videos" className="text-sm font-semibold text-ink">Videos</h2>
          <ul className="space-y-4">
            {videos.map((v) => (
              <li key={v.youtubeId} className="rounded-2xl border border-line bg-surface overflow-hidden">
                {playing === v.youtubeId ? (
                  <div className="aspect-video bg-black">
                    <iframe
                      className="w-full h-full"
                      src={`${v.embedUrl}?autoplay=1&rel=0`}
                      title={v.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <button type="button" onClick={() => setPlaying(v.youtubeId)}
                    className="group relative block w-full aspect-video bg-sunken overflow-hidden"
                    aria-label={`Play "${v.title}" here`}>
                    <img src={v.thumbnailUrl} alt="" loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/20 transition-colors">
                      <span className="flex items-center justify-center h-14 w-14 rounded-full bg-black/75 text-white shadow-lg ring-2 ring-white/80 group-hover:scale-105 transition-transform">
                        <IconPlay size={22} />
                      </span>
                    </span>
                  </button>
                )}
                <div className="p-4 space-y-2">
                  <p className="text-sm font-medium text-ink leading-snug">{v.title}</p>
                  <p className="text-xs text-faint">{v.channel} · YouTube</p>
                  <p className="text-sm text-muted">{v.about}</p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {playing !== v.youtubeId && (
                      <button type="button" onClick={() => setPlaying(v.youtubeId)} className="btn btn-ghost h-8 px-3 text-xs">
                        <IconPlay size={13} /> Watch here
                      </button>
                    )}
                    <a href={v.watchUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost h-8 px-3 text-xs">
                      <IconExternal size={13} /> Open on YouTube
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reading.length > 0 && (
        <section className="space-y-3" aria-labelledby="learn-reading">
          <h2 id="learn-reading" className="text-sm font-semibold text-ink">Reading</h2>
          <ul className="space-y-2.5">
            {reading.map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noopener noreferrer"
                  className="group flex gap-3 rounded-2xl px-4 py-3.5 border border-line bg-surface hover:border-line-strong hover:bg-accent-soft transition-colors">
                  <IconBook size={16} className="text-accent mt-0.5 shrink-0" />
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-sm font-medium text-ink group-hover:text-accent transition-colors">{r.title}</span>
                    <span className="block text-xs text-faint">{r.site}</span>
                    <span className="block text-sm text-muted">{r.about}</span>
                  </span>
                  <IconExternal size={14} className="text-faint group-hover:text-accent mt-0.5 shrink-0 transition-colors" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
