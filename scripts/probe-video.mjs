import fs from 'node:fs'

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
  console.error('OPENROUTER_API_KEY missing')
  process.exit(1)
}

const tiny =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6aAAAAAElFTkSuQmCC'

const res = await fetch('https://openrouter.ai/api/v1/videos', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://luce-landing.vercel.app',
    'X-Title': 'LUCE',
  },
  body: JSON.stringify({
    model,
    prompt: 'Slow cinematic orbit of a product bottle, soft mist, luxury commercial, 9:16.',
    duration: 5,
    aspect_ratio: '9:16',
    resolution: '768p',
    frame_images: [
      {
        type: 'image_url',
        image_url: { url: tiny },
        frame_type: 'first_frame',
      },
    ],
  }),
})

const text = await res.text()
console.log('HTTP', res.status)
console.log(text.slice(0, 1200))
