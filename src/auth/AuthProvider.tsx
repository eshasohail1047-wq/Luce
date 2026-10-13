import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import {
  firebaseConfigured,
  googleProvider,
  requireAuth,
  requireDb,
} from '../lib/firebase'
import { requestPasswordReset } from '../lib/resetPassword'

type AuthContextValue = {
  user: User | null
  loading: boolean
  error: string | null
  signInWithGoogle: () => Promise<void>
  signInWithGoogleRedirect: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (input: {
    name: string
    email: string
    password: string
  }) => Promise<void>
  resetPassword: (
    email: string,
  ) => Promise<{ sent: boolean; googleOnly: boolean; reason?: string }>
  signOut: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function formatAuthError(err: unknown): string {
  const code =
    typeof err === 'object' && err && 'code' in err
      ? String((err as { code?: string }).code ?? '')
      : ''
  const message = err instanceof Error ? err.message : 'Sign-in failed'

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase. Enable Google and Email/Password under Authentication → Sign-in method.'
    case 'auth/unauthorized-domain': {
      const host =
        typeof window !== 'undefined' && window.location?.hostname
          ? window.location.hostname
          : 'this domain'
      return `This domain is not authorized for Firebase Auth. In Firebase Console → Authentication → Settings → Authorized domains, add “${host}”, then try again.`
    }
    case 'auth/popup-blocked':
      return 'Popup was blocked by the browser. Allow popups, or use redirect sign-in.'
    case 'auth/popup-closed-by-user':
      return 'Sign-in popup was closed before finishing. Try again.'
    case 'auth/cancelled-popup-request':
      return 'Another sign-in popup was already open. Close it and try again.'
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection and try again.'
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Sign in instead.'
    case 'auth/invalid-email':
      return 'Enter a valid email address.'
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.'
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email or password. If you usually use Google, click Continue with Google — or use Forgot Password to set an email password first.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.'
    default:
      return code ? `${message} (${code})` : message
  }
}

async function explainEmailSignInFailure(email: string, err: unknown): Promise<string> {
  const code =
    typeof err === 'object' && err && 'code' in err
      ? String((err as { code?: string }).code ?? '')
      : ''

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found'
  ) {
    try {
      const methods = await fetchSignInMethodsForEmail(requireAuth(), email.trim())
      if (methods.includes('google.com') && !methods.includes('password')) {
        return 'This email is registered with Google only. Use Continue with Google, or click Forgot Password to add an email password.'
      }
      if (methods.length === 0) {
        return 'No password is set for this email yet. Use Continue with Google, or Sign Up / Forgot Password to create one.'
      }
    } catch {
      /* email enumeration protection may block this — fall through */
    }
  }

  return formatAuthError(err)
}

function detectProvider(user: User): 'google' | 'password' {
  const ids = user.providerData.map((p) => p.providerId)
  if (ids.includes('google.com')) return 'google'
  return 'password'
}

