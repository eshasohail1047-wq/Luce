import { cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
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

function expectedProjectId(): string | undefined {
  return (
    loadServiceAccount().project_id ||
    process.env.VITE_FIREBASE_PROJECT_ID?.trim() ||
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    undefined
  )
}

/**
 * Local-only: decode Firebase ID token payload without Admin verify.
 * Used when Admin SDK init/verify is broken so image/video gen can still run.
 */
function decodeIdTokenLocally(token: string): DecodedLike | null {
  try {
    const parts = token.split('.')
    if (parts.length < 2) return null
    const payloadJson = Buffer.from(
      parts[1]!.replace(/-/g, '+').replace(/_/g, '/'),
      'base64',
    ).toString('utf8')
    const payload = JSON.parse(payloadJson) as {
      sub?: string
      user_id?: string
      email?: string
      name?: string
      exp?: number
      aud?: string
      iss?: string
    }
    const uid = (payload.user_id || payload.sub || '').trim()
    if (!uid) return null
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
      console.warn('[firebaseAdmin] local decode: token expired')
      return null
    }
    const project = expectedProjectId()
    if (project) {
      const audOk = !payload.aud || payload.aud === project
      const issOk =
        !payload.iss ||
        payload.iss.includes(project) ||
        payload.iss.includes('securetoken.google.com')
      if (!audOk && !issOk) {
        console.warn(
          '[firebaseAdmin] local decode: token project mismatch',
          payload.aud,
          payload.iss,
        )
        return null
      }
    }
    return {
      uid,
      email: payload.email,
      name: payload.name,
    }
  } catch (err) {
    console.warn(
      '[firebaseAdmin] local decode failed',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

function allowLocalAuthFallback(): boolean {
  if (process.env.LUCE_DEV_RELAXED_AUTH === '0') return false
  if (process.env.LUCE_DEV_RELAXED_AUTH === '1') return true
  // Default on for Vite local (no VERCEL / NODE_ENV=production)
  return process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production'
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
      name: typeof decoded.name === 'string' ? decoded.name : undefined,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[firebaseAdmin] verifyIdToken failed:', message)

    if (allowLocalAuthFallback()) {
      const local = decodeIdTokenLocally(token)
      if (local) {
        console.warn(
          '[firebaseAdmin] using local JWT decode fallback for uid',
          local.uid,
        )
        return local
      }
    }
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
