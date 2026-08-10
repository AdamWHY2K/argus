import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ago, host, humanInterval, shotUrl, until } from './api'
import type { Watch } from './api'
import { VigilStrip, parseTicks } from './components/VigilStrip'
import { NewWatch } from './components/NewWatch'
import { Eye } from './components/Eye'

type Filter = 'all' | 'changed' | 'quiet' | 'failing' | 'paused'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'changed', label: 'Changed' },
  { id: 'quiet', label: 'Quiet' },
  { id: 'failing', label: 'Failing' },
  { id: 'paused', label: 'Paused' },
]

const DAY = 86_400_000

const matches = (w: Watch, f: Filter) => {
  if (f === 'all') return true
  if (f === 'paused') return !w.enabled
  if (f === 'failing') return w.last_status === 'error'
  if (f === 'changed') return !!w.last_change_at && Date.now() - w.last_change_at < DAY
  return w.enabled && w.last_status !== 'error' && !(w.last_change_at && Date.now() - w.last_change_at < DAY)
}

export function Board() {
  const [watches, setWatches] = useState<Watch[] | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const load = () => api.watches().then(setWatches).catch(() => {})

  useEffect(() => {
    load()
    const t = setInterval(load, 10_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = /input|textarea|select/i.test((e.target as HTMLElement)?.tagName ?? '')
      if (typing) return
      if (e.key === 'n') {
        e.preventDefault()
        setAdding(true)
      }
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (watches ?? [])
      .filter((w) => matches(w, filter))
      .filter((w) => !q || w.name.toLowerCase().includes(q) || w.url.toLowerCase().includes(q))
  }, [watches, filter, query])

  const changedToday = (watches ?? []).filter((w) => matches(w, 'changed')).length
  const failing = (watches ?? []).filter((w) => w.last_status === 'error').length

  const runNow = async (id: number) => {
    setBusy(id)
    try {
      await api.runCheck(id)
      await load()
    } catch {
      /* the card's error state will show it */
    } finally {
      setBusy(null)
    }
  }

  const toggle = async (w: Watch) => {
    await api.update(w.id, { enabled: w.enabled ? 0 : 1 })
    load()
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-line bg-ground/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
          <Link to="/" className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-change" />
            <span className="font-mono text-sm tracking-[0.22em] uppercase">argus</span>
          </Link>

          <p className="font-mono text-[11px] text-dim">
            {watches?.length ?? '—'} watching
            {changedToday > 0 && <span className="text-change"> · {changedToday} changed today</span>}
            {failing > 0 && <span className="text-warn"> · {failing} failing</span>}
          </p>

          <div className="ml-auto flex items-center gap-2">
            <input
              ref={searchRef}
              className="field w-44 py-1 text-xs"
              placeholder="Search  /"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              Watch a page
            </button>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1500px] gap-1 px-5 pb-2">
          {FILTERS.map((f) => {
            const n = (watches ?? []).filter((w) => matches(w, f.id)).length
            return (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`rounded px-2 py-1 font-mono text-[11px] tracking-wide transition-colors ${
                  filter === f.id ? 'bg-raised text-ink' : 'text-faint hover:text-dim'
                }`}
              >
                {f.label} <span className="opacity-60">{n}</span>
              </button>
            )
          })}
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-5 py-6">
        {watches === null ? (
          <p className="py-24 text-center text-sm text-dim">Loading…</p>
        ) : visible.length === 0 ? (
          <Empty hasAny={watches.length > 0} onAdd={() => setAdding(true)} />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(288px,1fr))] gap-4">
            {visible.map((w) => (
              <Card
                key={w.id}
                watch={w}
                busy={busy === w.id}
                onRun={() => runNow(w.id)}
                onToggle={() => toggle(w)}
              />
            ))}
          </div>
        )}
      </main>

      {adding && (
        <NewWatch
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false)
            load()
          }}
        />
      )}
    </div>
  )
}

