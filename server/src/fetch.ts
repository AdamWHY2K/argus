import { config } from './config.ts'

export type Fetched = { html: string; status: number; finalUrl: string }

export async function httpFetch(
  url: string,
  opts: { headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<Fetched> {
  const res = await fetch(url, {
    headers: {
      'user-agent': config.userAgent,
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9,tr;q=0.8',
      ...opts.headers,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(opts.timeoutMs ?? config.fetchTimeoutMs),
  })
  const html = await res.text()
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  return { html, status: res.status, finalUrl: res.url }
}
