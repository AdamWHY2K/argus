// Renders scripts/og.html to public/og.png. Run manually after editing the template:
//   node scripts/og.mjs        (from web/)
import { chromium } from 'playwright-core'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const b = await chromium.launch({
  executablePath: process.env.ARGUS_CHROME ?? '/usr/bin/google-chrome-stable',
  args: ['--no-sandbox'],
})
const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
await p.goto(`file://${join(here, 'og.html')}`, { waitUntil: 'networkidle' })
await p.waitForTimeout(700)
await p.screenshot({ path: join(here, '../public/og.png') })
await b.close()
console.log('wrote public/og.png')
