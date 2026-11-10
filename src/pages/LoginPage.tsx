import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
} from 'firebase/auth'
import { useAuth } from '../auth/AuthProvider'
import Logo from '../Logo'
import { requireAuth } from '../lib/firebase'
import { loadOnboarding, stepPath } from '../lib/onboarding'
import { resolvePostLoginPath } from '../lib/postLogin'

type AuthMode = 'signin' | 'signup' | 'forgot' | 'forgot-sent' | 'forgot-google'

const REMEMBER_KEY = 'luce.auth.rememberEmail'

type AuthStoryBeat =
  | {
      id: string
      caption: string
      kind: 'image'
      src: string
    }
  | {
      id: string
      caption: string
      kind: 'upload'
      src: string
      hint: string
    }
  | {
      id: string
      caption: string
      kind: 'video'
      src: string
      poster: string
    }

/** Click product → give to LUCE → pro photo → pro video (looping story). */
const AUTH_STORY_BEATS: AuthStoryBeat[] = [
  {
    id: 'product',
    caption: '1 · Click your product photo',
    kind: 'image',
    // Plain white packshot — looks like a normal product upload
    src: '/images/fidelity-studio.jpg',
  },
  {
    id: 'upload',
    caption: '2 · Give it to LUCE',
    kind: 'upload',
    src: '/images/fidelity-studio.jpg',
    hint: 'Drop your product photo',
  },
  {
    id: 'photo',
    caption: '3 · Get professional photography',
    kind: 'image',
    // Same bottle, elevated lifestyle daylight shoot
    src: '/images/fidelity-daylight.jpg',
  },
  {
    id: 'video',
    caption: '4 · And perfume UGC video',
    kind: 'video',
    // Same rose-gold bottle family as the fidelity stills (not formats/ugc)
    src: '/videos/formats/unboxing.mp4',
    poster: '/images/video-poster-unbox.jpg',
  },
]

const AUTH_STORY_BEAT_MS = 2200
const AUTH_STORY_TAGLINE =
  'One product photo in. Studio images and video out.'

function GoogleMark() {
  return (
    <svg className="auth-google-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7 0-.7-.1-1.3-.2-1.9H12z"
      />
      <path
        fill="#34A853"
        d="M6.6 14.3l-.8.6-2.5 1.9C4.9 19.6 8.2 21.6 12 21.6c2.4 0 4.4-.8 5.9-2.1l-3.1-2.4c-.8.6-1.9.9-2.8.9-2.2 0-4-1.5-4.7-3.5z"
      />
      <path
        fill="#FBBC05"
        d="M3.3 7.2C2.5 8.8 2 10.3 2 12s.5 3.2 1.3 4.8l3.3-2.5c-.2-.6-.3-1.2-.3-2.3 0-.8.1-1.5.3-2.2L3.3 7.2z"
      />
      <path
        fill="#4285F4"
        d="M12 5.1c1.3 0 2.5.5 3.4 1.3l2.5-2.5C16.4 2.5 14.4 1.6 12 1.6 8.2 1.6 4.9 3.6 3.3 7.2l3.3 2.5C7.9 6.6 9.8 5.1 12 5.1z"
      />
    </svg>
  )
}

function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
        <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c5 0 9.27 3.11 11 7a10.6 10.6 0 0 1-1.73 2.82" />
      <path d="M6.61 6.61A13.5 13.5 0 0 0 1 12c1.73 3.89 6 7 11 7a10.4 10.4 0 0 0 5.39-1.61" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <path d="m2 2 20 20" />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg className="auth-alert-icon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  )
}

function AuthError({ message }: { message: string }) {
  return (
    <div className="auth-error" role="alert">
      <AlertIcon />
      <span>{message}</span>
    </div>
  )
}

