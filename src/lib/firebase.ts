import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getStorage, type FirebaseStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
}

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_APP_ID',
] as const

const missing = required.filter((key) => !import.meta.env[key])

export const firebaseConfigured = missing.length === 0

if (!firebaseConfigured && typeof console !== 'undefined') {
  console.warn(
    `[LUCE] Missing Firebase env: ${missing.join(', ')}. Landing will load; auth needs these in Vercel.`,
  )
}

let firebaseApp: FirebaseApp | null = null
let auth: Auth | null = null
let db: Firestore | null = null
let storage: FirebaseStorage | null = null

if (firebaseConfigured) {
  firebaseApp = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig)
  auth = getAuth(firebaseApp)
  db = getFirestore(firebaseApp)
  storage = getStorage(firebaseApp)
}

export { firebaseApp, auth, db, storage }

export function requireAuth(): Auth {
  if (!auth) {
    throw new Error(
      'Firebase Auth is not configured. Add VITE_FIREBASE_* to .env.local (local) or Vercel env (deploy), then restart the app.',
    )
  }
  return auth
}

export function requireDb(): Firestore {
  if (!db) {
    throw new Error(
      'Firestore is not configured. Add VITE_FIREBASE_* env vars in Vercel and redeploy.',
    )
  }
  return db
}

export function requireStorage(): FirebaseStorage {
  if (!storage) {
    throw new Error(
      'Firebase Storage is not configured. Add VITE_FIREBASE_* env vars in Vercel and redeploy.',
    )
  }
  return storage
}

export const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('email')
googleProvider.addScope('profile')
googleProvider.setCustomParameters({ prompt: 'select_account' })
