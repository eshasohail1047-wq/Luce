/**
 * Smoke-test AgentRouter (OpenAI-compatible) for chat / image / video.
 * Reads AGENTROUTER_API_KEY from .env.local — never prints the key.
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
const key = env.AGENTROUTER_API_KEY
const base = (env.AGENTROUTER_BASE_URL || 'https://agentrouter.org/v1').replace(/\/$/, '')

if (!key) {
  console.error('Missing AGENTROUTER_API_KEY in .env.local')
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
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  console.log(`HTTP ${res.status}`)
  console.log(text.slice(0, 1000))
  return { status: res.status, text }
}

const results = {
  models: await req('MODELS', '/models'),
  chat: await req('CHAT', '/chat/completions', {
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Reply OK' }],
    max_tokens: 16,
  }),
  image: await req('IMAGE', '/images/generations', {
    model: 'dall-e-3',
    prompt: 'a red apple on white background',
    n: 1,
    size: '1024x1024',
  }),
  video: await req('VIDEO', '/videos/generations', {
    prompt: 'a short product clip',
  }),
}

console.log('\n=== SUMMARY ===')
console.log(
  JSON.stringify(
    {
      modelsOk: results.models.status === 200,
      chatOk: results.chat.status === 200,
      imageOk: results.image.status === 200,
      videoOk: results.video.status === 200,
      modelsStatus: results.models.status,
      chatStatus: results.chat.status,
      imageStatus: results.image.status,
      videoStatus: results.video.status,
    },
    null,
    2,
  ),
)
