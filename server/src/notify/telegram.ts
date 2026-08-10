import { readFileSync } from 'node:fs'
import type { Settings } from '../settings.ts'
import type { Message } from './render.ts'

const API = 'https://api.telegram.org/bot'
/** Telegram truncates photo captions past this; messages get 4096. */
const CAPTION_LIMIT = 1024

export async function sendTelegram(
  cfg: Settings['telegram'],
  msg: Message,
  imagePath: string | null,
) {
  if (!cfg.bot_token || !cfg.chat_id) throw new Error('telegram: bot token and chat id are required')

  const base: Record<string, string> = { chat_id: cfg.chat_id, parse_mode: 'HTML' }
  if (cfg.thread_id) base.message_thread_id = cfg.thread_id

  // A visual change is best told with the annotated image; the caption carries the words.
  if (imagePath && msg.telegramHtml.length <= CAPTION_LIMIT) {
    const form = new FormData()
    for (const [k, v] of Object.entries(base)) form.append(k, v)
    form.append('caption', msg.telegramHtml)
    form.append('photo', new Blob([readFileSync(imagePath)], { type: 'image/png' }), 'change.png')
    await call(cfg.bot_token, 'sendPhoto', form)
    return
  }

  await call(cfg.bot_token, 'sendMessage', {
    ...base,
    text: msg.telegramHtml.slice(0, 4096),
    link_preview_options: JSON.stringify({ is_disabled: true }),
  })

  if (imagePath) {
    const form = new FormData()
    for (const [k, v] of Object.entries(base)) form.append(k, v)
    form.append('photo', new Blob([readFileSync(imagePath)], { type: 'image/png' }), 'change.png')
    await call(cfg.bot_token, 'sendPhoto', form)
  }
}

async function call(token: string, method: string, body: FormData | Record<string, string>) {
  const init: RequestInit = { method: 'POST', signal: AbortSignal.timeout(30_000) }
  if (body instanceof FormData) init.body = body
  else {
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(body)
  }
  const res = await fetch(`${API}${token}/${method}`, init)
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string }
  if (!res.ok || !json.ok) throw new Error(`telegram ${method}: ${json.description ?? res.statusText}`)
}
