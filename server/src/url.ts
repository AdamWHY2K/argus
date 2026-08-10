/**
 * People type `telawiki.com`, not `https://telawiki.com`. Accept both everywhere
 * a URL enters the system rather than making the UI the only place that knows.
 */
export function normalizeUrl(raw: string): string {
  const s = raw.trim()
  if (!s) return s
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s
  if (s.startsWith('//')) return `https:${s}`
  return `https://${s}`
}