function Card({
  watch,
  busy,
  onRun,
  onToggle,
}: {
  watch: Watch
  busy: boolean
  onRun: () => void
  onToggle: () => void
}) {
  const recentlyChanged = !!watch.last_change_at && Date.now() - watch.last_change_at < DAY
  const failing = watch.last_status === 'error'
  const paused = !watch.enabled

  return (
    <article
      className={`panel group relative overflow-hidden transition-colors ${
        recentlyChanged ? 'border-change/45' : failing ? 'border-warn/40' : 'hover:border-faint'
      } ${paused ? 'opacity-55' : ''}`}
    >
      <Link to={`/w/${watch.id}`} className="block">
        <div className="shot-bg relative aspect-[16/10] overflow-hidden border-b border-line">
          {watch.last_shot_id ? (
            <img
              src={shotUrl(watch.last_shot_id)}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover object-top"
            />
          ) : watch.preview ? (
            <div className="flex h-full flex-col justify-center gap-1 px-3">
              <span className="lbl">Last change</span>
              <pre className="overflow-hidden font-mono text-[10.5px] leading-[1.7] whitespace-pre-wrap">
                {watch.preview.split('\n').map((line, i) => (
                  <span
                    key={i}
                    className={`block truncate ${line.startsWith('+') ? 'text-quiet' : 'text-change/85'}`}
                  >
                    {line}
                  </span>
                ))}
              </pre>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center">
              <Eye className={`h-7 w-7 ${paused ? 'text-faint' : 'text-faint/60'}`} />
            </div>
          )}
          {recentlyChanged && (
            <span className="chip absolute right-2 bottom-2 border border-change/50 bg-ground/85 text-change">
              changed {ago(watch.last_change_at)}
            </span>
          )}
        </div>
      </Link>

      <div className="space-y-2.5 p-3">
        <div className="flex items-start gap-2">
          <StateDot watch={watch} />
          <div className="min-w-0 flex-1">
            <Link to={`/w/${watch.id}`} className="block truncate text-sm hover:text-change">
              {watch.name}
            </Link>
            <p className="truncate font-mono text-[11px] text-faint">{host(watch.url)}</p>
          </div>
          <span className="lbl shrink-0">{watch.mode}</span>
        </div>

        <VigilStrip ticks={parseTicks(watch.ticks)} />

        <div className="flex items-center justify-between font-mono text-[11px] text-faint">
          <span>{watch.last_check_at ? ago(watch.last_check_at) : 'not checked yet'}</span>
          <span className="transition-opacity group-hover:opacity-0">
            {paused ? 'paused' : `next ${until(watch.next_run_at)} · every ${humanInterval(watch.interval_sec)}`}
          </span>
        </div>

        {failing && (
          <p className="truncate rounded border border-warn/30 bg-warn/8 px-2 py-1 font-mono text-[10px] text-warn">
            {watch.last_error}
          </p>
        )}
      </div>

      <div className="absolute right-2 bottom-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <button className="btn px-2 py-1 text-xs" onClick={onRun} disabled={busy}>
          {busy ? 'Checking…' : 'Check now'}
        </button>
        <button className="btn px-2 py-1 text-xs" onClick={onToggle}>
          {paused ? 'Resume' : 'Pause'}
        </button>
      </div>
    </article>
  )
}

function StateDot({ watch }: { watch: Watch }) {
  const [cls, label] = !watch.enabled
    ? ['bg-faint', 'Paused']
    : watch.last_status === 'error'
      ? ['bg-warn', 'Failing']
      : watch.running
        ? ['bg-quiet breathe', 'Checking now']
        : ['bg-quiet/70', 'Watching']
  return <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${cls}`} title={label} />
}

function Empty({ hasAny, onAdd }: { hasAny: boolean; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-28 text-center">
      <Eye className="h-10 w-10 text-faint/50" />
      <div>
        <p className="text-sm text-dim">{hasAny ? 'Nothing matches this filter.' : 'Nothing is being watched yet.'}</p>
        {!hasAny && (
          <p className="mt-1 text-xs text-faint">
            Point argus at a page and it will tell you when it changes.
          </p>
        )}
      </div>
      {!hasAny && (
        <button className="btn btn-primary" onClick={onAdd}>
          Watch a page
        </button>
      )}
    </div>
  )
}
