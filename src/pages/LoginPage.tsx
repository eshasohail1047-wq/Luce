import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import Logo from '../Logo'
import { useAuth } from '../auth/AuthProvider'

type AuthMode = 'signin' | 'signup' | 'forgot' | 'forgot-sent' | 'forgot-google'

const REMEMBER_KEY = 'luce.auth.rememberEmail'

function postLoginPath() {
  try {
    const next = sessionStorage.getItem('luce.postLoginPath')
    if (next === '/app/campaigns/new' || next === '/app') {
      sessionStorage.removeItem('luce.postLoginPath')
      return next
    }
    if (sessionStorage.getItem('luce.pendingProductUrl')) {
      return '/app/campaigns/new'
    }
  } catch {
    /* ignore */
  }
  return '/app'
}

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
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 5c-5 0-9.3 3.1-11 7 1.7 3.9 6 7 11 7s9.3-3.1 11-7c-1.7-3.9-6-7-11-7zm0 12a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z"
        />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M3.3 2.3 2 3.6l3.1 3.1C3.3 8 1.7 9.8 1 12c1.7 3.9 6 7 11 7 1.8 0 3.5-.4 5-1.1l3.4 3.4 1.3-1.3L3.3 2.3zM12 17c-3.9 0-7.2-2.2-9-5 .7-1.2 1.8-2.4 3.2-3.3l1.8 1.8A5 5 0 0 0 12 17zm9.9-1.9-2.2-2.2c.2-.3.3-.6.3-.9 0-2.8-2.2-5-5-5-.3 0-.6.1-.9.3L11.7 4.9C11.8 4.9 11.9 5 12 5c5 0 9.3 3.1 11 7-.4 1-.9 1.9-1.6 2.7l.5.4z"
      />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg className="auth-sent-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z"
      />
    </svg>
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
  const [mode, setMode] = useState<AuthMode>('signin')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
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

  if (!loading && user) {
    return <Navigate to={postLoginPath()} replace />
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
      navigate(postLoginPath(), { replace: true })
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
        if (password !== confirmPassword) {
          setLocalError('Passwords do not match.')
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
        await signInWithEmail(email.trim(), password)
        try {
          if (remember) localStorage.setItem(REMEMBER_KEY, email.trim())
          else localStorage.removeItem(REMEMBER_KEY)
        } catch {
          /* ignore */
        }
      }
      navigate(postLoginPath(), { replace: true })
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

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-visual" aria-hidden="true">
          <img
            className="auth-visual-img"
            src="/images/campaign-perfume-studio.jpg"
            alt=""
          />
          <div className="auth-visual-shade" />
          <div className="auth-visual-content">
            <Logo href="/" />
            <p className="auth-visual-kicker">LUCE</p>
            <h2 className="auth-visual-title">
              Campaigns that stay true to your product.
            </h2>
            <p className="auth-visual-copy">
              Research, strategy, and creative from one product photo.
            </p>
          </div>
        </aside>

        <section className="auth-panel" aria-labelledby="login-title">
          <div className="auth-panel-inner">
            {isForgotGoogle ? (
              <>
                <div className="auth-card-head">
                  <h1 id="login-title">Use Google to sign in</h1>
                  <p className="auth-card-lead">
                    <strong className="auth-sent-email">{sentTo}</strong> was
                    created with Google, so Firebase does not send a password
                    reset email for it. Sign in with Google instead.
                  </p>
                </div>

                {shownError && (
                  <p className="auth-error" role="alert">
                    {shownError}
                  </p>
                )}

                <button
                  type="button"
                  className="auth-google-btn"
                  onClick={onGoogle}
                  disabled={busy}
                >
                  <GoogleMark />
                  <span>{busy ? 'Connecting…' : 'Continue with Google'}</span>
                </button>

                <p className="auth-switch">
                  Want email login instead?{' '}
                  <button type="button" onClick={() => switchMode('signup')} disabled={busy}>
                    Create an email account
                  </button>
                </p>

                <p className="auth-switch">
                  <button type="button" onClick={() => switchMode('signin')} disabled={busy}>
                    ← Back to login
                  </button>
                </p>
              </>
            ) : isForgotSent ? (
              <>
                <div className="auth-sent">
                  <MailIcon />
                  <div className="auth-card-head">
                    <h1 id="login-title">
                      {resetViaFirebase ? 'Email may not arrive' : 'Check your email'}
                    </h1>
                    {resetViaFirebase ? (
                      <>
                        <p className="auth-card-lead">
                          LUCE asked Firebase to email{' '}
                          <strong className="auth-sent-email">{sentTo}</strong>,
                          but Firebase&apos;s built-in mail often never reaches
                          Gmail (even for Sign Up accounts).
                        </p>
                        <p className="auth-error" role="status">
                          To get real reset emails: add a Resend API key + Firebase
                          service account in <code>.env.local</code>, then run{' '}
                          <code>npm run dev:full</code>.
                        </p>
                      </>
                    ) : (
                      <p className="auth-card-lead">
                        A reset link was sent to{' '}
                        <strong className="auth-sent-email">{sentTo}</strong>.
                        Check Inbox and Spam, open the link, set a new password,
                        then log in.
                      </p>
                    )}
                  </div>
                </div>

                {shownError && (
                  <p className="auth-error" role="alert">
                    {shownError}
                  </p>
                )}

                <button
                  type="button"
                  className="auth-google-btn"
                  onClick={onGoogle}
                  disabled={busy}
                >
                  <GoogleMark />
                  <span>{busy ? 'Connecting…' : 'Continue with Google'}</span>
                </button>

                <button
                  type="button"
                  className="auth-submit"
                  onClick={() => switchMode('signin')}
                  disabled={busy}
                >
                  Back to login
                </button>

                <p className="auth-switch">
                  Didn&apos;t get it?{' '}
                  <button type="button" onClick={onResendReset} disabled={busy}>
                    {busy ? 'Sending…' : 'Resend email'}
                  </button>
                </p>
              </>
            ) : isForgot ? (
              <>
                <div className="auth-card-head">
                  <h1 id="login-title">Forgot password?</h1>
                  <p className="auth-card-lead">
                    Enter your email and we&apos;ll send you a link to reset your
                    password.
                  </p>
                </div>

                <form className="auth-form" onSubmit={onForgotSubmit}>
                  <div className="auth-field">
                    <label htmlFor="auth-reset-email">Email</label>
                    <input
                      id="auth-reset-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="example@gmail.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      disabled={busy}
                      autoFocus
                    />
                  </div>

                  {shownError && (
                    <p className="auth-error" role="alert">
                      {shownError}
                    </p>
                  )}

                  <button type="submit" className="auth-submit" disabled={busy}>
                    {busy ? 'Sending…' : 'Send reset link'}
                  </button>
                </form>

                <p className="auth-switch">
                  <button type="button" onClick={() => switchMode('signin')} disabled={busy}>
                    ← Back to login
                  </button>
                </p>
              </>
            ) : (
              <>
                <div className="auth-card-head">
                  <h1 id="login-title">Welcome!</h1>
                  <p className="auth-card-lead">
                    {isSignup ? 'Create your LUCE account' : 'Log in to your account'}
                  </p>
                </div>

                <form className="auth-form" onSubmit={onEmailSubmit}>
                  {isSignup && (
                    <div className="auth-field">
                      <label htmlFor="auth-name">Full name</label>
                      <input
                        id="auth-name"
                        name="name"
                        autoComplete="name"
                        placeholder="Maya Rahman"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  )}

                  <div className="auth-field">
                    <label htmlFor="auth-email">Your Email</label>
                    <input
                      id="auth-email"
                      name="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="example@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={busy}
                    />
                  </div>

                  <div className="auth-field">
                    <label htmlFor="auth-password">Password</label>
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

                  {isSignup && (
                    <div className="auth-field">
                      <label htmlFor="auth-confirm">Confirm password</label>
                      <input
                        id="auth-confirm"
                        name="confirmPassword"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={busy}
                      />
                    </div>
                  )}

                  {!isSignup && (
                    <div className="auth-row">
                      <label className="auth-remember">
                        <input
                          type="checkbox"
                          checked={remember}
                          onChange={(e) => setRemember(e.target.checked)}
                          disabled={busy}
                        />
                        <span>Remember Me</span>
                      </label>
                      <button
                        type="button"
                        className="auth-forgot"
                        onClick={() => switchMode('forgot')}
                        disabled={busy}
                      >
                        Forgot Password?
                      </button>
                    </div>
                  )}

                  {shownError && (
                    <p className="auth-error" role="alert">
                      {shownError}
                    </p>
                  )}

                  <button type="submit" className="auth-submit" disabled={busy}>
                    {busy
                      ? isSignup
                        ? 'Creating…'
                        : 'Signing in…'
                      : isSignup
                        ? 'Sign Up'
                        : 'Login'}
                  </button>
                </form>

                <div className="auth-or" role="separator" aria-label="or">
                  <span>or</span>
                </div>

                <div className="auth-social">
                  <button
                    type="button"
                    className="auth-google-btn"
                    onClick={onGoogle}
                    disabled={busy}
                  >
                    <GoogleMark />
                    <span>Continue with Google</span>
                  </button>
                </div>

                <p className="auth-switch">
                  {isSignup ? (
                    <>
                      Already have an account?{' '}
                      <button type="button" onClick={() => switchMode('signin')} disabled={busy}>
                        Log In
                      </button>
                    </>
                  ) : (
                    <>
                      Don&apos;t have an account?{' '}
                      <button type="button" onClick={() => switchMode('signup')} disabled={busy}>
                        Sign Up
                      </button>
                    </>
                  )}
                </p>
              </>
            )}

            <Link to="/" className="auth-home-link">
              ← Back to home
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
