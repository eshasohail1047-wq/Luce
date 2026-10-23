import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '..', 'public', 'images')
const base = process.env.HIW_BASE || 'http://127.0.0.1:5176'
const browserPath =
  process.env.BROWSER_PATH ||
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'

/** Only recapture results/saved — product + formats use real user screenshots. */
const shots = [
  { shot: 'results', file: 'hiw-app-results.jpg' },
  { shot: 'saved', file: 'hiw-app-saved.jpg' },
]

await mkdir(outDir, { recursive: true })

const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: true,
  args: ['--no-sandbox', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 2 },
})

try {
  const page = await browser.newPage()
  for (const item of shots) {
    const url = `${base}/demo/hiw?shot=${item.shot}`
    console.log('capturing', url)
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 })
    await page.waitForSelector(`[data-hiw-shot="${item.shot}"]`, { timeout: 20_000 })
    await page.waitForSelector('.hiw-shot-capture', { timeout: 20_000 })
    await new Promise((r) => setTimeout(r, 1500))
    const el = await page.$('.hiw-shot-capture')
    if (!el) throw new Error('Missing .hiw-shot-capture')
    const buf = await el.screenshot({ type: 'jpeg', quality: 90 })
    const dest = path.join(outDir, item.file)
    await writeFile(dest, buf)
    console.log('wrote', dest)
  }
} finally {
  await browser.close()
}
