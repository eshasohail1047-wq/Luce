/** Check if OpenRouter heygen video URLs play without Authorization. */
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
const key = env.OPENROUTER_API_KEY
if (!key) {
  console.error('OPENROUTER_API_KEY missing')
  process.exit(1)
}

const frame = await sharp({
  create: {
    width: 512,
    height: 896,
    channels: 3,
    background: { r: 180, g: 120, b: 60 },
  },
})
  .jpeg()
  .toBuffer()
const dataUrl = `data:image/jpeg;base64,${frame.toString('base64')}`

console.log('Submitting heygen/heygen-video-1…')
const submit = await fetch('https://openrouter.ai/api/v1/videos', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer':
      env.OPENROUTER_HTTP_REFERER || 'https://luce-landing.vercel.app',
    'X-Title': env.OPENROUTER_APP_TITLE || 'LUCE',
  },
  body: JSON.stringify({
    model: 'heygen/heygen-video-1',
    prompt: 'Slow push-in on a product bottle, cinematic',
    duration: 5,
    aspect_ratio: '9:16',
    frame_images: [
      {
        type: 'image_url',
        image_url: { url: dataUrl },
        frame_type: 'first_frame',
      },
    ],
  }),
})
const sj = await submit.json()
console.log('submit', submit.status, { id: sj.id, status: sj.status, error: sj.error })
if (!sj.id) process.exit(1)

const pollUrl = sj.polling_url || `https://openrouter.ai/api/v1/videos/${sj.id}`
let done = null
for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, 5000))
  const pr = await fetch(pollUrl, { headers: { Authorization: `Bearer ${key}` } })
  const pj = await pr.json()
  console.log('poll', i, pj.status, pj.unsigned_urls?.[0]?.slice(0, 90))
  if (pj.status === 'completed') {
    done = pj
    break
  }
  if (['failed', 'cancelled', 'expired'].includes(pj.status)) {
    console.error(pj)
    process.exit(1)
  }
}
if (!done) {
  console.error('timeout')
  process.exit(1)
}

const u = done.unsigned_urls?.[0]
console.log('keys', Object.keys(done))
if (!u) {
  console.error('no unsigned_urls')
  process.exit(1)
}

const noAuth = await fetch(u, { method: 'GET', redirect: 'follow' })
console.log('GET without auth', noAuth.status, noAuth.headers.get('content-type'), 'bytes', (await noAuth.arrayBuffer()).byteLength)

const withAuth = await fetch(u, {
  method: 'GET',
  redirect: 'follow',
  headers: { Authorization: `Bearer ${key}` },
})
console.log('GET with auth', withAuth.status, withAuth.headers.get('content-type'), 'bytes', (await withAuth.arrayBuffer()).byteLength)