async function ensureUserDocument(user: User) {
  const ref = doc(requireDb(), 'users', user.uid)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await setDoc(
      ref,
      {
        email: user.email ?? '',
        displayName: user.displayName ?? '',
        photoURL: user.photoURL ?? '',
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
    return
  }

  await setDoc(ref, {
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    photoURL: user.photoURL ?? '',
    plan: 'free',
    authProvider: detectProvider(user),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

async function syncProfile(user: User) {
  try {
    await ensureUserDocument(user)
  } catch (syncErr) {
    console.error('[auth] profile sync failed', syncErr)
    const code =
      typeof syncErr === 'object' && syncErr && 'code' in syncErr
        ? String((syncErr as { code?: string }).code ?? '')
        : ''
    if (code === 'permission-denied' || code === 'firestore/permission-denied') {
      throw new Error(
        'Signed in, but profile could not be saved. Open Firebase → Firestore → Rules, paste firestore.rules from this project, and click Publish.',
      )
    }
    throw new Error(
      code
        ? `Signed in, but profile could not be saved (${code}). Check Firestore is created and rules are published.`
        : 'Signed in, but profile could not be saved. Check Firestore is created and rules are published.',
    )
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const safety = window.setTimeout(() => {
      if (active) setLoading(false)
    }, 4000)

    if (!firebaseConfigured) {
      setLoading(false)
      window.clearTimeout(safety)
      setError(
        'Firebase is not configured on this deployment. Add VITE_FIREBASE_* env vars in Vercel and redeploy.',
      )
      return () => {
        active = false
        window.clearTimeout(safety)
      }
    }

    const auth = requireAuth()

    ;(async () => {
      try {
        const redirect = await getRedirectResult(auth)
        if (redirect?.user) {
          try {
            await ensureUserDocument(redirect.user)
          } catch (syncErr) {
            console.error('[auth] profile sync failed after redirect', syncErr)
            if (active) {
              setError(
                'Signed in, but profile could not be saved. Open Firebase → Firestore → Rules, paste firestore.rules, and click Publish.',
              )
            }
          }
        }
      } catch (err) {
        console.error('[auth] redirect result failed', err)
        if (active) setError(formatAuthError(err))
      }
    })()

    const unsub = onAuthStateChanged(auth, async (next) => {
      if (!active) return
      setUser(next)
      setLoading(false)
      window.clearTimeout(safety)
      if (next) {
        try {
          await ensureUserDocument(next)
        } catch (err) {
          console.error('[auth] failed to sync user doc', err)
        }
      }
    })

    return () => {
      active = false
      window.clearTimeout(safety)
      unsub()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      clearError: () => setError(null),
      async signInWithGoogle() {
        setError(null)
        const auth = requireAuth()
        const preferRedirect =
          typeof window !== 'undefined' &&
          (window.location.hostname.endsWith('.vercel.app') ||
            window.location.hostname === 'luce-landing.vercel.app')

        // Production Vercel: redirect is more reliable than popups (blockers / 3P cookies).
        if (preferRedirect) {
          await signInWithRedirect(auth, googleProvider)
          return
        }

        try {
          const result = await signInWithPopup(auth, googleProvider)
          await syncProfile(result.user)
        } catch (err) {
          const message = formatAuthError(err)
          setError(message)
          const code =
            typeof err === 'object' && err && 'code' in err
              ? String((err as { code?: string }).code ?? '')
              : ''
          if (code === 'auth/popup-blocked') {
            await signInWithRedirect(auth, googleProvider)
            return
          }
          throw new Error(message)
        }
      },
      async signInWithGoogleRedirect() {
        setError(null)
        await signInWithRedirect(requireAuth(), googleProvider)
      },
      async signInWithEmail(email, password) {
        setError(null)
        try {
          const result = await signInWithEmailAndPassword(
            requireAuth(),
            email.trim(),
            password,
          )
          await syncProfile(result.user)
        } catch (err) {
          const message = await explainEmailSignInFailure(email, err)
          setError(message)
          throw new Error(message)
        }
      },
      async signUpWithEmail({ name, email, password }) {
        setError(null)
        try {
          const result = await createUserWithEmailAndPassword(
            requireAuth(),
            email.trim(),
            password,
          )
          if (name.trim()) {
            await updateProfile(result.user, { displayName: name.trim() })
          }
          await syncProfile(result.user)
        } catch (err) {
          const message = formatAuthError(err)
          setError(message)
          throw new Error(message)
        }
      },
      async resetPassword(email) {
        setError(null)
        const trimmed = email.trim()
        const auth = requireAuth()

        // 1) Prefer Resend API (reliable inbox delivery for Sign Up accounts)
        const apiResult = await requestPasswordReset(trimmed)
        if (apiResult.ok) {
          return {
            sent: true,
            googleOnly: Boolean(apiResult.googleOnly),
            reason: apiResult.via,
          }
        }
        if (apiResult.googleOnly) {
          return {
            sent: false,
            googleOnly: true,
            reason: 'google-only',
          }
        }
        if (apiResult.error !== '__FALLBACK_FIREBASE__') {
          // API ran but failed with a real message
          if (!apiResult.error.includes('not configured')) {
            setError(apiResult.error)
            throw new Error(apiResult.error)
          }
          console.warn('[auth] reset API unavailable, falling back to Firebase mail', apiResult.error)
        }

        // 2) Fallback: Firebase built-in email (often lands in Spam / may not arrive)
        let methods: string[] = []
        try {
          methods = await fetchSignInMethodsForEmail(auth, trimmed)
        } catch {
          /* enumeration protection may block this */
        }

        const hasPassword = methods.includes('password')
        const hasGoogle = methods.includes('google.com')
        const googleOnly = hasGoogle && !hasPassword

        if (googleOnly) {
          return { sent: false, googleOnly: true, reason: 'google-only' }
        }

        try {
          await sendPasswordResetEmail(auth, trimmed, {
            url: `${window.location.origin}/login`,
            handleCodeInApp: false,
          })
          return {
            sent: true,
            googleOnly: hasGoogle || methods.length === 0,
            reason: 'firebase-fallback',
          }
        } catch (err) {
          const code =
            typeof err === 'object' && err && 'code' in err
              ? String((err as { code?: string }).code ?? '')
              : ''
          console.error('[auth] reset password failed', code, err)
          if (code === 'auth/user-not-found') {
            throw new Error(
              'No account found with this email. Sign up first, or use Continue with Google.',
            )
          }
          if (code === 'auth/operation-not-allowed') {
            throw new Error(
              'Email/password sign-in is not enabled in Firebase. Enable it under Authentication → Sign-in method.',
            )
          }
          if (hasGoogle || methods.length === 0) {
            return { sent: false, googleOnly: true, reason: 'google-fallback' }
          }
          const message = formatAuthError(err)
          setError(message)
          throw new Error(message)
        }
      },
      async signOut() {
        setError(null)
        await firebaseSignOut(requireAuth())
      },
    }),
    [user, loading, error],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
