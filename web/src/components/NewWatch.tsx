import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import type { WatchMode } from '../api'

const MODES: { id: WatchMode; label: string; hint: string }[] = [
  { id: 'text', label: 'Text', hint: 'Tells you when the words on the page change.' },
  { id: 'element', label: 'Element', hint: 'Watches one part of the page — a price, a status, a list.' },
  { id: 'visual', label: 'Visual', hint: 'Compares screenshots, so layout and images count too.' },
]

const INTERVALS = [
  { label: '5m', sec: 300 },
  { label: '15m', sec: 900 },
  { label: '1h', sec: 3600 },
  { label: '6h', sec: 21600 },
  { label: '1d', sec: 86400 },
]

export function NewWatch({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [url, setUrl] = useState('')
  const [mode, setMode] = useState<WatchMode>('text')
  const [selector, setSelector] = useState('')
  const [interval, setInterval] = useState(3600)
  const [render, setRender] = useState(false)
  const [preview, setPreview] = useState<{ title: string | null; chars: number; sample: string } | null>(null)
  const [state, setState] = useState<'idle' | 'previewing' | 'saving'>('idle')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    inputRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const runPreview = async () => {
    if (!url.trim()) return
    setState('previewing')
    setError(null)
    try {
      setPreview(await api.preview({ url, selector: selector || undefined, render: render || mode === 'visual' }))
    } catch (e) {
      setPreview(null)
      setError((e as Error).message)
    } finally {
      setState('idle')
    }
  }

  const create = async () => {
    setState('saving')
    setError(null)
    try {
      const watch = await api.create({
        url,
        mode,
        selector: selector || null,
        interval_sec: interval,
        render: render || mode === 'visual' ? 1 : 0,
      })
      onCreated()
      navigate(`/w/${watch.id}`)
    } catch (e) {
      setError((e as Error).message)
      setState('idle')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ground/80 p-4 backdrop-blur-sm sm:p-10"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Watch a page"
        className="panel w-full max-w-xl overflow-hidden"
      >
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="font-mono text-xs tracking-[0.16em] uppercase">Watch a page</h2>
          <button className="btn-ghost btn px-2 py-1 text-xs" onClick={onClose}>
            Esc
          </button>
        </header>

        <div className="space-y-4 p-4">
          <div>
            <label className="mb-1 block text-xs text-dim">Page address</label>
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                className="field font-mono text-[12px]"
                placeholder="https://example.com/pricing"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runPreview()}
              />
              <button className="btn shrink-0" onClick={runPreview} disabled={!url.trim() || state === 'previewing'}>
                {state === 'previewing' ? 'Reading…' : 'Read it'}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs text-dim">What should count as a change</label>
            <div className="flex rounded-md border border-line bg-ground p-0.5">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  className={`flex-1 rounded px-2 py-1.5 text-xs transition-colors ${
                    mode === m.id ? 'bg-raised text-ink' : 'text-dim hover:text-ink'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] text-dim">{MODES.find((m) => m.id === mode)?.hint}</p>
          </div>

          {mode === 'element' && (
            <div>
              <label className="mb-1 block text-xs text-dim">Which element</label>
              <input
                className="field font-mono text-[12px]"
                placeholder="#main .price"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-faint">
                A CSS selector. You can also pick one visually after saving.
              </p>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-dim">Check every</label>
            <div className="flex gap-1.5">
              {INTERVALS.map((i) => (
                <button
                  key={i.sec}
                  onClick={() => setInterval(i.sec)}
                  className={`chip flex-1 justify-center border transition-colors ${
                    interval === i.sec
                      ? 'border-change/60 bg-change/12 text-change'
                      : 'border-line text-dim hover:text-ink'
                  }`}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>

          {mode !== 'visual' && (
            <label className="flex items-center gap-2 text-xs text-dim">
              <input
                type="checkbox"
                checked={render}
                onChange={(e) => setRender(e.target.checked)}
                className="accent-[var(--color-change)]"
              />
              Load it with a browser first (for pages built in JavaScript)
            </label>
          )}

          {error && (
            <p className="rounded border border-warn/40 bg-warn/8 px-3 py-2 text-xs text-warn">
              Couldn't read that page — {error}
            </p>
          )}

          {preview && (
            <div className="rounded-md border border-line bg-ground">
              <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
                <span className="lbl">This is what argus will compare</span>
                <span className="font-mono text-[10px] text-faint">{preview.chars.toLocaleString()} chars</span>
              </div>
              {preview.title && <p className="px-3 pt-2 text-xs text-ink">{preview.title}</p>}
              <pre className="max-h-44 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-dim">
                {preview.sample.slice(0, 1500) || '(nothing extracted — try element mode or a browser load)'}
              </pre>
            </div>
          )}
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={create}
            disabled={!url.trim() || state === 'saving' || (mode === 'element' && !selector.trim())}
          >
            {state === 'saving' ? 'Saving…' : 'Start watching'}
          </button>
        </footer>
      </div>
    </div>
  )
}
