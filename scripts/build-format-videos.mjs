/**
 * Build unique vertical demo clips for every Video Studio format.
 * Free local assets only — paid video gen is reserved for users.
 */
import ffmpegPath from 'ffmpeg-static'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const srcDir = path.join(root, 'public/videos')
const outDir = path.join(root, 'public/videos/formats')
fs.mkdirSync(outDir, { recursive: true })

if (!ffmpegPath) {
  console.error('ffmpeg-static missing')
  process.exit(1)
}

function run(args) {
  const r = spawnSync(ffmpegPath, args, { encoding: 'utf8' })
  if (r.status !== 0) {
    console.error(r.stderr?.slice(-1800))
    throw new Error(`ffmpeg failed: ${args.slice(0, 6).join(' ')}`)
  }
}

function makeClip({ name, source, start = 0.3, duration = 6 }) {
  const input = path.join(srcDir, source)
  if (!fs.existsSync(input)) throw new Error(`missing ${input}`)
  const out = path.join(outDir, `${name}.mp4`)
  const vf =
    `scale=720:1280:force_original_aspect_ratio=increase,` +
    `crop=720:1280,setsar=1,fps=24,format=yuv420p`

  run([
    '-y',
    '-ss',
    String(start),
    '-t',
    String(duration),
    '-i',
    input,
    '-vf',
    vf,
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '20',
    '-movflags',
    '+faststart',
    out,
  ])
  console.log('ok', name, '←', source, fs.statSync(out).size)
}

/** Keep table-talk if it already has voice; otherwise rebuild silent from creator-5 */
function ensureTableTalk() {
  const out = path.join(outDir, 'table-talk.mp4')
  const voice = path.join(srcDir, '_voice/table-talk.wav')
  if (fs.existsSync(out) && fs.existsSync(voice) && fs.statSync(out).size > 1_500_000) {
    console.log('keep table-talk (with voice)')
    return
  }
  if (fs.existsSync(voice)) {
    const vf =
      `scale=720:1280:force_original_aspect_ratio=increase,` +
      `crop=720:1280,setsar=1,fps=24,format=yuv420p`
    run([
      '-y',
      '-ss',
      '0.4',
      '-t',
      '13.2',
      '-i',
      path.join(srcDir, 'creator-5.mp4'),
      '-i',
      voice,
      '-vf',
      vf,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '20',
      '-c:a',
      'aac',
      '-b:a',
      '160k',
      '-shortest',
      '-movflags',
      '+faststart',
      out,
    ])
    console.log('ok table-talk + voice', fs.statSync(out).size)
    return
  }
  makeClip({ name: 'table-talk', source: 'creator-5.mp4', start: 0.4, duration: 7 })
}

ensureTableTalk()

const jobs = [
  { name: 'howto', source: 'creator-1.mp4', start: 0.3, duration: 6.5 },
  { name: 'unboxing', source: 'perfume-2.mp4', start: 0.5, duration: 6.5 },
  { name: 'ugc', source: 'ugc-skincare-ringlight.mp4', start: 0.8, duration: 6.5 },
  { name: 'spin', source: 'perfume-4.mp4', start: 0.2, duration: 6 },
  { name: 'testimonial', source: 'creator-2.mp4', start: 0.4, duration: 6.5 },
  { name: 'grwm', source: 'creator-3.mp4', start: 0.5, duration: 6.5 },
  { name: 'asmr', source: 'perfume-4.mp4', start: 1.2, duration: 5.5 },
  { name: 'hook', source: 'creator-4.mp4', start: 0.6, duration: 6.5 },
  { name: 'mirror', source: 'ugc-makeup-blush.mp4', start: 0.5, duration: 6.5 },
  { name: 'flatlay', source: 'perfume-3.mp4', start: 0.4, duration: 6.5 },
  { name: 'winner', source: 'perfume-5.mp4', start: 0.8, duration: 6.5 },
]

for (const job of jobs) makeClip(job)
console.log('done', jobs.length + 1, 'format clips')