function AuthStoryPanel({ compact = false }: { compact?: boolean }) {
  const [beat, setBeat] = useState(0)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const reduceMotion = useRef(false)

  useEffect(() => {
    reduceMotion.current =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion.current) return

    const id = window.setInterval(() => {
      setBeat((i) => (i + 1) % AUTH_STORY_BEATS.length)
    }, AUTH_STORY_BEAT_MS)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const active = AUTH_STORY_BEATS[beat]
    if (active.kind === 'video') {
      video.currentTime = 0
      void video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [beat])

  return (
    <aside
      className={
        compact
          ? 'auth-media auth-media--compact auth-story'
          : 'auth-media auth-story'
      }
      aria-label="How LUCE turns a product photo into studio photos and video"
    >
      <div className="auth-story-stage" aria-hidden="true">
        {AUTH_STORY_BEATS.map((slide, index) => {
          const active = index === beat
          if (slide.kind === 'video') {
            return (
              <div
                key={slide.id}
                className={
                  active
                    ? 'auth-story-slide auth-story-slide--active'
                    : 'auth-story-slide'
                }
              >
                <video
                  ref={videoRef}
                  className="auth-story-media"
                  src={slide.src}
                  poster={slide.poster}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              </div>
            )
          }

          if (slide.kind === 'upload') {
            return (
              <div
                key={slide.id}
                className={
                  active
                    ? 'auth-story-slide auth-story-slide--upload auth-story-slide--active'
                    : 'auth-story-slide auth-story-slide--upload'
                }
              >
                <div className="auth-story-upload">
                  <div className="auth-story-upload-frame">
                    <img
                      className="auth-story-upload-img"
                      src={slide.src}
                      alt=""
                      draggable={false}
                    />
                    <p className="auth-story-upload-hint">{slide.hint}</p>
                  </div>
                </div>
              </div>
            )
          }

          return (
            <div
              key={slide.id}
              className={
                active
                  ? 'auth-story-slide auth-story-slide--active'
                  : 'auth-story-slide'
              }
            >
              <img
                className="auth-story-media"
                src={slide.src}
                alt=""
                draggable={false}
              />
              {slide.id === 'product' ? (
                <span className="auth-story-pointer" aria-hidden="true" />
              ) : null}
            </div>
          )
        })}
      </div>

      <div className="auth-media-overlay" aria-hidden="true" />

      <div className="auth-story-ui">
        <p className="auth-story-caption" key={AUTH_STORY_BEATS[beat].id}>
          {AUTH_STORY_BEATS[beat].caption}
        </p>
        <div className="auth-story-dots" aria-hidden="true">
          {AUTH_STORY_BEATS.map((slide, index) => (
            <span
              key={slide.id}
              className={
                index === beat
                  ? 'auth-story-dot auth-story-dot--active'
                  : 'auth-story-dot'
              }
            />
          ))}
        </div>
        <p className="auth-media-tagline auth-story-tagline">
          {AUTH_STORY_TAGLINE}
        </p>
      </div>
    </aside>
  )
}

export default function LoginPage() {
  const {
    user,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    resetPassword,
    error,
    clearError,
  } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const destRef = useRef<string | null>(null)

  const initialMode: AuthMode =
    searchParams.get('mode') === 'signup' ? 'signup' : 'signin'

  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [authDest, setAuthDest] = useState<string | null>(null)

  async function resolveDestination(uid: string) {
    if (destRef.current) return destRef.current
    try {
      const onboarding = await loadOnboarding(uid)
      if (!onboarding.completed) {
        destRef.current = stepPath(onboarding.step || 'personal')
        return destRef.current
      }
    } catch {
      /* fall through */
    }
    destRef.current = resolvePostLoginPath()
    return destRef.current
  }

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [resetEmail, setResetEmail] = useState('')
  const [resetViaFirebase, setResetViaFirebase] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY)
      if (saved) {
        setEmail(saved)
        setRemember(true)
      }
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (loading || !user) {
        if (alive) setAuthDest(null)
        return
      }
      const next = await resolveDestination(user.uid)
      if (alive) setAuthDest(next)
    })()
    return () => {
      alive = false
    }
  }, [user, loading])

  if (!loading && user && authDest) {
    return <Navigate to={authDest} replace />
  }

  if (!loading && user && !authDest) {
    return (
      <div className="auth-page auth-page--loading">
        <p className="app-loading">Preparing your workspace…</p>
      </div>
    )
  }

  function switchMode(next: AuthMode) {
    setMode(next)
    setLocalError(null)
    clearError()
    if (next === 'forgot') {
      setResetEmail(email.trim())
    }
  }

  async function onGoogle() {
    setBusy(true)
    setLocalError(null)
    clearError()
    try {
      await signInWithGoogle()
      const started = Date.now()
      while (Date.now() - started < 3000) {
        const current = requireAuth().currentUser
        if (current) {
          navigate(await resolveDestination(current.uid), { replace: true })
          return
        }
        await new Promise((r) => setTimeout(r, 40))
      }
    } catch (err) {
      console.error('[login] google failed', err)
      setLocalError(
        err instanceof Error ? err.message : 'Google sign-in failed. Try again.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function onForgotSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setLocalError(null)
    clearError()

    const target = resetEmail.trim()
    if (!target) {
      setLocalError('Enter the email for your account.')
      setBusy(false)
      return
    }

    try {
      const result = await resetPassword(target)
      setEmail(target)
      setResetViaFirebase(
        result.reason === 'firebase-fallback' || result.reason === 'methods-unknown',
      )
      setMode(result.sent ? 'forgot-sent' : 'forgot-google')
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Could not send reset email.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function onResendReset() {
    setBusy(true)
    setLocalError(null)
    clearError()
    try {
      const result = await resetPassword(resetEmail.trim() || email.trim())
      setResetViaFirebase(
        result.reason === 'firebase-fallback' || result.reason === 'methods-unknown',
      )
      if (!result.sent) {
        setMode('forgot-google')
      }
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Could not resend reset email.',
      )
    } finally {
      setBusy(false)
    }
  }

  async function onEmailSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setLocalError(null)
    clearError()

    try {
      if (mode === 'signup') {
        if (!name.trim()) {
          setLocalError('Enter your full name.')
          return
        }
        if (password.length < 6) {
          setLocalError('Password should be at least 6 characters.')
          return
        }
        await signUpWithEmail({
          name: name.trim(),
          email: email.trim(),
          password,
        })
      } else {
        await setPersistence(
          requireAuth(),
          remember ? browserLocalPersistence : browserSessionPersistence,
        )
        await signInWithEmail(email.trim(), password)
        try {
          if (remember) localStorage.setItem(REMEMBER_KEY, email.trim())
          else localStorage.removeItem(REMEMBER_KEY)
        } catch {
          /* ignore */
        }
      }
      const current = requireAuth().currentUser
      if (current) {
        navigate(await resolveDestination(current.uid), { replace: true })
      }
    } catch (err) {
      console.error('[login] email auth failed', err)
      setLocalError(
        err instanceof Error ? err.message : 'Email sign-in failed.',
      )
    } finally {
      setBusy(false)
    }
  }

  const shownError = localError || error
  const isSignup = mode === 'signup'
  const isForgot = mode === 'forgot'
  const isForgotSent = mode === 'forgot-sent'
  const isForgotGoogle = mode === 'forgot-google'
  const sentTo = resetEmail.trim() || email.trim()
  const canSubmit =
    !busy &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    (!isSignup || name.trim().length > 0)

  const title = isSignup
    ? 'Create account'
    : isForgot
      ? 'Forgot your password?'
      : isForgotSent
        ? resetViaFirebase
          ? 'Email may not arrive'
          : 'Check your inbox'
        : isForgotGoogle
          ? 'Use Google to sign in'
          : 'Welcome back'

  return (
    <div className="auth-page">
      <div className="auth-split">
        <section className="auth-panel" aria-labelledby="login-title">
          <AuthStoryPanel compact />

          <div className="auth-panel-inner">
            <Link to="/" className="auth-wordmark" aria-label="LUCE home">
              <Logo href={null} />
            </Link>

            <header className="auth-header">
              <h1 id="login-title" className="auth-title">
                {title}
              </h1>
            </header>

            {isForgotGoogle ? (
              <>
                <p className="auth-lead">
                  <strong className="auth-sent-email">{sentTo}</strong> was created
                  with Google, so a password reset email is not available. Sign in
                  with Google instead.
                </p>

                {shownError && <AuthError message={shownError} />}

                <button
                  type="button"
                  className="auth-google-btn"
                  onClick={onGoogle}
                  disabled={busy}
                >
                  <GoogleMark />
                  <span>{busy ? 'Connecting…' : 'Sign in with Google'}</span>
                </button>

                <p className="auth-footer">
                  <button type="button" onClick={() => switchMode('signin')} disabled={busy}>
                    Back to sign in
                  </button>
                </p>
              </>
            ) : isForgotSent ? (
              <>
                <p className="auth-lead">
                  {resetViaFirebase ? (
                    <>
                      LUCE asked Firebase to email{' '}
                      <strong className="auth-sent-email">{sentTo}</strong>, but
                      Firebase&apos;s built-in mail often never reaches Gmail. Add a
                      Resend API key + Firebase service account in{' '}
                      <code>.env.local</code>, then run <code>npm run dev:full</code>.
                    </>
                  ) : (
                    <>
                      If an account exists for{' '}
                      <strong className="auth-sent-email">{sentTo}</strong>, a reset
                      link is on its way. Check inbox and spam.
                    </>
                  )}
                </p>

                {shownError && <AuthError message={shownError} />}

                <button
                  type="button"
                  className="auth-submit"
                  onClick={() => switchMode('signin')}
                  disabled={busy}
                >
                  Back to sign in
                </button>

                <p className="auth-footer">
                  Didn&apos;t get it?{' '}
                  <button type="button" onClick={onResendReset} disabled={busy}>
                    {busy ? 'Sending…' : 'Resend email'}
                  </button>
                </p>
              </>
            ) : isForgot ? (
              <>
                <p className="auth-lead">
                  Enter your email and we&apos;ll send a link to reset your password.
                </p>

                <form className="auth-form" onSubmit={onForgotSubmit}>
                  <div className="auth-field">
                    <label htmlFor="auth-reset-email">Email</label>
                    <input
                      id="auth-reset-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={busy}
                      autoFocus
                    />
                  </div>

                  {shownError && <AuthError message={shownError} />}

                  <button
                    type="submit"
                    className="auth-submit"
                    disabled={busy || !resetEmail.trim()}
                  >
                    {busy ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>

                <p className="auth-footer">
                  <button type="button" onClick={() => switchMode('signin')} disabled={busy}>
                    Back to sign in
                  </button>
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="auth-google-btn"
                  onClick={onGoogle}
                  disabled={busy}
                >
                  <GoogleMark />
                  <span>
                    {isSignup ? 'Sign up with Google' : 'Sign in with Google'}
                  </span>
                </button>

                <div className="auth-or" role="separator">
                  <span>or</span>
                </div>

                <form className="auth-form" onSubmit={onEmailSubmit}>
                  {isSignup && (
                    <div className="auth-field">
                      <label htmlFor="auth-name">Full name</label>
                      <input
                        id="auth-name"
                        name="name"
                        type="text"
                        required
                        autoComplete="name"
                        placeholder="Jane Smith"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={busy}
                        autoFocus
                      />
                    </div>
                  )}

                  <div className="auth-field">
                    <label htmlFor="auth-email">Email</label>
                    <input
                      id="auth-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={busy}
                      autoFocus={!isSignup}
                    />
                  </div>

                  <div className="auth-field">
                    <div className="auth-label-row">
                      <label htmlFor="auth-password">Password</label>
                      {!isSignup && (
                        <button
                          type="button"
                          className="auth-forgot"
                          onClick={() => switchMode('forgot')}
                          disabled={busy}
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <div className="auth-password-wrap">
                      <input
                        id="auth-password"
                        name="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete={isSignup ? 'new-password' : 'current-password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={busy}
                      />
                      <button
                        type="button"
                        className="auth-eye"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <EyeIcon open={showPassword} />
                      </button>
                    </div>
                  </div>

                  {!isSignup && (
                    <label className="auth-remember">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        disabled={busy}
                      />
                      <span>Keep me signed in</span>
                    </label>
                  )}

                  {shownError && <AuthError message={shownError} />}

                  <button
                    type="submit"
                    className="auth-submit"
                    disabled={!canSubmit}
                  >
                    {busy
                      ? isSignup
                        ? 'Creating…'
                        : 'Signing in…'
                      : isSignup
                        ? 'Sign up'
                        : 'Sign in'}
                  </button>
                </form>

                {isSignup && (
                  <p className="auth-legal">
                    By creating an account you agree to our{' '}
                    <Link to="/terms">Terms of Service</Link> and{' '}
                    <Link to="/privacy">Privacy Policy</Link>.
                  </p>
                )}

                <p className="auth-footer">
                  {isSignup ? (
                    <>
                      Already have an account?{' '}
                      <button type="button" onClick={() => switchMode('signin')} disabled={busy}>
                        Sign in
                      </button>
                    </>
                  ) : (
                    <>
                      Don&apos;t have an account?{' '}
                      <button type="button" onClick={() => switchMode('signup')} disabled={busy}>
                        Sign up
                      </button>
                    </>
                  )}
                </p>
              </>
            )}
          </div>
        </section>

        <AuthStoryPanel />
      </div>
    </div>
  )
}
