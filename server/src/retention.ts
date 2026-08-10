import { all, get, run } from './db.ts'
import type { Check } from './db.ts'
import { config } from './config.ts'
import { remove, sizeOf } from './storage.ts'

const ARTIFACTS = ['text_path', 'shot_path', 'diff_path'] as const

const dropArtifacts = (c: Check) => {
  for (const key of ARTIFACTS) remove(c[key])
  run('update checks set text_path=null, shot_path=null, diff_path=null where id=?', c.id)
}

/**
 * Keep history cheap without losing the record of *when* things changed:
 * unchanged checks are dropped wholesale, changed checks keep their row
 * forever but shed their artifacts once they age out.
 *
 * The newest successful check is never touched — it is the baseline the next
 * diff is computed against.
 */
export function pruneWatch(watchId: number) {
  const baseline = get<Check>(
    "select id from checks where watch_id=? and status='ok' order by started_at desc limit 1",
    watchId,
  )
  const keepId = baseline?.id ?? -1

  const unchanged = all<Check>(
    "select * from checks where watch_id=? and status='ok' and changed=0 order by started_at desc",
    watchId,
  )
  for (const c of unchanged.slice(config.retainUnchanged)) {
    if (c.id === keepId) continue
    for (const key of ARTIFACTS) remove(c[key])
    run('delete from checks where id=?', c.id)
  }

  const changed = all<Check>(
    'select * from checks where watch_id=? and changed=1 order by started_at desc',
    watchId,
  )
  for (const c of changed.slice(config.retainChanged)) {
    if (c.id === keepId) continue
    dropArtifacts(c)
  }

  for (const c of all<Check>(
    "select * from checks where watch_id=? and status='error' order by started_at desc",
    watchId,
  ).slice(50)) {
    run('delete from checks where id=?', c.id)
  }

  enforceByteCap(watchId, keepId)
}

/** Oldest artifacts go first once a watch exceeds its disk allowance. */
function enforceByteCap(watchId: number, keepId: number) {
  const rows = all<Check>(
    'select * from checks where watch_id=? order by started_at desc',
    watchId,
  )
  let total = 0
  for (const c of rows) total += sizeOf(c.text_path) + sizeOf(c.shot_path) + sizeOf(c.diff_path)
  if (total <= config.watchByteCap) return

  for (const c of [...rows].reverse()) {
    if (total <= config.watchByteCap) break
    if (c.id === keepId) continue
    const freed = sizeOf(c.text_path) + sizeOf(c.shot_path) + sizeOf(c.diff_path)
    if (!freed) continue
    dropArtifacts(c)
    total -= freed
  }
}

export function sweep() {
  for (const w of all<{ id: number }>('select id from watches')) pruneWatch(w.id)
}
