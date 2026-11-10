import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const url = process.argv[2] || 'https://mcosmeticsline.com/'

for (const line of fs.readFileSync(path.join(root, '.env.local'), 'utf8').split(/\r?\n/)) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq <= 0) continue
  const k = t.slice(0, eq).trim()
  let v = t.slice(eq + 1).trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1)
  }
  if (process.env[k] === undefined) process.env[k] = v
}

const server = await createServer({
  root,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
try {
  const mod = await server.ssrLoadModule('/api/_lib/fetchProductPage.ts')
  const r = await mod.fetchProductPage(url, { mode: 'brand' })
  if (!r.ok) {
    console.log('FAIL', r.error)
    process.exit(1)
  }
  const kit = r.data.completeBrandKit || {}
  console.log(
    JSON.stringify(
      {
        title: r.data.title,
        colors: r.data.colors,
        colorProof: (r.data.colorDetails || []).map((c) => ({
          hex: c.hex,
          classification: c.classification || c.role,
          verified: c.verified,
          themeKind: c.themeKind,
          cssVariable: c.cssVariable,
          source: c.source,
          evidence: c.evidence,
        })),
        fonts: r.data.fonts,
        fontProof: (r.data.fontDetails || []).map((f) => ({
          name: f.name,
          usage: f.usage,
          verified: f.verified,
          fontFileLoaded: f.fontFileLoaded,
          source: f.source,
        })),
        aiRefined: r.data.aiRefined,
        aiWarning: r.data.aiWarning,
        method: r.data.extractionMethod,
        styleNotes: r.data.styleNotes,
        kitInferred: Object.values(kit).filter((v) => v.status === 'ai-inferred')
          .length,
        kitVerified: Object.values(kit).filter((v) => v.status === 'verified')
          .length,
        niche: kit.niche,
        targetAudience: kit.targetAudience,
        brandPersonality: kit.brandPersonality,
        photographyStyle: kit.photographyStyle,
      },
      null,
      2,
    ),
  )
} finally {
  await server.close()
}
