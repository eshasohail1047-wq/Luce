/**
 * Copy real live-action creator clips into vertical format demos.
 * No Ken Burns / photo slideshows — source files are camera footage only.
 */
import ffmpegPath from 'ffmpeg-static'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const srcDir = path.join(root, 'public/videos')
const outDir = path.join(root, 'public/videos/formats')
const posterDir = path.join(root, 'public/images')
fs.mkdirSync(outDir, { recursive: true })

if (!ffmpegPath) {
  console.error('ffmpeg-static missing')
  process.exit(1)
}

function run(args) {
  const r = spawnSync(ffmpegPath, args, { encoding: 'utf8' })
  if (r.status !== 0) {
    console.error(r.stderr?.slice(-2000))
    throw new Error('ffmpeg failed')
  }
}

/**
 * Normalize to muted vertical 720x1280 H.264, trim to ~7s from a useful start.
 */
function makeClip({ name, source, start = 0, duration = 7, posterAt = 0.6, poster }) {
  const input = path.join(srcDir, source)
  if (!fs.existsSync(input)) throw new Error(`missing ${input}`)

  const out = path.join(outDir, `${name}.mp4`)
  const vf =
    `scale=720:1280:force_original_aspect_ratio=increase,` +
    `crop=720:1280,` +
    `setsar=1,` +
    `format=yuv420p`

  run([
    '-y',
    '-ss',
    String(start),
    '-i',
    input,
    '-t',
    String(duration),
    '-vf',
    vf,
    '-an',
    '-c:v',
    'libx264',
    '-preset',
    'fast',
    '-crf',
    '22',
    '-movflags',
    '+faststart',
    out,
  ])

  const posterPath = path.join(posterDir, poster)
  run([
    '-y',
    '-ss',
    String(start + posterAt),
    '-i',
    input,
    '-frames:v',
    '1',
    '-vf',
    'scale=720:-2',
    '-q:v',
    '3',
    posterPath,
  ])

  console.log('ok', name, '←', source, fs.statSync(out).size)
}

const jobs = [
  // Creator at a table with products — talking / reviewing on camera
  {
    name: 'table-talk',
    source: 'creator-5.mp4',
    start: 0.5,
    duration: 7,
    poster: 'video-poster-table-talk.jpg',
  },
  // Person properly applying product on face
  {
    name: 'howto',
    source: 'creator-1.mp4',
    start: 0.3,
    duration: 7,
    poster: 'video-poster-howto.jpg',
  },
  // Hands revealing perfume + packaging on shelf (product unveil)
  {
    name: 'unboxing',
    source: 'perfume-2.mp4',
    start: 0.4,
    duration: 7,
    poster: 'video-poster-unbox.jpg',
  },
  // Classic ring-light UGC creator filming product use
  {
    name: 'ugc',
    source: 'ugc-skincare-ringlight.mp4',
    start: 1.0,
    duration: 7,
    poster: 'video-poster-ugc.jpg',
  },
  // Close-up product interaction / spray hero motion
  {
    name: 'spin',
    source: 'perfume-4.mp4',
    start: 0.2,
    duration: 6,
    poster: 'video-poster-spin.jpg',
  },
  // Creator facing camera while using / reviewing product
  {
    name: 'testimonial',
    source: 'creator-2.mp4',
    start: 0.4,
    duration: 7,
    poster: 'video-poster-testimonial.jpg',
  },
]

for (const job of jobs) makeClip(job)
console.log('done')
