import * as cheerio from 'cheerio'
import { convert } from 'html-to-text'

/** Elements that never carry meaningful visible content. */
const STRIP = 'script, style, noscript, svg, canvas, template, link, meta, iframe'

export type ExtractOpts = {
  selector?: string | null
  ignoreSelectors?: string[]
  ignoreRegex?: string[]
}

/** Collapse whitespace and drop blank lines so trivial reflows don't read as changes. */
export const normalize = (text: string) =>
  text
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim().replace(/[ \t]+/g, ' '))
    .filter(Boolean)
    .join('\n')

export function extractText(html: string, opts: ExtractOpts = {}): string {
  const $ = cheerio.load(html)
  $(STRIP).remove()
  for (const sel of opts.ignoreSelectors ?? []) {
    try {
      $(sel).remove()
    } catch {
      // an invalid user-supplied selector shouldn't kill the check
    }
  }

  let scope = $('body')
  if (opts.selector) {
    const found = $(opts.selector)
    if (!found.length) throw new Error(`selector matched nothing: ${opts.selector}`)
    scope = found
  }

  const text = convert($.html(scope), {
    wordwrap: false,
    selectors: [
      { selector: 'a', options: { ignoreHref: true } },
      { selector: 'img', format: 'skip' },
    ],
  })
  return applyIgnoreRegex(normalize(text), opts.ignoreRegex ?? [])
}

/** Drop whole lines matching any user regex — the usual home for clocks and counters. */
export function applyIgnoreRegex(text: string, patterns: string[]): string {
  if (!patterns.length) return text
  const res: RegExp[] = []
  for (const p of patterns) {
    try {
      res.push(new RegExp(p))
    } catch {
      // skip invalid pattern
    }
  }
  if (!res.length) return text
  return text
    .split('\n')
    .filter((line) => !res.some((re) => re.test(line)))
    .join('\n')
}

/** Page <title>, used to auto-name a watch. */
export function pageTitle(html: string): string | null {
  const t = cheerio.load(html)('title').first().text().trim()
  return t || null
}
