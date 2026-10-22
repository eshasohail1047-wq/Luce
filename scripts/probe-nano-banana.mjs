/** Probe OpenRouter google/gemini-2.5-flash-image (Nano Banana). */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import sharp from 'sharp'

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
const model = env.OPENROUTER_IMAGE_MODEL || 'google/gemini-2.5-flash-image'
if (!apiKey) {
  console.error('OPENROUTER_API_KEY missing')
  process.exit(1)
}

const productBuf = await sharp({
  create: { width: 512, height: 640, channels: 3, background: { r: 210, g: 170, b: 80 } },
})
  .jpeg()
  .toBuffer()
const product = `data:image/jpeg;base64,${productBuf.toString('base64')}`

console.log('Probing', model, '…')
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
    prompt:
      'Studio packshot of this gold product tube on a clean light-gray seamless background. Keep the product packaging exact.',
    aspect_ratio: '4:5',
    input_references: [
      { type: 'image_url', image_url: { url: product } },
    ],
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
  console.error('FAIL', res.status, typeof body === 'string' ? body.slice(0, 800) : body)
  process.exit(1)
}

const data = body?.data
const first = Array.isArray(data) ? data[0] : null
console.log('OK', res.status, {
  model: body?.model || model,
  images: Array.isArray(data) ? data.length : 0,
  hasImage: Boolean(first?.b64_json || first?.url),
  cost: body?.usage?.cost,
})
