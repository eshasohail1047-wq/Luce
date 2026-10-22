/**
 * End-to-end: product-like JPEG → OpenRouter heygen-video-1 → playable URL.
 * Does not print secrets.
 */
import fs from 'node:fs'
import sharp from 'sharp'

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      let v = l.slice(i + 1).trim()
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1)
      }
      return [l.slice(0, i).trim(), v]
    }),
)

const key = env.OPENROUTER_API_KEY
const model = env.OPENROUTER_VIDEO_MODEL || 'heygen/heygen-video-1'
if (!key) {
  console.error('FAIL: OPENROUTER_API_KEY missing')
  process.exit(1)
}
console.log('key present:', key.length > 10)
console.log('model:', model)

// ~realistic product still (~150–250KB jpeg)
const jpeg = await sharp({
  create: {
    width: 720,
    height: 1280,
    channels: 3,
    background: { r: 220, g: 200, b: 180 },
  },
})
  .composite([
    {
      input: await sharp({
        create: {
          width: 280,
          height: 360,
          channels: 3,
          background: { r: 255, g: 255, b: 255 },
        },
      })
        .jpeg()
        .toBuffer(),
      top: 460,
      left: 220,
    },
  ])
  .jpeg({ quality: 82 })
  .toBuffer()

const dataUrl = `data:image/jpeg;base64,${jpeg.toString('base64')}`
console.log('frame size KB:', Math.round(dataUrl.length / 1024))

const body = {
  model,
  prompt:
    'Vertical 9:16 cinematic product video. Slow camera push toward the white jar on the warm surface, soft mist, luxury commercial motion. Keep packaging exact.',
  duration: 5,
  aspect_ratio: '9:16',
  resolution: '768p',
  frame_images: [
    {
      type: 'image_url',
      image_url: { url: dataUrl },
      frame_type: 'first_frame',
    },
  ],
}

const payload = JSON.stringify(body)
console.log('payload KB:', Math.round(payload.length / 1024))

const submitRes = await fetch('https://openrouter.ai/api/v1/videos', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': env.OPENROUTER_HTTP_REFERER || 'https://luce-landing.vercel.app',
    'X-Title': env.OPENROUTER_APP_TITLE || 'LUCE',
  },
  body: payload,
})

const submitText = await submitRes.text()
console.log('submit HTTP', submitRes.status)
let submitJson
try {
  submitJson = JSON.parse(submitText)
} catch {
  console.error('submit body (trim):', submitText.slice(0, 500))
  process.exit(1)
}

if (!submitRes.ok || !submitJson?.id) {
  console.error('submit error:', submitText.slice(0, 800))
  process.exit(1)
}

const jobId = submitJson.id
const pollUrl =
  submitJson.polling_url || `https://openrouter.ai/api/v1/videos/${jobId}`
console.log('job:', jobId)

for (let i = 0; i < 40; i++) {
  await new Promise((r) => setTimeout(r, i === 0 ? 5000 : 8000))
  const pollRes = await fetch(pollUrl, {
    headers: { Authorization: `Bearer ${key}` },
  })
  const pollJson = await pollRes.json().catch(() => null)
  const status = pollJson?.status || '?'
  console.log(`poll ${i + 1}: ${status}`)
  if (status === 'completed') {
    const url = pollJson?.unsigned_urls?.[0]
    console.log('OK completed')
    console.log('has unsigned url:', Boolean(url))
    console.log('url prefix:', url ? String(url).slice(0, 80) : 'none')
    process.exit(0)
  }
  if (status === 'failed' || status === 'cancelled' || status === 'expired') {
    console.error('FAIL status', status, JSON.stringify(pollJson).slice(0, 600))
    process.exit(1)
  }
}

console.error('FAIL: timed out')
process.exit(1)
