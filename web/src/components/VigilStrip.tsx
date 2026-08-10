import { pct } from '../api'
import type { Check } from '../api'

export type TickState = 'quiet' | 'change' | 'warn'
export type Tick = { id: number; state: TickState; title?: string }

const STATE: Record<TickState, { h: string; cls: string }> = {
  change: { h: '100%', cls: 'bg-change' },
  warn: { h: '62%', cls: 'bg-warn/80' },
  quiet: { h: '26%', cls: 'bg-faint/45' },
}

export const tickOf = (c: Check): Tick => ({
  id: c.id,
  state: c.status === 'error' ? 'warn' : c.changed ? 'change' : 'quiet',
  title: `${new Date(c.started_at).toLocaleString()}\n${
    c.status === 'error'
      ? `failed: ${c.error ?? ''}`
      : c.changed
        ? `changed ${pct(c.change_pct)}`
        : 'no change'
  }`,
})

/** Parse the compact `q12,c13,e14` history the list endpoint returns. */
export const parseTicks = (raw: string | null): Tick[] => {
  if (!raw) return []
  const map: Record<string, TickState> = { q: 'quiet', c: 'change', e: 'warn' }
  return raw
    .split(',')
    .map((t) => ({ id: Number(t.slice(1)), state: map[t[0]] ?? 'quiet' }))
    .filter((t) => !isNaN(t.id))
    .sort((a, b) => a.id - b.id)
}

/**
 * The vigil strip: one tick per check, oldest to newest. Encodes each watch's
 * actual rhythm — how often it is looked at, and how often that mattered.
 */
export function VigilStrip({
  ticks,
  slots = 34,
  onPick,
  activeId,
}: {
  ticks: Tick[]
  slots?: number
  onPick?: (id: number) => void
  activeId?: number | null
}) {
  const shown = ticks.slice(-slots)
  const pad = Math.max(0, slots - shown.length)

  return (
    <div className="relative flex h-6 items-end gap-[2px]" aria-label="Recent checks">
      <div className="absolute inset-x-0 bottom-0 h-px bg-line-soft" />
      {shown.map((t) => {
        const s = STATE[t.state]
        return (
          <button
            key={t.id}
            type="button"
            tabIndex={onPick ? 0 : -1}
            title={t.title}
            aria-label={t.title ?? t.state}
            onClick={onPick ? () => onPick(t.id) : undefined}
            className={`relative min-w-[3px] flex-1 rounded-sm transition-all ${s.cls} ${
              onPick ? 'cursor-pointer hover:brightness-150' : 'pointer-events-none'
            } ${activeId === t.id ? 'ring-1 ring-ink/70' : ''}`}
            style={{ height: s.h }}
          />
        )
      })}
      {/* Unfilled slots stay visible so the strip reads as an instrument with
          room to fill, not as a few stray marks floating in empty space. */}
      {Array.from({ length: pad }, (_, i) => (
        <div key={`pad-${i}`} className="bg-faint/15 h-[3px] min-w-[3px] flex-1 rounded-sm" />
      ))}
    </div>
  )
}
