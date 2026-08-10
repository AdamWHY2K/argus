import type { DiffPart } from '../diff.ts'

export type NumberChange = { context: string; before: string; after: string }

export type ChangeFacts = {
  kind: 'text' | 'visual'
  /** One line a human can act on without opening the app. */
  headline: string
  /** Supporting facts, already phrased. */
  details: string[]
  numbers: NumberChange[]
  added: number
  removed: number
  changePct: number
  regions?: number
  where?: string
  /** Trimmed diff lines for the message body. */
  excerpt: { t: 'add' | 'del'; line: string }[]
}

type Summary = {
  kind?: 'text' | 'visual'
  added?: number
  removed?: number
  changePct?: number
  parts?: DiffPart[]
  changedPct?: number
  changedPixels?: number
  width?: number
  height?: number
  boxes?: { x: number; y: number; w: number; h: number }[]
}

/** Numbers vary; everything else is the line's identity. */
const skeleton = (s: string) => s.replace(/[\d][\d.,:]*/g, '#').trim()
const numbersIn = (s: string) => s.match(/[\d][\d.,:]*/g) ?? []

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

/**
 * Turns a stored diff summary into something worth reading in a notification.
 * Deliberately structural, not a language model: pairing lines that differ only
 * in their numbers catches the cases people actually watch for — a price, a
 * count, a version, a date.
 */
export function describe(summary: Summary | null, changePct: number): ChangeFacts {
  const parts = summary?.parts ?? []
  const adds: string[] = []
  const dels: string[] = []
  for (const p of parts) {
    if (p.t === 'add') adds.push(...p.lines)
    else if (p.t === 'del') dels.push(...p.lines)
  }

  const numbers = pairNumbers(dels, adds)
  const added = summary?.added ?? adds.length
  const removed = summary?.removed ?? dels.length

  const excerpt = [
    ...dels.slice(0, 4).map((line) => ({ t: 'del' as const, line })),
    ...adds.slice(0, 4).map((line) => ({ t: 'add' as const, line })),
  ]

  if (summary?.kind === 'visual') {
    const regions = summary.boxes?.length ?? 0
    const where = placeOf(summary.boxes ?? [], summary.height ?? 0)
    const pct = summary.changedPct ?? changePct
    const details: string[] = []
    if (regions) details.push(`${plural(regions, 'region')} changed${where ? `, ${where}` : ''}`)
    if (summary.changedPixels) details.push(`${summary.changedPixels.toLocaleString()} pixels differ`)
    if (numbers.length) details.push(...numbers.slice(0, 3).map(fmtNumber))
    return {
      kind: 'visual',
      headline: `${pct.toFixed(2)}% of the page looks different${where ? ` ${where}` : ''}`,
      details,
      numbers,
      added,
      removed,
      changePct: pct,
      regions,
      where,
      excerpt,
    }
  }

  let headline: string
  if (numbers.length === 1) {
    headline = fmtNumber(numbers[0])
  } else if (numbers.length > 1) {
    headline = `${plural(numbers.length, 'number')} changed — ${fmtNumber(numbers[0])}`
  } else if (added && !removed) {
    headline = `${plural(added, 'line')} added`
  } else if (removed && !added) {
    headline = `${plural(removed, 'line')} removed`
  } else if (added || removed) {
    headline = `${plural(added, 'line')} added, ${removed} removed`
  } else {
    headline = 'The page changed'
  }

  const details: string[] = []
  if (numbers.length > 1) details.push(...numbers.slice(1, 4).map(fmtNumber))
  if (added || removed) details.push(`+${added} / −${removed} lines · ${changePct.toFixed(1)}% of the text`)

  return {
    kind: 'text',
    headline,
    details,
    numbers,
    added,
    removed,
    changePct,
    excerpt,
  }
}

const fmtNumber = (n: NumberChange) =>
  n.context ? `${n.context}: ${n.before} → ${n.after}` : `${n.before} → ${n.after}`

/**
 * Match removed lines to added lines that are identical apart from their digits,
 * then report just the digits that moved.
 */
function pairNumbers(dels: string[], adds: string[]): NumberChange[] {
  const out: NumberChange[] = []
  const used = new Set<number>()

  for (const del of dels) {
    const key = skeleton(del)
    if (!key.includes('#')) continue
    const i = adds.findIndex((a, idx) => !used.has(idx) && skeleton(a) === key)
    if (i === -1) continue
    used.add(i)

    const before = numbersIn(del)
    const after = numbersIn(adds[i])
    // The label is what precedes the first number — "Standard plan: 199 USD / month"
    // should read as "Standard plan", not as everything with the digits cut out.
    const context = labelOf(del)
    for (let n = 0; n < Math.min(before.length, after.length); n++) {
      if (before[n] === after[n]) continue
      out.push({ context, before: before[n], after: after[n] })
    }
  }
  return out.slice(0, 8)
}

function labelOf(line: string): string {
  const head = line.split(/[\d]/)[0] ?? ''
  const cleaned = head.replace(/\s+/g, ' ').replace(/[:\-–—=(\[\s]+$/, '').trim()
  return cleaned.slice(0, 48)
}

/** Rough vertical placement, so "near the top" beats a pixel coordinate. */
function placeOf(boxes: { y: number; h: number }[], height: number): string {
  if (!boxes.length || !height) return ''
  const mid = boxes.reduce((sum, b) => sum + (b.y + b.h / 2), 0) / boxes.length
  const r = mid / height
  if (r < 0.33) return 'near the top'
  if (r > 0.66) return 'near the bottom'
  return 'in the middle of the page'
}
