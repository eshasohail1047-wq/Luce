/** Probe OpenRouter black-forest-labs/flux-3-image-klein (~$0.01). */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnv(file) {
  if (!existsSync(file)) return {}
  const out = {}
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1)
    }
    out[k] = v
  }
  return out
}

const env = { ...loadEnv(resolve('.env')), ...loadEnv(resolve('.env.local')) }
const apiKey = env.OPENROUTER_API_KEY
const model =
  env.OPENROUTER_IMAGE_MODEL || 'black-forest-labs/flux-3-image-klein'

if (!apiKey) {
  console.error('OPENROUTER_API_KEY missing')
  process.exit(1)
}

console.log('Probing', model, 'resolution=1K …')
const res = await fetch('https://openrouter.ai/api/v1/images', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': env.OPENROUTER_HTTP_REFERER || 'https://luce-landing.vercel.app',
    'X-Title': env.OPENROUTER_APP_TITLE || 'LUCE',
  },
  body: JSON.stringify({
    model,
    prompt: 'A simple white ceramic mug on a marble counter, soft daylight, product photo',
    aspect_ratio: '1:1',
    resolution: '1K',
  }),
})

const text = await res.text()
let body
try {
  body = JSON.parse(text)
} catch {
  body = text
}

if (!res.ok) {
  console.error('FAIL', res.status, typeof body === 'string' ? body.slice(0, 500) : body)
  process.exit(1)
}

const data = body?.data
const first = Array.isArray(data) ? data[0] : null
const hasB64 = Boolean(first?.b64_json || first?.url)
console.log('OK', res.status, {
  model: body?.model || model,
  images: Array.isArray(data) ? data.length : 0,
  hasImage: hasB64,
  keys: first ? Object.keys(first) : [],
})
