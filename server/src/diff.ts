import { diffLines, diffWordsWithSpace } from 'diff'

export type DiffPart =
  | { t: 'ctx' | 'add' | 'del'; lines: string[] }
  | { t: 'gap'; n: number }

export type TextDiff = {
  changePct: number
  added: number
  removed: number
  parts: DiffPart[]
  preview: string
}

const CONTEXT = 3

/** Line-level diff with collapsed context, plus a change magnitude used for thresholds. */
export function textDiff(before: string, after: string): TextDiff {
  const raw = diffLines(before, after)
  const parts: DiffPart[] = []
  let added = 0
  let removed = 0
  let changedChars = 0

  const splitLines = (v: string) => {
    const lines = v.split('\n')
    if (lines.at(-1) === '') lines.pop()
    return lines
  }

  for (let i = 0; i < raw.length; i++) {
    const part = raw[i]
    const lines = splitLines(part.value)
    if (!lines.length) continue

    if (part.added || part.removed) {
      changedChars += part.value.length
      if (part.added) added += lines.length
      else removed += lines.length
      parts.push({ t: part.added ? 'add' : 'del', lines })
      continue
    }

    // Unchanged: keep a little context either side, elide the middle.
    const first = i === 0
    const last = i === raw.length - 1
    if (lines.length <= CONTEXT * 2) {
      parts.push({ t: 'ctx', lines })
    } else if (first) {
      parts.push({ t: 'gap', n: lines.length - CONTEXT })
      parts.push({ t: 'ctx', lines: lines.slice(-CONTEXT) })
    } else if (last) {
      parts.push({ t: 'ctx', lines: lines.slice(0, CONTEXT) })
      parts.push({ t: 'gap', n: lines.length - CONTEXT })
    } else {
      parts.push({ t: 'ctx', lines: lines.slice(0, CONTEXT) })
      parts.push({ t: 'gap', n: lines.length - CONTEXT * 2 })
      parts.push({ t: 'ctx', lines: lines.slice(-CONTEXT) })
    }
  }

  // Denominator spans both sides: an add and its matching delete are one edit,
  // so a half-rewritten page reads as ~50%, not 100%.
  const changePct = Math.min(100, (changedChars / Math.max(before.length + after.length, 1)) * 100)
  return { changePct, added, removed, parts, preview: previewOf(parts) }
}

/** Word-level diff of two lines, for inline highlighting in the UI. */
export function wordDiff(before: string, after: string) {
  return diffWordsWithSpace(before, after).map((p) => ({
    t: p.added ? 'add' : p.removed ? 'del' : 'ctx',
    v: p.value,
  }))
}

function previewOf(parts: DiffPart[], max = 3): string {
  const out: string[] = []
  for (const p of parts) {
    if (p.t !== 'add' && p.t !== 'del') continue
    for (const line of p.lines) {
      out.push(`${p.t === 'add' ? '+' : '-'} ${line.slice(0, 160)}`)
      if (out.length >= max) return out.join('\n')
    }
  }
  return out.join('\n')
}
