/** Quick OpenRouter image probe — product still → one generated image. */
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
const model = env.OPENROUTER_IMAGE_MODEL || 'google/gemini-3-pro-image'
if (!key) {
  console.error('OPENROUTER_API_KEY missing')
  process.exit(1)
}

const tiny =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6aAAAAAElFTkSuQmCC'

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
      'Premium moody editorial product photo, dark dramatic lighting, 4:5 portrait. Keep the product from the reference exact.',
    output_format: 'png',
    aspect_ratio: '4:5',
    input_references: [{ type: 'image_url', image_url: { url: tiny } }],
  }),
})

const text = await res.text()
console.log('HTTP', res.status)
console.log(text.slice(0, 400))
if (!res.ok) process.exit(1)
const j = JSON.parse(text)
console.log('has data:', Array.isArray(j.data), 'items:', j.data?.length || 0)
console.log('OK')
