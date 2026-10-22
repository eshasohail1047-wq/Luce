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

function status(key) {
  const v = (env[key] || '').trim()
  if (!v) return 'EMPTY'
  if (v.length < 8) return `SHORT(${v.length})`
  return `OK(len=${v.length})`
}

for (const k of [
  'MUSE_API_KEY',
  'MODEL_API_KEY',
  'MUSE_IMAGE_MODEL',
  'HEYGEN_API_KEY',
  'OPENROUTER_API_KEY',
  'OPENROUTER_IMAGE_MODEL',
  'OPENROUTER_VIDEO_MODEL',
]) {
  console.log(`${k}: ${status(k)}${k.includes('MODEL') && env[k] ? ` = ${env[k]}` : ''}`)
}
