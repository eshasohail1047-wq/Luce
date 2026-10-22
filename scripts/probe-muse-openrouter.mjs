/** Probe OpenRouter meta/muse-image ($0.01). */
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
const model = env.OPENROUTER_IMAGE_MODEL || 'meta/muse-image'
if (!key) {
  console.error('OPENROUTER_API_KEY missing')
  process.exit(1)
}

const tiny =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6aAAAAAElFTkSuQmCC'

console.log('model:', model)
const res = await fetch('https://openrouter.ai/api/v1/images', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': env.OPENROUTER_HTTP_REFERER || 'https://luce-landing.vercel.app',
    'X-Title': env.OPENROUTER_APP_TITLE || 'LUCE',
  },
  body: JSON.stringify({
    model,
    prompt:
      'Moody editorial product photo, dark dramatic lighting, 4:5. Keep product from reference exact.',
    output_format: 'png',
    aspect_ratio: '4:5',
    input_references: [{ type: 'image_url', image_url: { url: tiny } }],
  }),
})

const text = await res.text()
console.log('HTTP', res.status)
if (!res.ok) {
  console.error(text.slice(0, 600))
  process.exit(1)
}
const j = JSON.parse(text)
console.log('ok items:', j.data?.length || 0)
console.log('has b64:', Boolean(j.data?.[0]?.b64_json || j.data?.[0]?.url))
