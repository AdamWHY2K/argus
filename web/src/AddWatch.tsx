import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, previewShotUrl } from './api'
import type { Preview, WatchMode } from './api'
import { SelectorPicker } from './components/SelectorPicker'
import { Eye } from './components/Eye'

const MODES: {
  id: WatchMode
  label: string
  blurb: string
  glyph: React.ReactNode
}[] = [
  {
    id: 'text',
    label: 'Text',
    blurb: 'The words on the page. Ignores layout and styling.',
    glyph: (
      <g>
        <rect x="3" y="5" width="26" height="2.5" rx="1.25" />
        <rect x="3" y="11" width="20" height="2.5" rx="1.25" />
        <rect x="3" y="17" width="24" height="2.5" rx="1.25" />
        <rect x="3" y="23" width="14" height="2.5" rx="1.25" />
      </g>
    ),
  },
  {
    id: 'element',
    label: 'Element',
    blurb: 'One part of the page, chosen with a CSS selector.',
    glyph: (
      <g>
        <rect x="3" y="5" width="26" height="2.5" rx="1.25" opacity="0.3" />
        <rect x="2" y="11" width="28" height="9" rx="2" fill="none" strokeWidth="2" stroke="currentColor" />
        <rect x="5" y="14.5" width="16" height="2" rx="1" />
        <rect x="3" y="23" width="14" height="2.5" rx="1.25" opacity="0.3" />
      </g>
    ),
  },
  {
    id: 'visual',
    label: 'Visual',
    blurb: 'How the page looks, compared pixel by pixel.',
    glyph: (
      <g>
        <rect x="2" y="4" width="28" height="23" rx="2" fill="none" strokeWidth="2" stroke="currentColor" />
        <circle cx="10" cy="12" r="2.6" />
        <path d="M5 24l7-8 5 5 4-3 5 6z" />
      </g>
    ),
  },
]

const INTERVALS = [
  { label: '5 min', sec: 300 },
  { label: '15 min', sec: 900 },
  { label: '1 hour', sec: 3600 },
  { label: '6 hours', sec: 21600 },
  { label: 'Daily', sec: 86400 },
]

const STREAMS = ['', 'claude', 'theater', 'cv', 'alarms', 'digest', 'jobs']

