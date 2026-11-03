import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import fs from 'node:fs'
import path from 'node:path'

type ServiceAccount = {
  project_id?: string
  client_email?: string
  private_key?: string
}

type DecodedLike = {
  uid: string
  email?: string
  emailVerified: boolean
  name?: string
}

function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, '\n')
}

function loadFromFile(): ServiceAccount | null {
  try {
    const filePath = path.join(process.cwd(), 'firebase-service-account.json')
    if (!fs.existsSync(filePath)) return null
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8')) as ServiceAccount
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return parsed
    }
  } catch (err) {
    console.error(
      '[firebaseAdmin] firebase-service-account.json parse failed',
      err instanceof Error ? err.message : err,
    )
  }
  return null
}

function loadFromEnvJson(): ServiceAccount | null {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ServiceAccount
    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return parsed
    }
    console.warn(
      '[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT_JSON missing required fields — ignoring',
    )
  } catch (err) {
    console.warn(
      '[firebaseAdmin] FIREBASE_SERVICE_ACCOUNT_JSON is invalid JSON. Using firebase-service-account.json instead.',
      err instanceof Error ? err.message : err,
    )
  }
  return null
}

function loadFromDiscreteEnv(): ServiceAccount | null {
  const projectId =
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.VITE_FIREBASE_PROJECT_ID?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim()
  if (projectId && clientEmail && privateKey) {
    return {
      project_id: projectId,
      client_email: clientEmail,
      private_key: privateKey,
    }
  }
  return null
}

/** Prefer local JSON file — Vite often corrupts multi-line JSON in .env.local. */
function loadServiceAccount(): ServiceAccount {
  return loadFromFile() || loadFromEnvJson() || loadFromDiscreteEnv() || {}
}

let cachedApp: App | null = null

export function getAdminApp(): App {
  if (cachedApp) return cachedApp
  if (getApps().length) {
    cachedApp = getApps()[0]!
    return cachedApp
  }

  const parsed = loadServiceAccount()
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      'MISSING_SERVICE_ACCOUNT: Add firebase-service-account.json to the project root.',
    )
  }

  cachedApp = initializeApp({
    credential: cert({
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key),
    }),
  })
  console.info(`[firebaseAdmin] initialized for project ${parsed.project_id}`)
  return cachedApp
}

export function getAdminDb() {
  return getFirestore(getAdminApp())
}

export async function verifyBearerToken(
  authHeader: string | undefined,
): Promise<DecodedLike | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null
  }
  const token = authHeader.slice('Bearer '.length).trim()
  if (!token) return null

  try {
    const decoded = await getAuth(getAdminApp()).verifyIdToken(token)
    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified === true,
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[firebaseAdmin] verifyIdToken failed:', message)

    return null
  }
}

export function authFailureMessage(
  authHeader: string | undefined,
  kind: 'images' | 'videos' = 'images',
): string {
  if (!authHeader?.startsWith('Bearer ') || !authHeader.slice(7).trim()) {
    return `Sign in required to generate ${kind}.`
  }
  return `Could not verify your session for ${kind}. Refresh, sign out and sign in again.`
}
