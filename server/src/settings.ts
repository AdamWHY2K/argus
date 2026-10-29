import { all, get, run } from './db.ts'

const env = process.env

export type ChannelId = 'email' | 'webhook' | 'command'

export type Settings = {
  email: {
    enabled: boolean
    host: string
    port: number
    secure: boolean
    user: string
    pass: string
    from: string
    to: string
  }
  webhook: { enabled: boolean; url: string }
  /**
   * Runs a local notification CLI with the message as its last argument. Off by
   * default, since a fresh install has no such binary.
   */
  command: { enabled: boolean; bin: string; args: string }
}

/** Env supplies the defaults so a container can be configured without the UI. */
const defaults = (): Settings => ({
  email: {
    enabled: !!env.ARGUS_SMTP_HOST && !!env.ARGUS_EMAIL_TO,
    host: env.ARGUS_SMTP_HOST ?? '',
    port: Number(env.ARGUS_SMTP_PORT ?? 587),
    secure: env.ARGUS_SMTP_SECURE === '1',
    user: env.ARGUS_SMTP_USER ?? '',
    pass: env.ARGUS_SMTP_PASS ?? '',
    from: env.ARGUS_EMAIL_FROM ?? 'argus@localhost',
    to: env.ARGUS_EMAIL_TO ?? '',
  },
  webhook: { enabled: !!env.ARGUS_WEBHOOK_URL, url: env.ARGUS_WEBHOOK_URL ?? '' },
  command: {
    enabled: env.ARGUS_COMMAND_ENABLED === '1',
    bin: env.ARGUS_COMMAND_BIN ?? '',
    args: env.ARGUS_COMMAND_ARGS ?? '',
  },
})

export function settings(): Settings {
  const base = defaults()
  for (const row of all<{ key: string; value: string }>('select key, value from settings')) {
    if (!(row.key in base)) continue
    try {
      Object.assign(base[row.key as ChannelId], JSON.parse(row.value))
    } catch {
      // keep the default for a corrupt row rather than failing every notification
    }
  }
  return base
}

export function saveSettings(patch: Partial<Settings>) {
  for (const [key, value] of Object.entries(patch)) {
    if (!(key in defaults())) continue
    run(
      'insert into settings (key, value) values (?, ?) on conflict(key) do update set value=excluded.value',
      key,
      JSON.stringify(value),
    )
  }
}

/** Secrets never travel back to the browser; the UI only needs to know they're set. */
export function redactedSettings() {
  const s = settings()
  return {
    email: { ...s.email, pass: mask(s.email.pass) },
    webhook: s.webhook,
    command: s.command,
  }
}

const MASK = '••••••••'
const mask = (v: string) => (v ? MASK : '')

/** A masked value means "unchanged", not "clear it". */
export const unmask = (incoming: string | undefined, current: string) =>
  incoming === undefined || incoming === MASK ? current : incoming

export function channelsFor(watchChannels: string | null): ChannelId[] {
  const s = settings()
  const enabled = (['email', 'webhook', 'command'] as ChannelId[]).filter(
    (c) => s[c].enabled,
  )
  if (!watchChannels) return enabled
  try {
    const picked = JSON.parse(watchChannels) as string[]
    return enabled.filter((c) => picked.includes(c))
  } catch {
    return enabled
  }
}