export function AddWatch() {
  const navigate = useNavigate()

  const [url, setUrl] = useState('')
  const [mode, setMode] = useState<WatchMode>('text')
  const [selector, setSelector] = useState('')
  const [interval, setInterval] = useState(3600)
  const [render, setRender] = useState(false)
  const [waitMs, setWaitMs] = useState(0)
  const [minChangePct, setMinChangePct] = useState(0)
  const [name, setName] = useState('')
  const [stream, setStream] = useState('')

  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [picking, setPicking] = useState(false)
  const read = useRef(false)

  const runPreview = useCallback(
    async (over?: { mode?: WatchMode; selector?: string; render?: boolean }) => {
      const target = url.trim()
      if (!target) return
      setLoading(true)
      setError(null)
      try {
        const p = await api.preview({
          url: target,
          mode: over?.mode ?? mode,
          selector: over?.selector ?? selector,
          render: over?.render ?? render,
        })
        setPreview(p)
        read.current = true
        if (!name && p.title) setName(p.title)
      } catch (e) {
        setPreview(null)
        setError((e as Error).message)
      } finally {
        setLoading(false)
      }
    },
    [url, mode, selector, render, name],
  )

  // Once the page has been read, changing what's compared re-previews on its own.
  useEffect(() => {
    if (!read.current) return
    const t = setTimeout(() => void runPreview(), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, selector, render])

  const create = async () => {
    setSaving(true)
    setError(null)
    try {
      const watch = await api.create({
        url: url.trim(),
        name: name.trim() || undefined,
        mode,
        selector: selector.trim() || null,
        interval_sec: interval,
        render: render || mode === 'visual' ? 1 : 0,
        wait_ms: waitMs,
        min_change_pct: minChangePct,
        notify_stream: stream || null,
      })
      navigate(`/w/${watch.id}`)
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  const canSave = !!url.trim() && read.current && (mode !== 'element' || !!selector.trim())

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-ground/90 px-5 py-3 backdrop-blur">
        <Link to="/" className="btn-ghost btn px-2 py-1" aria-label="Back to all watches">
          <Eye className="h-4 w-4 text-change-ink" />
        </Link>
        <h1 className="font-mono text-xs tracking-[0.16em] uppercase">Watch a page</h1>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,520px)_1fr]">
        {/* ---- form ---- */}
        <div className="min-h-0 divide-y divide-line overflow-auto border-line lg:border-r">
          <Step n={1} title="The page">
            <div className="flex gap-1.5">
              <input
                className="field font-mono text-[13px]"
                placeholder="https://example.com/pricing"
                value={url}
                autoFocus
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runPreview()}
              />
              <button className="btn shrink-0" onClick={() => runPreview()} disabled={!url.trim() || loading}>
                {loading ? 'Reading…' : read.current ? 'Read again' : 'Read the page'}
              </button>
            </div>
            {preview?.title && (
              <p className="mt-2 truncate text-xs text-ink" title={preview.title}>
                {preview.title}
              </p>
            )}
            {error && (
              <p className="mt-2 rounded border border-warn/40 bg-warn/8 px-3 py-2 text-xs text-warn">
                Couldn't read that page — {error}
              </p>
            )}
          </Step>

          <Step n={2} title="What counts as a change" muted={!read.current}>
            <div className="grid grid-cols-3 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setMode(m.id)
                    if (m.id === 'visual') setRender(true)
                  }}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    mode === m.id
                      ? 'border-change/60 bg-change/8'
                      : 'border-line bg-panel hover:border-faint'
                  }`}
                >
                  <svg
                    viewBox="0 0 32 32"
                    className={`mb-2 h-6 w-6 ${mode === m.id ? 'text-change-ink' : 'text-faint'}`}
                    fill="currentColor"
                  >
                    {m.glyph}
                  </svg>
                  <span className={`block text-sm ${mode === m.id ? 'text-ink' : 'text-dim'}`}>{m.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-dim">{MODES.find((m) => m.id === mode)?.blurb}</p>

            {(mode === 'element' || mode === 'visual') && (
              <div className="mt-3">
                <label className="mb-1 block text-xs text-dim">
                  {mode === 'element' ? 'Which element' : 'Limit to one element (optional)'}
                </label>
                <div className="flex gap-1.5">
                  <input
                    className="field font-mono text-[13px]"
                    placeholder="#main .price"
                    value={selector}
                    onChange={(e) => setSelector(e.target.value)}
                  />
                  <button
                    className="btn shrink-0"
                    onClick={() => setPicking(true)}
                    disabled={!url.trim()}
                    title="Open the page and click the element"
                  >
                    Pick it
                  </button>
                </div>
                {selector && preview && !preview.selectorMatched && (
                  <p className="mt-1.5 text-[12px] text-warn">
                    That selector doesn't match anything on the page.
                  </p>
                )}
              </div>
            )}
          </Step>

          <Step n={3} title="How often" muted={!read.current}>
            <div className="flex flex-wrap gap-1.5">
              {INTERVALS.map((i) => (
                <button
                  key={i.sec}
                  onClick={() => setInterval(i.sec)}
                  className={`chip border px-2 py-1 transition-colors ${
                    interval === i.sec
                      ? 'border-change/60 bg-change/12 text-change-ink'
                      : 'border-line text-dim hover:text-ink'
                  }`}
                >
                  {i.label}
                </button>
              ))}
              <span className="inline-flex items-center gap-1.5">
                <input
                  type="number"
                  min={30}
                  className="field w-24 font-mono text-[13px]"
                  value={interval}
                  onChange={(e) => setInterval(Math.max(30, Number(e.target.value) || 30))}
                />
                <span className="lbl">sec</span>
              </span>
            </div>

            <label className="mt-3 flex items-start gap-2 text-xs text-dim">
              <input
                type="checkbox"
                checked={render || mode === 'visual'}
                disabled={mode === 'visual'}
                onChange={(e) => setRender(e.target.checked)}
                className="mt-0.5 accent-[var(--color-change)]"
              />
              <span>
                Load it with a browser first
                <span className="block text-[12px] text-faint">
                  {mode === 'visual'
                    ? 'Always on for visual watches.'
                    : 'Needed for pages that build their content in JavaScript.'}
                </span>
              </span>
            </label>
          </Step>

          <details className="group">
            <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 text-xs text-dim hover:text-ink">
              <span className="lbl">4</span> More options
              <span className="ml-auto text-faint transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="space-y-3 px-5 pb-5">
              <div>
                <label className="mb-1 block text-xs text-dim">Name</label>
                <input
                  className="field"
                  placeholder={preview?.title ?? 'Taken from the page title'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-dim">Ignore changes under</label>
                <span className="inline-flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    className="field w-24 font-mono text-[13px]"
                    value={minChangePct}
                    onChange={(e) => setMinChangePct(Number(e.target.value) || 0)}
                  />
                  <span className="lbl">%</span>
                </span>
                <p className="mt-1 text-[12px] text-faint">
                  Anything smaller is recorded but not announced.
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-dim">Settle delay</label>
                <span className="inline-flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    step={250}
                    className="field w-24 font-mono text-[13px]"
                    value={waitMs}
                    onChange={(e) => setWaitMs(Number(e.target.value) || 0)}
                  />
                  <span className="lbl">ms</span>
                </span>
                <p className="mt-1 text-[12px] text-faint">Extra wait after load, for slow widgets.</p>
              </div>
              <div>
                <label className="mb-1 block text-xs text-dim">Tell me on Telegram</label>
                <select className="field" value={stream} onChange={(e) => setStream(e.target.value)}>
                  {STREAMS.map((s) => (
                    <option key={s} value={s}>
                      {s || 'General'}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[12px] text-faint">
                  Ignore rules and webhooks can be set once the watch exists.
                </p>
              </div>
            </div>
          </details>
        </div>

        {/* ---- preview ---- */}
        <div className="flex min-h-0 flex-col">
          <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
            <span className="lbl">This is what argus will compare</span>
            {preview && (
              <span className="ml-auto font-mono text-[12px] text-faint">
                {mode === 'visual' && preview.hasShot
                  ? selector
                    ? 'element screenshot'
                    : 'full-page screenshot'
                  : `${preview.chars.toLocaleString()} characters`}
              </span>
            )}
          </div>

          <div className={`min-h-0 flex-1 overflow-auto ${mode === 'visual' ? 'shot-bg' : ''}`}>
            {loading ? (
              <p className="p-6 text-sm text-dim">Reading the page…</p>
            ) : !preview ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <Eye className="h-9 w-9 text-faint/40" />
                <p className="max-w-xs text-sm text-dim">
                  Give argus an address and it will show you exactly what it's going to compare.
                </p>
              </div>
            ) : mode === 'visual' && preview.hasShot ? (
              <div className="p-4">
                <img
                  src={previewShotUrl(preview.token)}
                  alt="Preview capture"
                  className="block w-full rounded border border-line"
                />
              </div>
            ) : preview.sample ? (
              <pre className="p-4 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap text-dim">
                {preview.sample}
              </pre>
            ) : (
              <p className="p-6 text-sm text-warn">
                Nothing was extracted. Try a different element, or turn on “Load it with a browser”.
              </p>
            )}
          </div>
        </div>
      </div>

      <footer className="sticky bottom-0 flex items-center gap-2 border-t border-line bg-ground/90 px-5 py-3 backdrop-blur">
        {!read.current && <p className="text-xs text-faint">Read the page first to see what will be compared.</p>}
        {mode === 'element' && read.current && !selector.trim() && (
          <p className="text-xs text-warn">Pick an element to watch.</p>
        )}
        <div className="ml-auto flex gap-2">
          <Link to="/" className="btn">
            Cancel
          </Link>
          <button className="btn btn-primary" onClick={create} disabled={!canSave || saving}>
            {saving ? 'Saving…' : 'Start watching'}
          </button>
        </div>
      </footer>

      {picking && (
        <SelectorPicker
          url={url.trim()}
          render={render || mode === 'visual'}
          current={selector || null}
          onClose={() => setPicking(false)}
          onPick={(sel) => {
            setPicking(false)
            setSelector(sel)
            if (mode === 'text') setMode('element')
          }}
        />
      )}
    </div>
  )
}

function Step({
  n,
  title,
  children,
  muted,
}: {
  n: number
  title: string
  children: React.ReactNode
  muted?: boolean
}) {
  return (
    <section className={`px-5 py-4 transition-opacity ${muted ? 'opacity-55' : ''}`}>
      <h2 className="mb-2.5 flex items-center gap-2">
        <span className="lbl">{n}</span>
        <span className="text-sm text-ink">{title}</span>
      </h2>
      {children}
    </section>
  )
}
