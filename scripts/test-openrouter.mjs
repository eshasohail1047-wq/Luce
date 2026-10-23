/**
 * Smoke-test OpenRouter for chat / image generation.
 * Reads OPENROUTER_* from .env.local — never prints the key.
 */
import fs from 'node:fs'

function loadEnvLocal() {
  const text = fs.readFileSync('.env.local', 'utf8')
  const env = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    env[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return env
}

const env = loadEnvLocal()
const key = env.OPENROUTER_API_KEY
const base = (env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/$/, '')
const referer = env.OPENROUTER_HTTP_REFERER || 'https://luce-landing.vercel.app'
const title = env.OPENROUTER_APP_TITLE || 'LUCE'

if (!key) {
  console.error('Missing OPENROUTER_API_KEY in .env.local')
  process.exit(1)
}

async function req(name, path, body) {
  console.log(`\n=== ${name} ===`)
  const res = await fetch(`${base}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'HTTP-Referer': referer,
      'X-Title': title,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  console.log(`HTTP ${res.status}`)
  console.log(text.slice(0, 1200))
  return { status: res.status, text }
}

const models = await req('MODELS', '/models')
const chat = await req('CHAT', '/chat/completions', {
  model: 'openrouter/free',
  models: [
    'google/gemma-4-31b-it:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'nvidia/nemotron-3.5-lightning:free',
  ],
  messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
  max_tokens: 16,
})
const image = await req('IMAGE', '/chat/completions', {
  model: 'google/gemini-3-pro-image',
  messages: [
    {
      role: 'user',
      content: 'Generate one simple image: a red apple on a white background.',
    },
  ],
  modalities: ['image', 'text'],
})

const videoModels = await req('VIDEO_MODELS_SCAN', '/models')
let videoCapable = []
try {
  const parsed = JSON.parse(videoModels.text)
  videoCapable = (parsed.data || [])
    .filter((m) => (m.architecture?.output_modalities || []).includes('video'))
    .map((m) => m.id)
} catch {
  /* ignore */
}

console.log('\n=== SUMMARY ===')
console.log(
  JSON.stringify(
    {
      modelsOk: models.status === 200,
      chatOk: chat.status === 200,
      imageStatus: image.status,
      imageLooksSuccessful:
        image.status === 200 &&
        (image.text.includes('image') || image.text.includes('b64_json') || image.text.includes('data:image')),
      videoCapableModelCount: videoCapable.length,
      videoCapableModels: videoCapable.slice(0, 10),
      note: 'OpenRouter supports image via specific multimodal models. Native video generation models were not listed for this account.',
    },
    null,
    2,
  ),
)
