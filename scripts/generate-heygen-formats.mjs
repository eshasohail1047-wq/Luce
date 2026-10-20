/**
 * Generate remaining Video Studio format clips via OpenRouter (HeyGen quality).
 * Uses OPENROUTER_API_KEY from .env.local
 */
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const outDir = path.join(root, 'public/videos/formats')
const posterDir = path.join(root, 'public/images')
fs.mkdirSync(outDir, { recursive: true })

function loadEnvLocal() {
  const p = path.join(root, '.env.local')
  if (!fs.existsSync(p)) return
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#') || !t.includes('=')) continue
    const i = t.indexOf('=')
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (process.env[k] === undefined) process.env[k] = v
  }
}

loadEnvLocal()
const key = process.env.OPENROUTER_API_KEY?.trim()
if (!key) {
  console.error('Missing OPENROUTER_API_KEY')
  process.exit(1)
}

const headers = {
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER || 'https://luce-landing.vercel.app',
  'X-Title': process.env.OPENROUTER_APP_TITLE || 'LUCE',
}

const MODEL = process.env.OPENROUTER_VIDEO_MODEL?.trim() || 'heygen/heygen-video-1'

const PRODUCT =
  'the same rectangular clear glass perfume bottle with soft rose-gold / peach liquid and a polished rose-gold cylindrical metal cap, unbranded, luxury beauty commercial look'

const jobs = [
  {
    name: 'howto',
    poster: 'video-poster-howto.jpg',
    prompt: `Vertical 9:16 beauty commercial. Close-up of a young woman spraying ${PRODUCT} onto her inner wrist, fine mist visible, soft daylight bathroom, photorealistic, natural motion, premium quality.`,
  },
  {
    name: 'unboxing',
    poster: 'video-poster-unbox.jpg',
    prompt: `Vertical 9:16 unboxing video. Hands open a soft rose-pink gift box and lift out ${PRODUCT} on a light wood table, slow reveal, soft natural light, photorealistic premium commercial.`,
  },
  {
    name: 'ugc',
    poster: 'video-poster-ugc.jpg',
    prompt: `Vertical 9:16 UGC creator selfie video. Young woman holding ${PRODUCT} near her face, talking cheerfully to camera in a bright bedroom with soft fairy lights, natural motion, photorealistic.`,
  },
  {
    name: 'testimonial',
    poster: 'video-poster-testimonial.jpg',
    prompt: `Vertical 9:16 testimonial. Young woman facing camera holding ${PRODUCT} with both hands, smiling and speaking warmly about the fragrance, cozy living room, photorealistic premium ad quality.`,
  },
  {
    name: 'grwm',
    poster: 'video-poster-grwm.jpg',
    prompt: `Vertical 9:16 GRWM morning routine. Young woman at a vanity applying ${PRODUCT} as the finishing scent step, soft morning light, mirror in background, photorealistic beauty commercial.`,
  },
  {
    name: 'asmr',
    poster: 'video-poster-asmr.jpg',
    prompt: `Vertical 9:16 ASMR product close-up. Extreme close-up of a finger pressing the rose-gold nozzle of ${PRODUCT}, mist spraying, soft studio light, shallow depth of field, photorealistic luxury commercial.`,
  },
]

async function submit(prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/videos', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: MODEL,
      prompt,
      duration: 5,
      aspect_ratio: '9:16',
      resolution: '768p',
      generate_audio: true,
    }),
  })
  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Bad JSON (${res.status}): ${text.slice(0, 400)}`)
  }
  if (!res.ok) throw new Error(`submit ${res.status}: ${text.slice(0, 600)}`)
  return data
}

async function poll(jobId, pollingUrl) {
  const url = pollingUrl || `https://openrouter.ai/api/v1/videos/${jobId}`
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 12000))
    const res = await fetch(url, { headers: { Authorization: headers.Authorization } })
    const data = await res.json()
    console.log(' ', jobId, data.status)
    if (data.status === 'completed') return data
    if (data.status === 'failed' || data.status === 'cancelled' || data.status === 'expired') {
      throw new Error(`job ${data.status}: ${data.error || JSON.stringify(data)}`)
    }
  }
  throw new Error('poll timeout')
}

async function download(job, outPath) {
  const url =
    job.unsigned_urls?.[0] ||
    `https://openrouter.ai/api/v1/videos/${job.id}/content?index=0`
  const res = await fetch(url, { headers: { Authorization: headers.Authorization } })
  if (!res.ok) throw new Error(`download ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  fs.writeFileSync(outPath, buf)
}

async function extractPoster(videoPath, posterPath) {
  const ffmpegPath = (await import('ffmpeg-static')).default
  if (!ffmpegPath) return
  const { spawnSync } = await import('node:child_process')
  spawnSync(
    ffmpegPath,
    ['-y', '-ss', '1.2', '-i', videoPath, '-frames:v', '1', '-q:v', '3', posterPath],
    { encoding: 'utf8' },
  )
}

async function runOne(job) {
  console.log('submit', job.name)
  const started = await submit(job.prompt)
  const done = await poll(started.id, started.polling_url)
  const out = path.join(outDir, `${job.name}.mp4`)
  await download(done, out)
  await extractPoster(out, path.join(posterDir, job.poster))
  console.log('ok', job.name, fs.statSync(out).size)
}

const only = process.argv[2]
const list = only ? jobs.filter((j) => j.name === only) : jobs
for (const job of list) {
  try {
    await runOne(job)
  } catch (err) {
    console.error('fail', job.name, err.message || err)
  }
}
console.log('done')
