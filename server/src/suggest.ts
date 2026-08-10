import { all, get, jsonArray } from './db.ts'
import type { Check, Watch } from './db.ts'

export type Suggestion = {
  pattern: string
  hits: number
  total: number
  sample: string
}

/** Numbers vary between checks; collapse them so clocks and counters group together. */
const template = (line: string) => line.replace(/\d+/g, '#').trim()

const toRegex = (t: string) =>
  `^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split('#').join('\\d+')}$`

/**
 * A line that changes on nearly every check is almost never the reason the watch
 * exists — it's a timestamp, a view counter, a rotating ad slot. Surface those as
 * ready-made ignore rules instead of making the user reverse-engineer the noise.
 */
export function suggestIgnores(watchId: number, minHits = 3, ratio = 0.6): Suggestion[] {
  const watch = get<Watch>('select * from watches where id=?', watchId)
  if (!watch) return []

  const changes = all<Check>(
    'select diff_summary from checks where watch_id=? and changed=1 and diff_summary is not null order by started_at desc limit 25',
    watchId,
  )
  if (changes.length < minHits) return []

  const seenIn = new Map<string, { count: number; sample: string }>()

  for (const check of changes) {
    const lines = changedLines(check.diff_summary)
    const perCheck = new Set<string>()
    for (const line of lines) {
      const t = template(line)
      if (t.length < 4 || !/[a-zA-Z0-9]/.test(t)) continue
      perCheck.add(t)
      if (!seenIn.has(t)) seenIn.set(t, { count: 0, sample: line })
    }
    for (const t of perCheck) seenIn.get(t)!.count++
  }

  const existing = new Set(jsonArray(watch.ignore_regex))
  const total = changes.length

  return [...seenIn.entries()]
    .filter(([, v]) => v.count >= minHits && v.count / total >= ratio)
    .map(([t, v]) => ({ pattern: toRegex(t), hits: v.count, total, sample: v.sample }))
    .filter((s) => !existing.has(s.pattern))
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 8)
}

function changedLines(summary: string | null): string[] {
  if (!summary) return []
  try {
    const parsed = JSON.parse(summary) as { parts?: { t: string; lines?: string[] }[] }
    const out: string[] = []
    for (const part of parsed.parts ?? []) {
      if (part.t !== 'add' && part.t !== 'del') continue
      for (const line of part.lines ?? []) out.push(line)
    }
    return out
  } catch {
    return []
  }
}
