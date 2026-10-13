/**
 * Pushes server-side secrets needed by /api/reset-password to Vercel.
 * Uses stdin for values so spaces / <email> / JSON work on Windows.
 */
import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

function loadEnvLocal() {
  const text = fs.readFileSync('.env.local', 'utf8')
  const env = {}
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || !line.includes('=')) continue
    const i = line.indexOf('=')
    const name = line.slice(0, i).trim()
    let value = line.slice(i + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    env[name] = value
  }
  return env
}

const env = loadEnvLocal()
const pairs = [
  ['RESEND_API_KEY', env.RESEND_API_KEY],
  ['RESEND_FROM', env.RESEND_FROM],
  ['FIREBASE_SERVICE_ACCOUNT_JSON', env.FIREBASE_SERVICE_ACCOUNT_JSON],
  [
    'PASSWORD_RESET_CONTINUE_URL',
    !env.PASSWORD_RESET_CONTINUE_URL || env.PASSWORD_RESET_CONTINUE_URL.includes('localhost')
      ? 'https://luce-landing.vercel.app/login'
      : env.PASSWORD_RESET_CONTINUE_URL,
  ],
]

const missing = pairs.filter(([, v]) => !v).map(([k]) => k)
if (missing.length) {
  console.error(`Missing in .env.local: ${missing.join(', ')}`)
  process.exit(1)
}

const pushed = []
for (const [name, value] of pairs) {
  for (const target of ['production', 'preview']) {
    const result = spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      [
        'vercel',
        'env',
        'add',
        name,
        target,
        '--scope',
        'esha-s1',
        '--type',
        'secret',
        '--force',
        '--yes',
      ],
      {
        input: value,
        encoding: 'utf8',
        shell: false,
      },
    )
    if (result.status !== 0) {
      console.error(`FAIL ${name} ${target}`)
      console.error(result.stderr || result.stdout)
      process.exit(1)
    }
  }
  pushed.push(name)
}

console.log(`Pushed secrets: ${pushed.join(', ')}`)
