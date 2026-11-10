/**
 * Live brand-scan smoke test. Uses Vite SSR once per URL (fresh server) so a
 * closed module runner cannot poison later sites.
 * Run: node scripts/test-brand-scan.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

function loadEnvLocal() {
  const envPath = path.join(root, '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

loadEnvLocal()

const urls = [
  'https://mcosmeticsline.com/',
  'https://luce-landing.vercel.app/',
  'https://colourpop.com/',
  'https://www.darimooch.com/',
  'https://this-domain-definitely-does-not-exist-luce-test.invalid/',
]

async function scanOne(url) {
  const server = await createServer({
    root,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })
  const stages = []
  const started = Date.now()
  try {
    const mod = await server.ssrLoadModule('/api/_lib/fetchProductPage.ts')
    const result = await mod.fetchProductPage(url, {
      mode: 'brand',
      onProgress: (event) => {
        stages.push(`${event.stageId}:${event.status}:${event.pct}`)
        process.stdout.write(
          `  [${event.pct}%] ${event.stageId} ${event.status}${event.message ? ` — ${event.message}` : ''}\n`,
        )
      },
    })
    return { result, stages, ms: Date.now() - started }
  } finally {
    await server.close().catch(() => {})
  }
}

const out = []

for (const url of urls) {
  console.log(`\n=== SCAN ${url} ===`)
  try {
    const { result, stages, ms } = await scanOne(url)
    if (!result.ok) {
      const row = {
        url,
        ok: false,
        status: result.status,
        error: result.error,
        ms,
        stages,
      }
      out.push(row)
      console.log('FAIL', row.error)
      continue
    }
    const d = result.data
    const kit = d.completeBrandKit || {}
    const row = {
      url,
      ok: true,
      ms,
      title: d.title,
      colors: d.colors || [],
      fonts: d.fonts || [],
      colorRoles: (d.colorDetails || []).map(
        (c) =>
          `${c.hex}:${c.classification || c.role || '?'}:${c.verified ? 'v' : 'e'}`,
      ),
      fontUsages: (d.fontDetails || []).map(
        (f) => `${f.name}:${f.usage || '?'}:${f.verified ? 'v' : 'e'}`,
      ),
      products: (d.products || []).length,
      images: (d.images || []).length,
      logoUrl: Boolean(d.logoUrl),
      aiRefined: d.aiRefined === true,
      aiWarning: d.aiWarning || null,
      extractionMethod: d.extractionMethod,
      extractionConfidence: d.extractionConfidence,
      inventedCheck: {
        colorsAreFromDetails: (d.colors || []).every((hex) =>
          (d.colorDetails || []).some(
            (c) => c.hex.toUpperCase() === hex.toUpperCase(),
          ),
        ),
        fontsAreFromDetails: (d.fonts || []).every((name) =>
          (d.fontDetails || []).some(
            (f) => f.name.toLowerCase() === name.toLowerCase(),
          ),
        ),
      },
      kitFieldCount: Object.keys(kit).length,
      kitUnknown: Object.values(kit).filter((v) => v?.status === 'unknown')
        .length,
      kitVerified: Object.values(kit).filter((v) => v?.status === 'verified')
        .length,
      kitInferred: Object.values(kit).filter((v) => v?.status === 'ai-inferred')
        .length,
      reachedDone100: stages.some((s) => s.startsWith('done:done:100')),
      stages,
    }
    out.push(row)
    console.log(
      `OK ${ms}ms colors=${row.colors.length} fonts=${row.fonts.length} products=${row.products} ai=${row.aiRefined} method=${row.extractionMethod}`,
    )
  } catch (err) {
    const row = {
      url,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      ms: 0,
      stages: [],
    }
    out.push(row)
    console.log('THROW', row.error)
  }
}

const reportPath = path.join(root, '.tmp-brand-scan-report.json')
fs.writeFileSync(reportPath, JSON.stringify(out, null, 2))
console.log(`\nWrote ${reportPath}`)
const live = out.slice(0, 4)
console.log(`Passed ${live.filter((r) => r.ok).length}/4 live sites`)
const invalid = out[4]
console.log(
  `Invalid URL handled: ${!invalid?.ok ? 'yes' : 'unexpected ok'} (${invalid?.error || ''})`,
)
