// Renders the email lockup to a PNG. Email clients (Gmail especially) strip
// inline SVG, so the mail header needs a raster asset attached by cid.
//   node scripts/lockup.mjs      (from web/)
import { chromium } from 'playwright-core'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const html = `<html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@700&display=swap">
<style>
  *{margin:0;padding:0}
  body{width:420px;height:80px;background:#0b1215;display:flex;align-items:center;gap:16px;padding:0 4px}
  span{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:38px;color:#e8f0f4;letter-spacing:-.02em}
</style></head><body>
<svg width="60" height="40" viewBox="0 0 48 32" fill="none">
  <defs><clipPath id="e"><path d="M2 16C2 16 10 4.5 24 4.5C38 4.5 46 16 46 16C46 16 38 27.5 24 27.5C10 27.5 2 16 2 16Z"/></clipPath></defs>
  <g clip-path="url(#e)">
    <rect x="7.7" y="0" width="4.6" height="32" fill="#8da0ad" opacity=".5"/>
    <rect x="14.7" y="0" width="4.6" height="32" fill="#8da0ad" opacity=".75"/>
    <rect x="21.7" y="0" width="4.6" height="32" fill="#ff2060"/>
    <rect x="28.7" y="0" width="4.6" height="32" fill="#8da0ad" opacity=".75"/>
    <rect x="35.7" y="0" width="4.6" height="32" fill="#8da0ad" opacity=".5"/>
  </g>
  <path d="M2 16C2 16 10 4.5 24 4.5C38 4.5 46 16 46 16C46 16 38 27.5 24 27.5C10 27.5 2 16 2 16Z" stroke="#e8f0f4" stroke-width="1.5" stroke-linejoin="round"/>
</svg><span>argus</span></body></html>`

const b = await chromium.launch({
  executablePath: process.env.ARGUS_CHROME ?? '/usr/bin/google-chrome-stable',
  args: ['--no-sandbox'],
})
// 2x so it stays crisp on retina mail clients
const p = await b.newPage({ viewport: { width: 420, height: 80 }, deviceScaleFactor: 2 })
await p.setContent(html, { waitUntil: 'networkidle' })
await p.waitForTimeout(600)
await p.screenshot({ path: join(here, '../../server/assets/lockup@2x.png') })
await b.close()
console.log('wrote server/assets/lockup@2x.png')
