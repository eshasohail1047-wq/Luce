import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import {
  PLAN_OPTIONS,
  isPaidPlan,
  planLabel as formatPlanLabel,
  type UserPlan,
} from '../lib/plans'
import { BRAND_TONE_OPTIONS } from '../lib/userSettings'

export default function SettingsPage() {
  const {
    user,
    plan,
    workspace,
    loading,
    signOut,
    updateDisplayName,
    updatePlan,
    updateWorkspace,
    resetPassword,
  } = useAuth()
  const location = useLocation()

  const [name, setName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [brandTone, setBrandTone] = useState('premium')
  const [notifyExports, setNotifyExports] = useState(true)

  const [profileBusy, setProfileBusy] = useState(false)
  const [workspaceBusy, setWorkspaceBusy] = useState(false)
  const [planBusy, setPlanBusy] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)

  const [profileMsg, setProfileMsg] = useState<string | null>(null)
  const [workspaceMsg, setWorkspaceMsg] = useState<string | null>(null)
  const [planMsg, setPlanMsg] = useState<string | null>(null)
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    setName(user.displayName?.trim() || '')
    setBrandName(workspace.brandName)
    setBrandTone(workspace.brandTone)
    setNotifyExports(workspace.notifyExports)
  }, [user, workspace])

  useEffect(() => {
    const id = location.hash.replace(/^#/, '')
    if (!id) return
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, loading])

  if (loading) {
    return (
      <div className="studio-shell studio-shell-alone">
        <p className="app-loading">Loading…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const displayName = user.displayName?.trim() || user.email?.split('@')[0] || 'Account'
  const initial = displayName.slice(0, 1).toUpperCase()
  const planLabel = formatPlanLabel(plan)
  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password')

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setProfileMsg(null)
    setProfileBusy(true)
    try {
      await updateDisplayName(name)
      setProfileMsg('Profile saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.')
    } finally {
      setProfileBusy(false)
    }
  }

  async function onSaveWorkspace(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setWorkspaceMsg(null)
    setWorkspaceBusy(true)
    try {
      await updateWorkspace({
        brandName: brandName.trim(),
        brandTone,
        notifyExports,
      })
      setWorkspaceMsg('Workspace preferences saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save workspace.')
    } finally {
      setWorkspaceBusy(false)
    }
  }

  async function onChangePlan(next: UserPlan) {
    setError(null)
    setPlanMsg(null)
    setPlanBusy(true)
    try {
      await updatePlan(next)
      setPlanMsg(
        next === 'free'
          ? 'Switched to Free plan.'
          : `You’re now on the ${formatPlanLabel(next)} plan.`,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update plan.')
    } finally {
      setPlanBusy(false)
    }
  }

  async function onResetPassword() {
    const email = user?.email
    if (!email) {
      setError('No email on this account.')
      return
    }
    setError(null)
    setPasswordMsg(null)
    setPasswordBusy(true)
    try {
      const result = await resetPassword(email)
      if (result.googleOnly) {
        setPasswordMsg('This account uses Google sign-in. Continue with Google to access LUCE.')
      } else if (result.sent) {
        setPasswordMsg('Password reset email sent. Check your inbox.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.')
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <AppLayout>
      <main className="dash dash-simple settings-page">
        <header className="settings-header">
          <div>
            <h1>Settings</h1>
            <p>Manage your account, plan, and workspace.</p>
          </div>
          <Link className="dash-create-btn dash-create-btn-ghost dash-create-btn-sm" to="/app">
            ← Dashboard
          </Link>
        </header>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <section className="settings-card" aria-labelledby="settings-profile-title">
          <div className="settings-card-head">
            <h2 id="settings-profile-title">Profile</h2>
          </div>

          <div className="settings-profile">
            <span className="settings-avatar" aria-hidden="true">
              {user.photoURL ? <img src={user.photoURL} alt="" /> : initial}
            </span>
            <div className="settings-profile-meta">
              <strong>{displayName}</strong>
              <span>{user.email || 'No email on file'}</span>
            </div>
          </div>

          <form className="settings-form" onSubmit={onSaveProfile}>
            <div className="auth-field">
              <label htmlFor="settings-name">Display name</label>
              <input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                disabled={profileBusy}
                autoComplete="name"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="settings-email">Email</label>
              <input id="settings-email" value={user.email || ''} disabled readOnly />
            </div>
            <div className="settings-actions">
              <button
                type="submit"
                className="dash-create-btn dash-create-btn-sm"
                disabled={profileBusy || !name.trim()}
              >
                {profileBusy ? 'Saving…' : 'Save profile'}
              </button>
            </div>
            {profileMsg && (
              <p className="settings-success" role="status">
                {profileMsg}
              </p>
            )}
          </form>
        </section>

        <section className="settings-card" id="plan" aria-labelledby="settings-plan-title">
          <div className="settings-card-head">
            <h2 id="settings-plan-title">Plan &amp; billing</h2>
            <span className={`settings-plan-pill${isPaidPlan(plan) ? ' is-pro' : ''}`}>
              {planLabel.toUpperCase()}
            </span>
          </div>
          <p className="settings-copy">
            You’re on the <strong>{planLabel}</strong> plan.
            {isPaidPlan(plan)
              ? ' You can generate images, video, ads, and full campaigns.'
              : ' Free includes one image try. Browse every studio — upgrade when you generate video, ads, campaigns, or more images.'}
          </p>
          <div className="settings-plan-grid" role="group" aria-label="Choose a plan">
            {PLAN_OPTIONS.map((option) => {
              const active = plan === option.id
              return (
                <article
                  key={option.id}
                  className={`settings-plan-option${active ? ' is-active' : ''}${option.featured ? ' is-featured' : ''}`}
                >
                  <div className="settings-plan-option-head">
                    <h3>{option.name}</h3>
                    {option.featured ? <span>Popular</span> : null}
                  </div>
                  <p className="settings-plan-option-price">
                    {option.monthly === 0 ? (
                      <strong>Free</strong>
                    ) : (
                      <>
                        <strong>${option.monthly}</strong>
                        <span>/ mo</span>
                      </>
                    )}
                  </p>
                  <p className="settings-plan-option-tagline">{option.tagline}</p>
                  <ul>
                    {option.perks.slice(0, 3).map((perk) => (
                      <li key={perk}>{perk}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={`dash-create-btn dash-create-btn-sm${active ? ' dash-create-btn-ghost' : ''}`}
                    disabled={planBusy || active}
                    onClick={() => void onChangePlan(option.id)}
                  >
                    {planBusy ? 'Updating…' : active ? 'Current plan' : `Choose ${option.name}`}
                  </button>
                </article>
              )
            })}
          </div>
          {planMsg && (
            <p className="settings-success" role="status">
              {planMsg}
            </p>
          )}
        </section>

        <section className="settings-card" aria-labelledby="settings-workspace-title">
          <div className="settings-card-head">
            <h2 id="settings-workspace-title">Workspace</h2>
          </div>
          <form className="settings-form" onSubmit={onSaveWorkspace}>
            <div className="auth-field">
              <label htmlFor="settings-brand">Brand name</label>
              <input
                id="settings-brand"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value)}
                placeholder="Maison Luce"
                disabled={workspaceBusy}
              />
            </div>
            <div className="auth-field">
              <label htmlFor="settings-tone">Brand tone</label>
              <select
                id="settings-tone"
                value={brandTone}
                onChange={(e) => setBrandTone(e.target.value)}
                disabled={workspaceBusy}
              >
                {BRAND_TONE_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={notifyExports}
                onChange={(e) => setNotifyExports(e.target.checked)}
                disabled={workspaceBusy}
              />
              <span>
                <strong>Email me when exports are ready</strong>
                <span>We’ll notify you when campaign packs finish generating.</span>
              </span>
            </label>
            <div className="settings-actions">
              <button type="submit" className="dash-create-btn dash-create-btn-sm" disabled={workspaceBusy}>
                {workspaceBusy ? 'Saving…' : 'Save workspace'}
              </button>
            </div>
            {workspaceMsg && (
              <p className="settings-success" role="status">
                {workspaceMsg}
              </p>
            )}
          </form>
        </section>

        <section className="settings-card" aria-labelledby="settings-security-title">
          <div className="settings-card-head">
            <h2 id="settings-security-title">Security</h2>
          </div>
          <p className="settings-copy">
            {hasPasswordProvider
              ? 'Send a password reset link to your email.'
              : 'This account signs in with Google. You can still request a password link to add email login.'}
          </p>
          <div className="settings-actions">
            <button
              type="button"
              className="dash-create-btn dash-create-btn-ghost dash-create-btn-sm"
              disabled={passwordBusy || !user.email}
              onClick={() => void onResetPassword()}
            >
              {passwordBusy ? 'Sending…' : 'Send password reset'}
            </button>
          </div>
          {passwordMsg && (
            <p className="settings-success" role="status">
              {passwordMsg}
            </p>
          )}
        </section>

        <section className="settings-card" id="help" aria-labelledby="settings-help-title">
          <div className="settings-card-head">
            <h2 id="settings-help-title">Help &amp; support</h2>
          </div>
          <p className="settings-copy">
            Questions about plans, fidelity, or your projects? Reach the LUCE team and we’ll help you
            get set up for generation.
          </p>
          <div className="settings-actions">
            <a className="dash-create-btn dash-create-btn-sm" href="mailto:hello@luce.ai">
              Email support
            </a>
            <Link className="dash-create-btn dash-create-btn-ghost dash-create-btn-sm" to="/app/studio/photos">
              Open Image Studio
            </Link>
          </div>
        </section>

        <section className="settings-card settings-card-danger" aria-labelledby="settings-account-title">
          <div className="settings-card-head">
            <h2 id="settings-account-title">Account</h2>
          </div>
          <p className="settings-copy">Sign out of LUCE on this device.</p>
          <div className="settings-actions">
            <button
              type="button"
              className="settings-logout-btn"
              onClick={() => {
                void (async () => {
                  try {
                    await signOut()
                  } finally {
                    window.location.replace('/')
                  }
                })()
              }}
            >
              Log out
            </button>
          </div>
        </section>
      </main>
    </AppLayout>
  )
}
