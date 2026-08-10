import * as cheerio from 'cheerio'

/**
 * Client-side half of the element picker. Runs inside the proxied page and
 * reports a CSS selector to the parent frame. Page scripts are stripped before
 * this is injected, so nothing here has to fight a live SPA.
 */
const PICKER_JS = String.raw`
(() => {
  const box = document.createElement('div')
  box.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483647;border:2px solid #ff2060;background:rgba(255,32,96,.12);border-radius:2px;transition:all .04s linear'
  const tag = document.createElement('div')
  tag.style.cssText = 'position:absolute;pointer-events:none;z-index:2147483647;background:#ff2060;color:#fff;font:11px/1.5 ui-monospace,monospace;padding:1px 5px;border-radius:2px;white-space:nowrap;max-width:90vw;overflow:hidden;text-overflow:ellipsis'
  let current = null

  const ready = () => {
    document.body.appendChild(box)
    document.body.appendChild(tag)
  }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', ready) : ready()

  const skip = (c) => /^(is-|has-|js-|css-|sc-|Mui|_)/.test(c) || /[0-9a-f]{6,}/i.test(c) || /\d{3,}/.test(c)

  /**
   * An id is only an anchor if it identifies the *role* of the element, not this
   * particular render of it. Numeric ids (HN story rows), long digit runs and hex
   * hashes are per-item and change on the very next check — anchoring to one
   * silently breaks the watch.
   */
  const unstableId = (id) =>
    !id ||
    /^\d/.test(id) ||
    /\d{3,}/.test(id) ||
    /[0-9a-f]{8,}/i.test(id) ||
    /^(ember|react-|radix-|headlessui-|:r)/i.test(id)

  const usableId = (node) =>
    node.id &&
    !unstableId(node.id) &&
    document.querySelectorAll('#' + CSS.escape(node.id)).length === 1

  function selectorFor(el) {
    if (usableId(el)) return '#' + CSS.escape(el.id)
    const parts = []
    let node = el
    while (node && node.nodeType === 1 && node !== document.documentElement) {
      if (usableId(node)) {
        parts.unshift('#' + CSS.escape(node.id))
        break
      }
      let part = node.tagName.toLowerCase()
      const classes = [...node.classList].filter((c) => !skip(c)).slice(0, 2)
      if (classes.length) part += '.' + classes.map((c) => CSS.escape(c)).join('.')
      const parent = node.parentElement
      if (parent) {
        const sameTag = [...parent.children].filter((s) => s.tagName === node.tagName)
        if (sameTag.length > 1) part += ':nth-of-type(' + (sameTag.indexOf(node) + 1) + ')'
      }
      parts.unshift(part)
      const candidate = parts.join(' > ')
      try {
        if (document.querySelectorAll(candidate).length === 1) return candidate
      } catch {}
      node = node.parentElement
    }
    return parts.join(' > ')
  }

  const paint = (el) => {
    const r = el.getBoundingClientRect()
    box.style.top = r.top + scrollY + 'px'
    box.style.left = r.left + scrollX + 'px'
    box.style.width = r.width + 'px'
    box.style.height = r.height + 'px'
    tag.style.top = Math.max(0, r.top + scrollY - 20) + 'px'
    tag.style.left = r.left + scrollX + 'px'
    tag.textContent = selectorFor(el)
  }

  const send = (type, el) =>
    parent.postMessage(
      { source: 'argus-picker', type, selector: selectorFor(el), text: (el.innerText || '').trim().slice(0, 300) },
      '*',
    )

  addEventListener('mousemove', (e) => {
    const el = e.target
    if (!el || el.nodeType !== 1 || el === current) return
    current = el
    paint(el)
    send('hover', el)
  })

  addEventListener(
    'click',
    (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (current) send('pick', current)
    },
    true,
  )

  addEventListener('scroll', () => current && paint(current), { passive: true })
})()
`

export function buildPickerHtml(html: string, baseUrl: string): string {
  const $ = cheerio.load(html)

  // Nothing on the page should run or navigate while it is being inspected.
  $('script').remove()
  $('base').remove()
  $('a[href]').attr('href', 'javascript:void(0)')
  $('form').removeAttr('action')

  const head = $('head')
  if (head.length) head.prepend(`<base href="${escapeAttr(baseUrl)}">`)
  else $.root().prepend(`<head><base href="${escapeAttr(baseUrl)}"></head>`)

  // Reveal-on-scroll patterns start hidden and are un-hidden by the very scripts
  // we just removed, so without this the page renders as an empty background.
  $('head').append(
    `<style>
      *{cursor:crosshair !important}
      html{scroll-behavior:auto !important}
      *,*::before,*::after{animation:none !important;transition:none !important}
      [style*="opacity:0"],[style*="opacity: 0"],
      [class*="reveal"],[class*="fade"],[class*="animate"],
      [data-aos],[data-animate],[data-scroll]{
        opacity:1 !important;visibility:visible !important;transform:none !important;
      }
    </style>`,
  )
  $('body').append(`<script>${PICKER_JS}</script>`)
  return $.html()
}

const escapeAttr = (s: string) => s.replace(/"/g, '&quot;').replace(/</g, '&lt;')
