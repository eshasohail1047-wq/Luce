/**
 * Adds luce-landing.vercel.app to Firebase Auth authorized domains
 * using FIREBASE_SERVICE_ACCOUNT_JSON from .env.local
 */
import fs from 'node:fs'
import { GoogleAuth } from 'google-auth-library'

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

const DOMAIN = 'luce-landing.vercel.app'
const env = loadEnvLocal()
const saRaw = env.FIREBASE_SERVICE_ACCOUNT_JSON
if (!saRaw) {
  console.error('Missing FIREBASE_SERVICE_ACCOUNT_JSON in .env.local')
  process.exit(1)
}

const sa = JSON.parse(saRaw)
const projectId = sa.project_id || env.FIREBASE_PROJECT_ID || 'luce-ee1cb'

const auth = new GoogleAuth({
  credentials: sa,
  scopes: ['https://www.googleapis.com/auth/identitytoolkit', 'https://www.googleapis.com/auth/cloud-platform'],
})

const client = await auth.getClient()
const token = await client.getAccessToken()
const headers = {
  Authorization: `Bearer ${token.token}`,
  'Content-Type': 'application/json',
}

const getUrl = `https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config`
const getRes = await fetch(getUrl, { headers })
if (!getRes.ok) {
  console.error('Failed to read Auth config', getRes.status, await getRes.text())
  process.exit(1)
}

const config = await getRes.json()
const domains = Array.isArray(config.authorizedDomains) ? [...config.authorizedDomains] : []
if (domains.includes(DOMAIN)) {
  console.log(`Already authorized: ${DOMAIN}`)
  console.log(`Current domains: ${domains.join(', ')}`)
  process.exit(0)
}

domains.push(DOMAIN)
const patchRes = await fetch(`${getUrl}?updateMask=authorizedDomains`, {
  method: 'PATCH',
  headers,
  body: JSON.stringify({ authorizedDomains: domains }),
})

if (!patchRes.ok) {
  console.error('Failed to update Auth config', patchRes.status, await patchRes.text())
  process.exit(1)
}

const updated = await patchRes.json()
console.log(`Added: ${DOMAIN}`)
console.log(`Authorized domains: ${(updated.authorizedDomains || domains).join(', ')}`)
