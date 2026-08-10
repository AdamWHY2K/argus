import { all, get, run } from './db.ts'
import type { Watch } from './db.ts'
import { config } from './config.ts'
import { runCheck } from './check.ts'
import { beginShutdown } from './lifecycle.ts'

const running = new Set<number>()
const lastHostAt = new Map<string, number>()
let timer: NodeJS.Timeout | null = null


const hostOf = (url: string) => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** ±10% so watches added together don't stay in lockstep forever. */
const jitter = (ms: number) => ms + Math.round((Math.random() - 0.5) * 0.2 * ms)

export const isRunning = (id: number) => running.has(id)

export function startScheduler() {
  if (timer) return
  timer = setInterval(tick, 2000)
  void tick()
}

export function stopScheduler() {
  beginShutdown()
  if (timer) clearInterval(timer)
  timer = null
}

async function tick() {
  if (running.size >= config.concurrency) return
  const due = all<Watch>(
    'select * from watches where enabled=1 and (next_run_at is null or next_run_at<=?) order by next_run_at asc limit 25',
    Date.now(),
  )

  for (const watch of due) {
    if (running.size >= config.concurrency) break
    if (running.has(watch.id)) continue

    const host = hostOf(watch.url)
    if (Date.now() - (lastHostAt.get(host) ?? 0) < config.hostGapMs) continue
    lastHostAt.set(host, Date.now())

    // Claim it immediately so a slow check can't be picked up twice.
    run('update watches set next_run_at=? where id=?', Date.now() + jitter(watch.interval_sec * 1000), watch.id)
    dispatch(watch)
  }
}

function dispatch(watch: Watch) {
  running.add(watch.id)
  void runCheck(watch).finally(() => running.delete(watch.id))
}

/** Manual trigger from the UI; resolves once the check completes. */
export async function checkNow(watchId: number) {
  const watch = get<Watch>('select * from watches where id=?', watchId)
  if (!watch) return undefined
  if (running.has(watchId)) return undefined
  running.add(watchId)
  try {
    return await runCheck(watch)
  } finally {
    running.delete(watchId)
    run('update watches set next_run_at=? where id=?', Date.now() + jitter(watch.interval_sec * 1000), watchId)
  }
}
