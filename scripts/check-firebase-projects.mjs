import fs from 'node:fs'

const sa = JSON.parse(fs.readFileSync('firebase-service-account.json', 'utf8'))
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

console.log('serviceAccount.project_id:', sa.project_id || 'NONE')
console.log(
  'VITE_FIREBASE_PROJECT_ID:',
  env.VITE_FIREBASE_PROJECT_ID || 'NONE',
)
console.log(
  'projects match:',
  sa.project_id === env.VITE_FIREBASE_PROJECT_ID,
)
console.log(
  'client email present:',
  Boolean(sa.client_email),
)
console.log('private_key present:', Boolean(sa.private_key))
