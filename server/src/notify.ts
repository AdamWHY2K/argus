import { execFile } from 'node:child_process'
import { config } from './config.ts'
import type { Watch } from './db.ts'

const exec = (bin: string, args: string[], input: string) =>
  new Promise<void>((resolve) => {
    const child = execFile(bin, args, { timeout: 20_000 }, (err) => {
      if (err) console.error('[notify] robot ping failed:', err.message)
      resolve()
    })
    child.stdin?.end(input)
  })

export type ChangeEvent = {
  watch: Watch
  checkId: number
  changePct: number
  added: number
  removed: number
  preview: string
  visual?: { changedPct: number } | null
}

export async function notifyChange(ev: ChangeEvent) {
  const { watch } = ev
  const link = `${config.baseUrl}/w/${watch.id}`
  const magnitude = ev.visual
    ? `${ev.visual.changedPct.toFixed(1)}% of pixels`
    : `+${ev.added} / -${ev.removed} lines (${ev.changePct.toFixed(1)}%)`

  const body = [
    `👁 ${watch.name} changed`,
    watch.url,
    magnitude,
    ev.preview ? `\n${ev.preview}` : '',
    `\n${link}`,
  ]
    .filter(Boolean)
    .join('\n')

  if (watch.notify_webhook) void postWebhook(watch.notify_webhook, ev, link)
  if (!config.notifyEnabled) return
  const args = watch.notify_stream ? ['ping', '--stream', watch.notify_stream] : ['ping']
  await exec(config.robotBin, args, body)
}

async function postWebhook(url: string, ev: ChangeEvent, link: string) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        watch: { id: ev.watch.id, name: ev.watch.name, url: ev.watch.url, mode: ev.watch.mode },
        check_id: ev.checkId,
        change_pct: ev.changePct,
        added: ev.added,
        removed: ev.removed,
        preview: ev.preview,
        link,
      }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch (e) {
    console.error('[notify] webhook failed:', (e as Error).message)
  }
}
