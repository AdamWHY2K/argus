import type { DiffPart } from '../api'

const ROW = {
  add: 'bg-quiet/10 text-quiet border-l-2 border-quiet/60',
  del: 'bg-change/10 text-change-ink/90 border-l-2 border-change/60',
  ctx: 'text-dim border-l-2 border-transparent',
} as const

const MARK = { add: '+', del: '−', ctx: ' ' } as const

export function TextDiff({ parts }: { parts: DiffPart[] }) {
  if (!parts.length)
    return <p className="p-6 text-sm text-dim">No textual difference recorded for this check.</p>

  return (
    <div className="overflow-x-auto py-2 font-mono text-[13px] leading-[1.65]">
      {parts.map((part, i) =>
        part.t === 'gap' ? (
          <div
            key={i}
            className="my-1 flex items-center gap-3 px-4 text-[11px] tracking-[0.14em] text-faint uppercase"
          >
            <span className="h-px flex-1 bg-line-soft" />
            {part.n} unchanged {part.n === 1 ? 'line' : 'lines'}
            <span className="h-px flex-1 bg-line-soft" />
          </div>
        ) : (
          part.lines.map((line, j) => (
            <div key={`${i}-${j}`} className={`flex gap-2 px-4 ${ROW[part.t]}`}>
              <span className="w-3 shrink-0 select-none opacity-60">{MARK[part.t]}</span>
              <span className="whitespace-pre-wrap break-words">{line}</span>
            </div>
          ))
        ),
      )}
    </div>
  )
}
