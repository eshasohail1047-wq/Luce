import fs from 'node:fs'
import { spawnSync } from 'node:child_process'

const text = fs.readFileSync('.env.local', 'utf8')
const keys = []

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
  if (!name.startsWith('VITE_') || !value) continue
  keys.push(name)

  for (const env of ['production', 'preview', 'development']) {
    const result = spawnSync(
      'npx',
      [
        'vercel',
        'env',
        'add',
        name,
        env,
        '--scope',
        'esha-s1',
        '--type',
        'config',
        '--force',
        '--yes',
        '--value',
        value,
      ],
      {
        encoding: 'utf8',
        shell: true,
      },
    )
    if (result.status !== 0) {
      console.error(`FAIL ${name} ${env}`)
      console.error(result.stderr || result.stdout)
      process.exit(1)
    }
  }
}

console.log(`Pushed: ${keys.join(', ')}`)
