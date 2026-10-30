import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import { useTheme } from '../theme/ThemeProvider'
import {
  PLAN_OPTIONS,
  isPaidPlan,
  planLabel as formatPlanLabel,
  type UserPlan,
} from '../lib/plans'
import type { ThemePreference } from '../lib/theme'
import { BRAND_TONE_OPTIONS } from '../lib/userSettings'

const SETTINGS_NAV = [
  { id: 'profile', label: 'Profile', icon: 'user' },
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'plan', label: 'Plan & billing', icon: 'card' },
  { id: 'workspace', label: 'Workspace', icon: 'grid' },
  { id: 'security', label: 'Security', icon: 'lock' },
  { id: 'help', label: 'Help & support', icon: 'help' },
  { id: 'account', label: 'Account', icon: 'logout' },
] as const

const THEME_CARDS: { id: ThemePreference; title: string; body: string }[] = [
  { id: 'light', title: 'Light', body: 'Clean and bright.' },
  { id: 'dark', title: 'Dark', body: 'Bold and focused.' },
  { id: 'system', title: 'System', body: 'Matches your device.' },
]

function SettingsNavIcon({ name }: { name: (typeof SETTINGS_NAV)[number]['icon'] }) {
  const common = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    'aria-hidden': true as const,
  }
  switch (name) {
    case 'user':
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 19c1.6-3 4-4.5 7-4.5s5.4 1.5 7 4.5" strokeLinecap="round" />
        </svg>
      )
    case 'palette':
      return (
        <svg {...common}>
          <path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12" strokeLinejoin="round" />
          <circle cx="7.5" cy="10" r="1" fill="currentColor" stroke="none" />
          <circle cx="10.5" cy="7" r="1" fill="currentColor" stroke="none" />
          <circle cx="14.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'card':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="18" height="12" rx="2.5" />
          <path d="M3 10h18" />
        </svg>
      )
    case 'grid':
      return (
        <svg {...common}>
          <rect x="4" y="4" width="7" height="7" rx="1.5" />
          <rect x="13" y="4" width="7" height="7" rx="1.5" />
          <rect x="4" y="13" width="7" height="7" rx="1.5" />
          <rect x="13" y="13" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...common}>
          <rect x="5" y="11" width="14" height="10" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" strokeLinecap="round" />
        </svg>
      )
    case 'help':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2-3 4" strokeLinecap="round" />
          <circle cx="12" cy="17" r="0.8" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...common}>
          <path d="M10 17H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h4" strokeLinecap="round" />
          <path d="M15 8l4 4-4 4M19 12H10" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
  }
}

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
  const { preference, setPreference } = useTheme()
  const location = useLocation()

  const [name, setName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [brandTone, setBrandTone] = useState('premium')
  const [notifyExports, setNotifyExports] = useState(true)
  const [activeSection, setActiveSection] = useState<string>('profile')
  const [editingProfile, setEditingProfile] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState(false)

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
    setActiveSection(id)
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [location.hash, loading])

  useEffect(() => {
    const sections = SETTINGS_NAV.map((item) => document.getElementById(item.id)).filter(
      Boolean,
    ) as HTMLElement[]
    if (!sections.length) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible?.target?.id) setActiveSection(visible.target.id)
      },
      { rootMargin: '-18% 0px -55% 0px', threshold: [0.12, 0.35, 0.6] },
    )
    for (const section of sections) observer.observe(section)
    return () => observer.disconnect()
  }, [loading, user])

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
  const paid = isPaidPlan(plan)
  const hasPasswordProvider = user.providerData.some((p) => p.providerId === 'password')
  const workspaceLabel = brandName.trim() || `${displayName}'s Workspace`
  const currentPlan = PLAN_OPTIONS.find((p) => p.id === plan) || PLAN_OPTIONS[0]

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setProfileMsg(null)
    setProfileBusy(true)
    try {
      await updateDisplayName(name)
      setProfileMsg('Profile updated')
      setEditingProfile(false)
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
      setWorkspaceMsg('Workspace updated')
      setEditingWorkspace(false)
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
      setPlanMsg(next === 'free' ? 'Switched to Free' : `Now on ${formatPlanLabel(next)}`)
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
        setPasswordMsg('This account uses Google sign-in.')
      } else if (result.sent) {
        setPasswordMsg('Reset email sent.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.')
    } finally {
      setPasswordBusy(false)
    }
  }

  return (
    <AppLayout>
      <main className="dash workspace-page settings-page settings-shell">
        <section className="settings-banner" aria-label="Settings overview">
          <div className="settings-banner-copy">
            <p className="settings-banner-kicker">Your account</p>
            <h1>Settings</h1>
            <p>Manage your profile, preferences, and account in one place.</p>
          </div>
          <div className="settings-banner-art" aria-hidden="true" />
        </section>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <div className="settings-shell-layout">
          <aside className="settings-side-nav" aria-label="Settings sections">
            {SETTINGS_NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className={activeSection === item.id ? 'is-active' : ''}
                onClick={() => setActiveSection(item.id)}
              >
                <SettingsNavIcon name={item.icon} />
                <span>{item.label}</span>
              </a>
            ))}
          </aside>

          <div className="settings-shell-main">
            <section className="settings-panel" id="profile" aria-labelledby="settings-profile-title">
              <div className="settings-panel-head">
                <div>
                  <h2 id="settings-profile-title">Profile</h2>
                  <p>Your public details in LUCE</p>
                </div>
                <button
                  type="button"
                  className="settings-panel-action"
                  onClick={() => {
                    setEditingProfile((v) => !v)
                    setProfileMsg(null)
                  }}
                >
                  {editingProfile ? 'Cancel' : 'Edit profile'}
                </button>
              </div>

              <div className="settings-profile-block">
                <div className="settings-avatar-wrap">
                  <span className="settings-avatar settings-avatar-lg" aria-hidden="true">
                    {user.photoURL ? <img src={user.photoURL} alt="" /> : initial}
                  </span>
                  <button
                    type="button"
                    className="settings-avatar-edit"
                    aria-label={editingProfile ? 'Cancel profile edit' : 'Edit profile'}
                    onClick={() => {
                      setEditingProfile((v) => !v)
                      setProfileMsg(null)
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path
                        d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinejoin="round"
                      />
                      <path d="M12.5 7l4.5 4.5" stroke="currentColor" strokeWidth="1.8" />
                    </svg>
                  </button>
                </div>

                {editingProfile ? (
                  <form className="settings-form" onSubmit={onSaveProfile}>
                    <div className="settings-form-row">
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
                    </div>
                    <div className="settings-actions">
                      <button
                        type="submit"
                        className="dash-create-btn dash-create-btn-sm"
                        disabled={profileBusy || !name.trim()}
                      >
                        {profileBusy ? 'Saving…' : 'Save changes'}
                      </button>
                      {profileMsg ? (
                        <p className="settings-success" role="status">
                          {profileMsg}
                        </p>
                      ) : null}
                    </div>
                  </form>
                ) : (
                  <div className="settings-readonly-grid">
                    <div>
                      <span className="settings-field-label">Display name</span>
                      <strong>{displayName}</strong>
                    </div>
                    <div>
                      <span className="settings-field-label">Email</span>
                      <strong>{user.email || 'No email'}</strong>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section
              className="settings-panel"
              id="appearance"
              aria-labelledby="settings-appearance-title"
            >
              <div className="settings-panel-head">
                <div>
                  <h2 id="settings-appearance-title">Appearance</h2>
                  <p>Choose how LUCE looks on this device</p>
                </div>
              </div>
              <div className="settings-theme-grid" role="radiogroup" aria-label="Color theme">
                {THEME_CARDS.map((card) => {
                  const active = preference === card.id
                  return (
                    <button
                      key={card.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      className={`settings-theme-card tone-${card.id}${active ? ' is-active' : ''}`}
                      onClick={() => setPreference(card.id)}
                    >
                      <span className="settings-theme-preview" aria-hidden="true" />
                      <strong>{card.title}</strong>
                      <span>{card.body}</span>
                      {active ? <span className="settings-theme-check">✓</span> : null}
                    </button>
                  )
                })}
              </div>
            </section>

            <section className="settings-panel" id="plan" aria-labelledby="settings-plan-title">
              <div className="settings-panel-head">
                <div>
                  <h2 id="settings-plan-title">Plan &amp; billing</h2>
                  <p>Your current plan and upgrades</p>
                </div>
                <a className="settings-panel-link" href="#plan-options">
                  View plans
                </a>
              </div>

              <div className="settings-plan-summary">
                <div>
                  <span className="settings-plan-pill">{planLabel} plan</span>
                  <strong>{currentPlan?.name || planLabel}</strong>
                  <p>
                    {paid
                      ? 'Images, video, ads, and full campaigns unlocked.'
                      : 'Free includes one image try. Upgrade for video, campaigns, and more.'}
                  </p>
                </div>
                {!paid ? (
                  <button
                    type="button"
                    className="dash-create-btn dash-create-btn-sm"
                    disabled={planBusy}
                    onClick={() => void onChangePlan('starter')}
                  >
                    Upgrade plan →
                  </button>
                ) : (
                  <span className="settings-current-chip">Current plan</span>
                )}
              </div>

              <div className="settings-plan-grid" id="plan-options" role="group" aria-label="Choose a plan">
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
                            <span>/mo</span>
                          </>
                        )}
                      </p>
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
              {planMsg ? (
                <p className="settings-success" role="status">
                  {planMsg}
                </p>
              ) : null}
            </section>

            <section
              className="settings-panel"
              id="workspace"
              aria-labelledby="settings-workspace-title"
            >
              <div className="settings-panel-head">
                <div>
                  <h2 id="settings-workspace-title">Workspace</h2>
                  <p>Brand defaults for new creatives</p>
                </div>
                <button
                  type="button"
                  className="settings-panel-action"
                  onClick={() => {
                    setEditingWorkspace((v) => !v)
                    setWorkspaceMsg(null)
                  }}
                >
                  {editingWorkspace ? 'Cancel' : 'Manage workspace'}
                </button>
              </div>

              {!editingWorkspace ? (
                <div className="settings-workspace-summary">
                  <div>
                    <strong>{workspaceLabel}</strong>
                    <span className="settings-owner-chip">Owner</span>
                  </div>
                  <p>
                    Tone: {BRAND_TONE_OPTIONS.find((t) => t.id === brandTone)?.label || brandTone}
                    {notifyExports ? ' · Export emails on' : ' · Export emails off'}
                  </p>
                </div>
              ) : (
                <form className="settings-form" onSubmit={onSaveWorkspace}>
                  <div className="settings-form-row">
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
                  </div>
                  <label className="settings-toggle">
                    <input
                      type="checkbox"
                      checked={notifyExports}
                      onChange={(e) => setNotifyExports(e.target.checked)}
                      disabled={workspaceBusy}
                    />
                    <span>
                      <strong>Email when exports are ready</strong>
                    </span>
                  </label>
                  <div className="settings-actions">
                    <button
                      type="submit"
                      className="dash-create-btn dash-create-btn-sm"
                      disabled={workspaceBusy}
                    >
                      {workspaceBusy ? 'Saving…' : 'Save changes'}
                    </button>
                    {workspaceMsg ? (
                      <p className="settings-success" role="status">
                        {workspaceMsg}
                      </p>
                    ) : null}
                  </div>
                </form>
              )}
            </section>

            <section className="settings-row-card" id="security" aria-labelledby="settings-security-title">
              <div>
                <h2 id="settings-security-title">Security</h2>
                <p>
                  {hasPasswordProvider
                    ? 'Update your password by email.'
                    : 'Signed in with Google.'}
                </p>
                {passwordMsg ? (
                  <p className="settings-success" role="status">
                    {passwordMsg}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="settings-panel-action"
                disabled={passwordBusy || !user.email}
                onClick={() => void onResetPassword()}
              >
                {passwordBusy ? 'Sending…' : 'Update password'}
              </button>
            </section>

            <section className="settings-row-card" id="help" aria-labelledby="settings-help-title">
              <div>
                <h2 id="settings-help-title">Help &amp; support</h2>
                <p>Guides, feedback, and contact</p>
              </div>
              <div className="settings-row-actions">
                <a className="settings-panel-action" href="/#how-it-works">
                  Learning center
                </a>
                <a className="settings-panel-action" href="mailto:hello@luce.ai?subject=LUCE%20support">
                  Contact support
                </a>
              </div>
            </section>

            <section
              className="settings-row-card settings-row-card-danger"
              id="account"
              aria-labelledby="settings-account-title"
            >
              <div>
                <h2 id="settings-account-title">Account</h2>
                <p>Sign out of LUCE on this device</p>
              </div>
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
            </section>
          </div>
        </div>
      </main>
    </AppLayout>
  )
}
