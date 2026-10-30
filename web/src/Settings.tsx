import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from './api'
import type { AllSettings, ChannelId } from './api'
import { Mark } from './components/Mark'

type TestState = { state: 'idle' | 'sending' | 'ok' | 'error'; message?: string }

const CHANNELS: {
  id: ChannelId
  title: string
  blurb: string
}[] = [
  {
    id: 'email',
    title: 'Email',
    blurb: 'A formatted mail showing what moved, with the changed regions embedded.',
  },
  {
    id: 'webhook',
    title: 'Webhook',
    blurb: 'A JSON POST with the full change description, for wiring into anything else.',
  },
  {
    id: 'command',
    title: 'Local command',
    blurb: 'Runs a notification CLI on this machine per change, with the annotated screenshot attached for visual watches.',
  },
]

export function Settings() {
  const [s, setS] = useState<AllSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [tests, setTests] = useState<Record<string, TestState>>({})

  useEffect(() => {
    api.settings().then(setS).catch(() => {})
  }, [])

  const patch = <K extends ChannelId>(channel: K, part: Partial<AllSettings[K]>) =>
    setS((cur) => (cur ? { ...cur, [channel]: { ...cur[channel], ...part } } : cur))

  const save = async () => {
    if (!s) return
    setSaving(true)
    try {
      setS(await api.saveSettings(s))
    } finally {
      setSaving(false)
    }
  }

  const test = async (id: ChannelId) => {
    setTests((t) => ({ ...t, [id]: { state: 'sending' } }))
    if (s) await api.saveSettings(s).then(setS).catch(() => {})
    try {
      await api.testChannel(id)
      setTests((t) => ({ ...t, [id]: { state: 'ok' } }))
    } catch (e) {
      setTests((t) => ({ ...t, [id]: { state: 'error', message: (e as Error).message } }))
    }
  }

  if (!s) return <p className="py-24 text-center text-sm text-dim">Loading…</p>

  return (
    <div className="min-h-screen">
      <header className="border-line bg-ground/90 sticky top-0 z-20 flex items-center gap-3 border-b px-5 py-3 backdrop-blur">
        <Link to="/" className="btn-ghost btn px-2 py-1" aria-label="Back to all watches">
          <Mark compact className="h-4 text-ink" />
        </Link>
        <h1 className="font-mono text-xs tracking-[0.16em] uppercase">Notifications</h1>
        <button className="btn btn-primary ml-auto" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-5 py-6">
        <p className="text-dim text-[13px]">
          argus tells you about a change through every channel you turn on. Each one gets the same
          description — what changed, which numbers moved, and the annotated image for visual
          watches. Individual watches can narrow this to a subset.
        </p>

        {CHANNELS.map((c) => {
          const cfg = s[c.id] as Record<string, unknown>
          const t = tests[c.id] ?? { state: 'idle' }
          return (
            <section key={c.id} className="panel overflow-hidden">
              <header className="border-line flex flex-wrap items-center gap-3 border-b px-4 py-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!cfg.enabled}
                    onChange={(e) => patch(c.id, { enabled: e.target.checked } as never)}
                    className="accent-[var(--color-change)]"
                  />
                  <span className="text-ink text-sm">{c.title}</span>
                </label>
                <span
                  className={`chip border ${
                    cfg.enabled ? 'border-quiet/50 bg-quiet/10 text-quiet' : 'border-line text-faint'
                  }`}
                >
                  {cfg.enabled ? 'on' : 'off'}
                </span>

                <div className="ml-auto flex items-center gap-2">
                  {t.state === 'ok' && <span className="text-quiet text-[12px]">Test sent</span>}
                  {t.state === 'error' && (
                    <span className="text-warn max-w-[38ch] truncate text-[12px]" title={t.message}>
                      {t.message}
                    </span>
                  )}
                  <button className="btn" onClick={() => test(c.id)} disabled={t.state === 'sending'}>
                    {t.state === 'sending' ? 'Sending…' : 'Send test'}
                  </button>
                </div>
              </header>

              <div className="space-y-3 p-4">
                <p className="text-dim text-[12px]">{c.blurb}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {FIELDS[c.id].map((f) => (
                    <Field
                      key={f.key}
                      label={f.label}
                      hint={f.hint}
                      type={f.type}
                      value={cfg[f.key]}
                      onChange={(v) => patch(c.id, { [f.key]: v } as never)}
                    />
                  ))}
                </div>
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}

type FieldSpec = { key: string; label: string; hint?: string; type?: 'text' | 'password' | 'number' | 'checkbox' }

const FIELDS: Record<ChannelId, FieldSpec[]> = {
  email: [
    { key: 'host', label: 'SMTP host' },
    { key: 'port', label: 'Port', type: 'number' },
    { key: 'secure', label: 'Use TLS on connect', type: 'checkbox', hint: 'On for port 465, off for 587.' },
    { key: 'user', label: 'Username' },
    { key: 'pass', label: 'Password', type: 'password' },
    { key: 'from', label: 'From address' },
    { key: 'to', label: 'Send to', hint: 'Comma-separated for more than one.' },
  ],
  webhook: [{ key: 'url', label: 'URL', hint: 'Receives a JSON POST. A watch can override this.' }],
  command: [
    { key: 'bin', label: 'Program', hint: 'Must be on this machine’s PATH.' },
    { key: 'args', label: 'Arguments', hint: 'Followed by --stream <stream>, --file <screenshot> and the message.' },
  ],
}

function Field({
  label,
  hint,
  type = 'text',
  value,
  onChange,
}: {
  label: string
  hint?: string
  type?: string
  value: unknown
  onChange: (v: unknown) => void
}) {
  if (type === 'checkbox') {
    return (
      <label className="flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 accent-[var(--color-change)]"
        />
        <span>
          <span className="text-dim">{label}</span>
          {hint && <span className="text-faint block text-[11px]">{hint}</span>}
        </span>
      </label>
    )
  }
  return (
    <div>
      <label className="text-dim mb-1 block text-xs">{label}</label>
      <input
        className="field font-mono text-[12px]"
        type={type}
        value={String(value ?? '')}
        onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)}
      />
      {hint && <p className="text-faint mt-1 text-[11px]">{hint}</p>}
    </div>
  )
}
