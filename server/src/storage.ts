import { mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { config } from './config.ts'

export const hash = (s: string | Buffer) => createHash('sha256').update(s).digest('hex')

const dirFor = (watchId: number) => {
  const dir = join(config.snapDir, String(watchId))
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Snapshots are addressed by a path relative to snapDir, so the root can move. */
export function save(watchId: number, checkId: number, ext: string, data: string | Buffer): string {
  const rel = join(String(watchId), `${checkId}.${ext}`)
  dirFor(watchId)
  writeFileSync(join(config.snapDir, rel), data)
  return rel
}

export const abs = (rel: string) => join(config.snapDir, rel)

export function readText(rel: string): string | null {
  try {
    return readFileSync(abs(rel), 'utf8')
  } catch {
    return null
  }
}

export function remove(rel: string | null) {
  if (!rel) return
  try {
    rmSync(abs(rel), { force: true })
  } catch {
    // already gone
  }
}

export function sizeOf(rel: string | null): number {
  if (!rel || !existsSync(abs(rel))) return 0
  try {
    return statSync(abs(rel)).size
  } catch {
    return 0
  }
}

export function removeWatchDir(watchId: number) {
  try {
    rmSync(join(config.snapDir, String(watchId)), { recursive: true, force: true })
  } catch {
    // already gone
  }
}
