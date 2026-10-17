import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import fs from 'node:fs'
import path from 'node:path'

function loadServiceAccount(): {
  project_id?: string
  client_email?: string
  private_key?: string
} {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (json) {
    return JSON.parse(json) as {
      project_id?: string
      client_email?: string
      private_key?: string
    }
  }

  try {
    const filePath = path.join(process.cwd(), 'firebase-service-account.json')
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8')) as {
        project_id?: string
        client_email?: string
        private_key?: string
      }
    }
  } catch {
    /* ignore */
  }

  return {}
}

export function getAdminApp(): App {
  if (getApps().length) return getApps()[0]!

  const parsed = loadServiceAccount()
  if (parsed.project_id && parsed.client_email && parsed.private_key) {
    return initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replace(/\\n/g, '\n'),
      }),
    })
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (projectId && clientEmail && privateKey) {
    return initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    })
  }

  throw new Error('MISSING_SERVICE_ACCOUNT')
}

export async function verifyBearerToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return null
  try {
    return await getAuth(getAdminApp()).verifyIdToken(token)
  } catch {
    return null
  }
}
