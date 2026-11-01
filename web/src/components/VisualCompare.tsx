import { useEffect, useRef, useState } from 'react'
import { api, diffUrl, shotUrl } from '../api'
import type { Box } from '../api'
import { isVisualMode, VISUAL_MODES } from '../../../shared/visual'
import type { VisualMode } from '../../../shared/visual'

const MODE_STORAGE_KEY = 'argus:visual-compare-mode'

const LABELS: Record<VisualMode, string> = {
  overlay: 'Overlay',
  swipe: 'Swipe',
  side: 'Side by side',
  after: 'Latest only',
}

const MODES = VISUAL_MODES.map((id) => ({
  id,
  label: LABELS[id],
  needsPrev: id === 'swipe' || id === 'side',
}))

function isModeAvailable(mode: VisualMode, hasDiff: boolean, prevId: number | null) {
  if (mode === 'overlay' && !hasDiff) return false
  return !(MODES.find((item) => item.id === mode)?.needsPrev && prevId === null)
}

function getInitialMode(hasDiff: boolean, prevId: number | null): VisualMode {
  const defaultMode = hasDiff ? 'overlay' : 'after'
  const savedMode = window.localStorage.getItem(MODE_STORAGE_KEY)

  if (!isVisualMode(savedMode)) return defaultMode
  return isModeAvailable(savedMode, hasDiff, prevId) ? savedMode : defaultMode
}

export function VisualCompare({
  checkId,
  prevId,
  hasDiff,
  boxes,
  sourceWidth,
}: {
  checkId: number
  prevId: number | null
  hasDiff: boolean
  boxes: Box[]
  sourceWidth: number
}) {
  const [mode, setMode] = useState<VisualMode>(() => getInitialMode(hasDiff, prevId))
  const [split, setSplit] = useState(50)
  const scrollRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    api.visualMode().then(({ mode: savedMode }) => {
      if (savedMode && isModeAvailable(savedMode, hasDiff, prevId)) setMode(savedMode)
    })
      .catch(() => {})
  }, [hasDiff, prevId])

  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return
    const rect = e.currentTarget.getBoundingClientRect()
    setSplit(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)))
  }

  /** Scroll a changed region into view, mapping source pixels to rendered pixels. */
  const jumpTo = (box: Box) => {
    const el = scrollRef.current
    const frame = frameRef.current
    if (!el || !frame || !sourceWidth) return
    const scale = frame.clientWidth / sourceWidth
    el.scrollTo({ top: Math.max(0, box.y * scale - 80), behavior: 'smooth' })
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2">
        <div className="flex rounded-md border border-line bg-ground p-0.5">
          {MODES.filter((m) => (m.needsPrev ? prevId : true))
            .filter((m) => (m.id === 'overlay' ? hasDiff : true))
            .map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  setMode(m.id)
                  api.saveVisualMode(m.id).catch(() => {})
                  window.localStorage.setItem(MODE_STORAGE_KEY, m.id)
                }}
                className={`rounded px-2.5 py-1 text-xs transition-colors ${
                  mode === m.id ? 'bg-raised text-ink' : 'text-dim hover:text-ink'
                }`}
              >
                {m.label}
              </button>
            ))}
        </div>

        {boxes.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <span className="lbl shrink-0">
              {boxes.length} {boxes.length === 1 ? 'region' : 'regions'}
            </span>
            {boxes.slice(0, 12).map((b, i) => (
              <button
                key={i}
                onClick={() => jumpTo(b)}
                className="chip shrink-0 border border-change/40 bg-change/10 text-change-ink hover:bg-change/20"
                title={`${b.w}×${b.h}px at ${b.x},${b.y}`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <div ref={scrollRef} className="shot-bg min-h-0 flex-1 overflow-auto p-4">
        {mode === 'side' && prevId ? (
          <div className="grid grid-cols-2 gap-3">
            <Framed label="Before" src={shotUrl(prevId)} />
            <Framed label="After" src={shotUrl(checkId)} />
          </div>
        ) : mode === 'swipe' && prevId ? (
          <div
            ref={frameRef}
            className="relative cursor-ew-resize touch-none overflow-hidden rounded border border-line select-none"
            onPointerDown={drag}
            onPointerMove={drag}
          >
            <img src={shotUrl(checkId)} alt="After" className="block w-full" draggable={false} />
            <div
              className="absolute inset-0 overflow-hidden"
              style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}
            >
              <img
                src={shotUrl(prevId)}
                alt="Before"
                className="block w-full max-w-none"
                draggable={false}
              />
            </div>
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-change"
              style={{ left: `${split}%` }}
            >
              <span className="absolute top-1/2 left-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-change bg-ground text-[11px] text-change-ink">
                ↔
              </span>
            </div>
            <span className="lbl pointer-events-none absolute top-2 left-2 rounded bg-ground/80 px-1.5 py-0.5">
              Before
            </span>
            <span className="lbl pointer-events-none absolute top-2 right-2 rounded bg-ground/80 px-1.5 py-0.5">
              After
            </span>
          </div>
        ) : (
          <div ref={frameRef} className="overflow-hidden rounded border border-line">
            <img
              src={mode === 'overlay' && hasDiff ? diffUrl(checkId) : shotUrl(checkId)}
              alt={mode === 'overlay' ? 'Changed regions highlighted' : 'Latest capture'}
              className="block w-full"
            />
          </div>
        )}
      </div>
    </div>
  )
}

function Framed({ label, src }: { label: string; src: string }) {
  return (
    <figure className="overflow-hidden rounded border border-line">
      <figcaption className="lbl border-b border-line bg-panel px-2 py-1">{label}</figcaption>
      <img src={src} alt={label} className="block w-full" />
    </figure>
  )
}
