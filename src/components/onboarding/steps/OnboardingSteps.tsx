import { useState } from 'react'
import type {
  GoalId,
  OnboardingData,
  RoleId,
  SellType,
  SetupMode,
} from '../../../lib/onboarding'
import {
  GOAL_OPTIONS,
  HEAR_OPTIONS,
  ROLE_OPTIONS,
  SELL_TYPE_OPTIONS,
  domainFromUrl,
} from '../../../lib/onboarding'
import {
  CHANNEL_GROUPS,
  INDUSTRIES,
  PLANS,
  PLAN_SHARED_FEATURES,
  type ChannelId,
  type IndustryId,
} from '../../../lib/onboardingOptions'
import { industryFromCategory } from '../../../lib/onboarding'
import { BRAND_TONE_OPTIONS } from '../../../lib/userSettings'

type Patch = (partial: Partial<OnboardingData>) => void

function Found({ show }: { show: boolean }) {
  if (!show) return null
  return <span className="ob-found">Found</span>
}

function CheckMark() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true">
      <path
        d="M20 6 9 17l-5-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IndustryIcon({ icon }: { icon: string }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 18,
    height: 18,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
  switch (icon) {
    case 'spray':
      return (
        <svg {...common}>
          <path d="M8 14c0-2.2 1.3-4 4-5" />
          <rect x="10" y="14" width="4" height="7" rx="1" />
          <path d="M12 9V6M12 6h2M14 4l1.5-1.5M14 4l1.5 1.5M14 4H12" />
        </svg>
      )
    case 'sparkles':
      return (
        <svg {...common}>
          <path d="M12 3l1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3z" />
          <path d="M18 13l.7 2.1L21 16l-2.3.7L18 19l-.7-2.3L15 16l2.3-.9L18 13z" />
          <path d="M5 14l.6 1.8L7.5 16.5 5.6 17 5 19l-.6-1.5L2.5 16.5 4.4 15.8 5 14z" />
        </svg>
      )
    case 'shirt':
      return (
        <svg {...common}>
          <path d="M8 5l4 2 4-2 3 3-2 2v9H7v-9L5 8l3-3z" />
        </svg>
      )
    case 'gem':
      return (
        <svg {...common}>
          <path d="M6 9h12l-2 10H8L6 9z" />
          <path d="M9 3h6l3 6H6l3-6z" />
          <path d="M12 3v16" />
        </svg>
      )
    case 'coffee':
      return (
        <svg {...common}>
          <path d="M5 10h11v6a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-6z" />
          <path d="M16 11h2a2.5 2.5 0 0 1 0 5h-2" />
          <path d="M8 4c0 1 .5 1.5.5 2.5S8 8 8 8M12 4c0 1 .5 1.5.5 2.5S12 8 12 8" />
        </svg>
      )
    case 'leaf':
      return (
        <svg {...common}>
          <path d="M5 19c8 0 13-6 14-14-8 1-14 6-14 14z" />
          <path d="M5 19c3-4 7-7 12-9" />
        </svg>
      )
    case 'sofa':
      return (
        <svg {...common}>
          <path d="M4 12a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4H4v-4z" />
          <path d="M6 10V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2" />
          <path d="M6 16v2M18 16v2" />
        </svg>
      )
    case 'phone':
      return (
        <svg {...common}>
          <rect x="8" y="3" width="8" height="18" rx="2" />
          <path d="M11 17h2" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
        </svg>
      )
  }
}

function CategoryPicker({
  value,
  industry,
  onSelect,
  found,
}: {
  value: string
  industry?: string
  onSelect: (next: { category: string; industry: IndustryId }) => void
  found?: boolean
}) {
  const selectedId =
    (industry && INDUSTRIES.some((i) => i.id === industry) ? industry : '') ||
    industryFromCategory(value) ||
    ''

  return (
    <div className="ob-field">
      <span>
        Category {found ? <Found show /> : null}
      </span>
      <div className="ob-category-grid" role="group" aria-label="Business category">
        {INDUSTRIES.map((opt) => {
          const selected = selectedId === opt.id
          return (
            <button
              key={opt.id}
              type="button"
              className={`ob-category-card${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelect({ category: opt.name, industry: opt.id })}
            >
              <span className="ob-category-icon">
                <IndustryIcon icon={opt.icon} />
              </span>
              <strong>{opt.name}</strong>
              {selected ? (
                <span className="ob-check-dot" aria-hidden="true">
                  <CheckMark />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}

const ROLE_ACCENT: Record<RoleId, string> = {
  founder: 'ink',
  marketer: 'slate',
  freelancer: 'stone',
  agency: 'zinc',
  other: 'neutral',
}

function RoleIcon({ id }: { id: RoleId }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 18,
    height: 18,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
  if (id === 'founder') {
    return (
      <svg {...common}>
        <path d="M12 3 14.5 9.5 21 10.2 16 14.8 17.5 21 12 17.8 6.5 21 8 14.8 3 10.2 9.5 9.5Z" />
      </svg>
    )
  }
  if (id === 'marketer') {
    return (
      <svg {...common}>
        <path d="M4 19V5" />
        <path d="M4 19h16" />
        <path d="M8 15v-4" />
        <path d="M12 15V8" />
        <path d="M16 15v-6" />
      </svg>
    )
  }
  if (id === 'freelancer') {
    return (
      <svg {...common}>
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
        <path d="M4 20a8 8 0 0 1 16 0" />
      </svg>
    )
  }
  if (id === 'agency') {
    return (
      <svg {...common}>
        <path d="M3 21h18" />
        <path d="M6 21V8l6-4 6 4v13" />
        <path d="M10 12h4" />
        <path d="M10 16h4" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 2.5" />
    </svg>
  )
}

/** 1 — About you (personal name + role) */
export function PersonalStep({
  data,
  patch,
}: {
  data: OnboardingData
  patch: Patch
}) {
  const first = data.firstName.trim()
  const last = data.lastName.trim()
  const displayName =
    [first, last].filter(Boolean).join(' ') || data.fullName.trim() || 'Your profile'
  const initials = (
    (first[0] || data.fullName.trim()[0] || 'Y') + (last[0] || first[1] || '')
  ).toUpperCase()
  const selectedRole = ROLE_OPTIONS.find((r) => r.id === data.role)
  const checklist = [
    { id: 'name', label: 'Name', done: Boolean(first || data.fullName.trim()), accent: 'a' },
    { id: 'role', label: 'Role selected', done: Boolean(data.role), accent: 'b' },
    { id: 'heard', label: 'How you heard (optional)', done: Boolean(data.howHeard), accent: 'c' },
    { id: 'next', label: 'Business setup next', done: false, accent: 'd', upcoming: true },
  ]

  return (
    <div className="ob-split ob-split-personal">
      <div className="ob-stack ob-rise">
        <header className="ob-personal-head">
          <span className="ob-chip-label">Step 1 · About you</span>
          <h1 className="ob-title">Tell us who you are</h1>
          <p className="ob-sub">
            A few details so Luce can tailor your workspace. About three minutes total —
            optional fields can wait.
          </p>
        </header>

        <section className="ob-card-panel ob-personal-panel" aria-label="About you">
          <div className="ob-personal-block">
            <div className="ob-section-head-row">
              <h2 className="ob-section-title">
                Your name <span className="ob-req" aria-hidden="true">*</span>
              </h2>
              <span className="ob-meta">Shown in your workspace</span>
            </div>
            <div className="ob-name-grid">
              <label className="ob-field">
                <span>First name</span>
                <input
                  value={data.firstName}
                  onChange={(e) => patch({ firstName: e.target.value })}
                  placeholder="Alex"
                  autoComplete="given-name"
                  autoFocus
                  required
                />
              </label>
              <label className="ob-field">
                <span>
                  Last name <em className="ob-optional">(optional)</em>
                </span>
                <input
                  value={data.lastName}
                  onChange={(e) => patch({ lastName: e.target.value })}
                  placeholder="Rivera"
                  autoComplete="family-name"
                />
              </label>
            </div>
          </div>

          <div className="ob-personal-block">
            <div className="ob-section-head-row">
              <h2 className="ob-section-title" id="ob-role-heading">
                What best describes you? <span className="ob-req" aria-hidden="true">*</span>
              </h2>
              <span className="ob-meta">Required</span>
            </div>
            <div
              className="ob-role-grid"
              role="radiogroup"
              aria-labelledby="ob-role-heading"
            >
              {ROLE_OPTIONS.map((opt) => {
                const selected = data.role === opt.id
                const isOther = opt.id === 'other'
                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`ob-role-card ob-role-${ROLE_ACCENT[opt.id as RoleId]}${
                      isOther ? ' ob-role-wide' : ''
                    }${selected ? ' is-selected' : ''}`}
                    onClick={() => patch({ role: opt.id as RoleId })}
                  >
                    <span className="ob-role-ico" aria-hidden="true">
                      <RoleIcon id={opt.id as RoleId} />
                    </span>
                    <span className="ob-role-copy">
                      <strong>{opt.label}</strong>
                      <span>{opt.desc}</span>
                    </span>
                    <span
                      className={`ob-role-tick${selected ? ' is-on' : ''}`}
                      aria-hidden="true"
                    >
                      {selected ? <CheckMark /> : null}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="ob-personal-block ob-personal-block-last">
            <div className="ob-section-head-row">
              <h2 className="ob-section-title">How did you find Luce?</h2>
              <span className="ob-meta">Optional</span>
            </div>
            <label className="ob-field" style={{ marginBottom: 0 }}>
              <span className="ob-sr-only">Referral source</span>
              <select
                value={data.howHeard}
                onChange={(e) => patch({ howHeard: e.target.value })}
              >
                <option value="">Select a source…</option>
                {HEAR_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      </div>

      <aside className="ob-personal-aside ob-rise ob-d2">
        <div className="ob-profile-card">
          <div className="ob-profile-avatar" aria-hidden="true">
            {initials}
          </div>
          <div className="ob-profile-meta">
            <strong>{displayName}</strong>
            <em>{selectedRole ? selectedRole.label : 'Role not selected yet'}</em>
          </div>
          {selectedRole ? (
            <span className={`ob-profile-role-pill ob-role-${ROLE_ACCENT[selectedRole.id]}`}>
              <RoleIcon id={selectedRole.id} />
              {selectedRole.desc}
            </span>
          ) : (
            <p className="ob-profile-hint">
              Choose a role so we can set sensible defaults for your brand kit.
            </p>
          )}
        </div>

        <div className="ob-personal-checklist">
          <p className="ob-preview-label">This step</p>
          <ul>
            {checklist.map((item) => (
              <li
                key={item.id}
                className={`ob-check-item ob-accent-${item.accent}${
                  item.done ? ' is-done' : ''
                }${item.upcoming ? ' is-upcoming' : ''}`}
              >
                <span className="ob-check-mark" aria-hidden="true">
                  {item.done ? <CheckMark /> : null}
                </span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
          <p className="ob-profile-save-note">
            Progress saves as you go — leave anytime with Save and exit.
          </p>
        </div>
      </aside>
    </div>
  )
}

function PathIcon({ mode }: { mode: SetupMode }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
  if (mode === 'scan') {
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
        <path d="M8 11h6" />
        <path d="M11 8v6" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M4 19V5h10l6 6v8H4Z" />
      <path d="M14 5v6h6" />
      <path d="M8 13h6" />
      <path d="M8 16h4" />
    </svg>
  )
}

/** 2 — Website scan or manual setup */
export function WebsiteStep({
  data,
  patch,
}: {
  data: OnboardingData
  patch: Patch
}) {
  const mode = data.setupMode

  return (
    <div className="ob-split ob-split-website">
      <div className="ob-stack ob-rise">
        <header className="ob-personal-head">
          <span className="ob-chip-label">Step 2 · Your business</span>
          <h1 className="ob-title">How should we set up your brand?</h1>
          <p className="ob-sub">
            Scan an existing site for a head start, or enter a few basics if you don’t have a
            website yet.
          </p>
        </header>

        <section className="ob-card-panel ob-website-panel" aria-label="Setup path">
          <div className="ob-personal-block">
            <div className="ob-section-head-row">
              <h2 className="ob-section-title" id="ob-path-heading">
                Choose a path
              </h2>
              <span className="ob-meta">Pick one</span>
            </div>
            <div
              className="ob-path-grid"
              role="radiogroup"
              aria-labelledby="ob-path-heading"
            >
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'scan'}
                className={`ob-path-card${mode === 'scan' ? ' is-selected' : ''}`}
                onClick={() =>
                  patch({
                    setupMode: 'scan',
                    businessName: data.businessName,
                  })
                }
              >
                <span className="ob-path-ico" aria-hidden="true">
                  <PathIcon mode="scan" />
                </span>
                <span className="ob-path-copy">
                  <strong>I have a website</strong>
                  <span>We’ll scan for name, pitch, visuals, and colors.</span>
                </span>
                {mode === 'scan' ? (
                  <span className="ob-check-dot" aria-hidden="true">
                    <CheckMark />
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === 'manual'}
                className={`ob-path-card${mode === 'manual' ? ' is-selected' : ''}`}
                onClick={() =>
                  patch({
                    setupMode: 'manual',
                    websiteUrl: '',
                  })
                }
              >
                <span className="ob-path-ico" aria-hidden="true">
                  <PathIcon mode="manual" />
                </span>
                <span className="ob-path-copy">
                  <strong>Set up manually</strong>
                  <span>No website yet? Enter your business basics.</span>
                </span>
                {mode === 'manual' ? (
                  <span className="ob-check-dot" aria-hidden="true">
                    <CheckMark />
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          {mode === 'scan' ? (
            <div className="ob-personal-block ob-personal-block-last">
              <div className="ob-section-head-row">
                <h2 className="ob-section-title">
                  Website URL <span className="ob-req" aria-hidden="true">*</span>
                </h2>
                <span className="ob-meta">Homepage or shop</span>
              </div>
              <label className="ob-field" style={{ marginBottom: 0 }}>
                <span className="ob-sr-only">Business website URL</span>
                <div className="ob-input-with-ico">
                  <span className="ob-input-ico" aria-hidden="true">
                    https://
                  </span>
                  <input
                    value={data.websiteUrl}
                    onChange={(e) => patch({ websiteUrl: e.target.value, setupMode: 'scan' })}
                    placeholder="yourbrand.com"
                    autoFocus
                    inputMode="url"
                    autoComplete="url"
                  />
                </div>
                <span className="ob-hint">
                  You’ll review and edit everything before your workspace opens.
                </span>
              </label>
            </div>
          ) : null}

          {mode === 'manual' ? (
            <div className="ob-personal-block ob-personal-block-last">
              <div className="ob-section-head-row">
                <h2 className="ob-section-title">
                  Business basics <span className="ob-req" aria-hidden="true">*</span>
                </h2>
                <span className="ob-meta">Skips the website scan</span>
              </div>
              <label className="ob-field">
                <span>Business name</span>
                <input
                  value={data.businessName}
                  onChange={(e) =>
                    patch({ businessName: e.target.value, setupMode: 'manual' })
                  }
                  placeholder="Acme Studio"
                  autoFocus
                  autoComplete="organization"
                />
              </label>
              <CategoryPicker
                value={data.category}
                industry={data.industry}
                onSelect={({ category, industry }) =>
                  patch({
                    category,
                    industry,
                    setupMode: 'manual',
                  })
                }
              />
              <div className="ob-field" style={{ marginBottom: 0 }}>
                <span>
                  What do you sell? <em className="ob-optional">(optional)</em>
                </span>
                <div className="ob-sell-grid ob-sell-grid-compact" role="group">
                  {SELL_TYPE_OPTIONS.map((opt) => {
                    const selected = data.sellType === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        className={`ob-sell-card${selected ? ' is-selected' : ''}`}
                        aria-pressed={selected}
                        onClick={() =>
                          patch({
                            sellType: opt.id as SellType,
                            setupMode: 'manual',
                          })
                        }
                      >
                        <strong>{opt.label}</strong>
                        <span>{opt.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}

          {!mode ? (
            <div className="ob-personal-block ob-personal-block-last">
              <p className="ob-path-empty">
                Select a path above to continue. You can always skip this step.
              </p>
            </div>
          ) : null}
        </section>
      </div>

      <aside className="ob-helper-card ob-rise ob-d2">
        <p className="ob-preview-label">
          {mode === 'manual' ? 'Manual setup' : mode === 'scan' ? 'Website scan' : 'What happens next'}
        </p>
        {mode === 'manual' ? (
          <>
            <ul className="ob-check-list">
              <li>Business name seeds your kit</li>
              <li>Category &amp; sell type shape defaults</li>
              <li>Confirm brand details next</li>
            </ul>
            <p>No URL required — you’ll refine pitch, colors, and voice on the next screen.</p>
          </>
        ) : mode === 'scan' ? (
          <>
            <ul className="ob-check-list">
              <li>Brand name &amp; pitch</li>
              <li>Logo &amp; product visuals</li>
              <li>Colors, fonts &amp; voice</li>
            </ul>
            <p>You can edit everything before opening your workspace.</p>
          </>
        ) : (
          <>
            <ul className="ob-check-list">
              <li>Scan a live site, or</li>
              <li>Enter basics without a URL</li>
              <li>Confirm your brand kit next</li>
            </ul>
            <p>Either path lands on the same brand review step.</p>
          </>
        )}
      </aside>
    </div>
  )
}

const DEFAULT_SCAN_STAGES = [
  { id: 'connecting', label: 'Connecting to website' },
  { id: 'pages', label: 'Analyzing website pages' },
  { id: 'assets', label: 'Extracting logo and visual assets' },
  { id: 'colors', label: 'Detecting colors' },
  { id: 'typography', label: 'Identifying typography' },
  { id: 'products', label: 'Analyzing products' },
  { id: 'identity', label: 'Understanding brand identity' },
  { id: 'kit', label: 'Preparing brand kit' },
]

/** 3 — Scanning progress (backend-driven stages) */
export function ScanningStep({
  data,
  pct,
  stats,
  stages,
  preview,
  error,
  onRetry,
}: {
  data: OnboardingData
  pct: number
  stats: {
    pages: number
    products: number
    images: number
    colors: number
    fonts?: number
  }
  stages: Array<{ id: string; label: string; status: string; message?: string }>
  preview: {
    logoUrl?: string
    imageUrls: string[]
    colors: string[]
    businessName?: string
  }
  error: string | null
  onRetry?: () => void
}) {
  const domain = domainFromUrl(data.websiteUrl)
  const ringOff = 339.3 * (1 - pct / 100)
  const mergedStages = DEFAULT_SCAN_STAGES.map((def) => {
    const live = stages.find((s) => s.id === def.id)
    return {
      id: def.id,
      label: live?.label || def.label,
      status: live?.status || 'pending',
      message: live?.message,
    }
  })
  const previewColors = preview.colors.length
    ? preview.colors
    : data.brandColors
  const previewImages = preview.imageUrls.filter(Boolean)
  const logo = preview.logoUrl || data.logoUrl
  const name = preview.businessName || data.businessName || 'Your brand'

  return (
    <div className="ob-scan">
      <section className="ob-scan-main ob-card-panel ob-rise">
        <div className="ob-scan-head">
          <div className="ob-ring-wrap" aria-hidden="true">
            <svg viewBox="0 0 128 128" width="96" height="96">
              <circle cx="64" cy="64" r="54" fill="none" className="ob-ring-track" />
              <circle
                cx="64"
                cy="64"
                r="54"
                fill="none"
                className="ob-ring-value"
                strokeDasharray="339.3"
                strokeDashoffset={ringOff}
                transform="rotate(-90 64 64)"
              />
            </svg>
            <div className="ob-ring-label">
              <strong>{pct}%</strong>
              <span>{pct >= 100 ? 'Done' : 'Scanning'}</span>
            </div>
          </div>
          <div>
            <h1 className="ob-title">
              {data.websiteUrl.trim() ? `Learning about ${domain}` : 'Preparing your workspace'}
            </h1>
            <p className="ob-sub">
              Real extraction progress — colors, fonts, products, and brand identity from your site.
            </p>
            {error ? (
              <div className="ob-warn-block">
                <p className="ob-warn">{error}</p>
                {onRetry ? (
                  <button type="button" className="ob-btn-secondary" onClick={onRetry}>
                    Retry scan
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
        <div className="ob-scan-stats">
          <div className="ob-stat">
            <span>Pages</span>
            <b>{stats.pages}</b>
          </div>
          <div className="ob-stat">
            <span>Products</span>
            <b>{stats.products}</b>
          </div>
          <div className="ob-stat">
            <span>Images</span>
            <b>{stats.images}</b>
          </div>
          <div className="ob-stat">
            <span>Colors</span>
            <b>{stats.colors}</b>
          </div>
          <div className="ob-stat">
            <span>Fonts</span>
            <b>{stats.fonts || 0}</b>
          </div>
        </div>
        <div className="ob-scan-list">
          {mergedStages.map((row) => {
            const failed = row.status === 'error'
            const done = !failed && (row.status === 'done' || pct >= 100)
            const active = row.status === 'active' && !done
            return (
              <div key={row.id} className="ob-scan-row">
                <span
                  className={`ob-scan-dot${done ? ' is-done' : ''}${active ? ' is-active' : ''}${failed ? ' is-error' : ''}`}
                >
                  {done ? <CheckMark /> : active ? <i className="ob-spinner-sm" /> : null}
                </span>
                <span className={done || active || failed ? '' : 'is-muted'}>{row.label}</span>
                <em>
                  {failed
                    ? row.message || 'Failed'
                    : done
                      ? row.message || 'Done'
                      : active
                        ? 'Working…'
                        : ''}
                </em>
              </div>
            )
          })}
        </div>
      </section>
      <aside className="ob-scan-preview ob-card-panel ob-rise ob-d2">
        <div className="ob-live-pill">
          <i /> Live brand kit preview
        </div>
        <div className="ob-brand-id">
          {logo ? (
            <img src={logo} alt="" />
          ) : (
            <span>{(name || domain || 'L').slice(0, 2).toUpperCase()}</span>
          )}
          <div>
            <strong>{name}</strong>
            <em>
              {domain}
              {data.category ? ` · ${data.category}` : ''}
            </em>
          </div>
        </div>
        {previewColors.length ? (
          <div className="ob-swatches">
            {previewColors.slice(0, 8).map((c) => (
              <i key={c} style={{ background: c }} title={c} />
            ))}
          </div>
        ) : (
          <p className="ob-brand-empty">Colors appear as they are extracted.</p>
        )}
        <div className="ob-preview-grid">
          {previewImages.length
            ? previewImages.slice(0, 4).map((src) => <img key={src} src={src} alt="" />)
            : null}
        </div>
        {!previewImages.length ? (
          <p className="ob-brand-empty">Product images appear when found — no empty placeholders.</p>
        ) : null}
      </aside>
    </div>
  )
}

function EvidenceBadge({
  status,
  evidence,
}: {
  status?: string
  evidence?: string
}) {
  if (!status || status === 'unknown') {
    return (
      <span className="ob-ev-badge is-unknown" title={evidence || 'Needs your input'}>
        Unknown
      </span>
    )
  }
  if (status === 'verified') {
    return (
      <span className="ob-ev-badge is-verified" title={evidence || 'Website evidence'}>
        Verified
      </span>
    )
  }
  return (
    <span
      className="ob-ev-badge is-inferred"
      title={evidence || 'Interpreted from website evidence'}
    >
      AI-inferred
    </span>
  )
}

function kitField(
  data: OnboardingData,
  key: string,
): { value: unknown; status: string; evidence?: string; source?: string } | undefined {
  return data.completeBrandKit?.[key]
}

type BrandPreviewVisual = {
  src: string | null
  productName: string
  source: 'product' | 'preview' | 'fallback'
}

function pickBrandPreviewVisual(data: OnboardingData): BrandPreviewVisual {
  const product = data.scannedProducts.find((p) => Boolean(p.imageUrl?.trim()))
  if (product?.imageUrl?.trim()) {
    return {
      src: product.imageUrl.trim(),
      productName: product.name.trim() || data.businessName.trim() || 'Product',
      source: 'product',
    }
  }
  const preview = data.previewImages.find((url) => Boolean(url?.trim()))
  if (preview?.trim()) {
    return {
      src: preview.trim(),
      productName: data.businessName.trim() || 'Product',
      source: 'preview',
    }
  }
  return { src: null, productName: '', source: 'fallback' }
}

function brandHandleFromName(name: string, domain: string): string {
  const fromName = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)
  if (fromName) return fromName
  const fromDomain = domain
    .toLowerCase()
    .replace(/\.[a-z.]+$/, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)
  return fromDomain || 'yourbrand'
}

function previewHeadline(data: OnboardingData): string {
  const pitch = data.pitch.trim()
  if (pitch) {
    const sentence = pitch.split(/[.!?]/)[0]?.trim() || pitch
    if (sentence.length <= 64) return sentence.endsWith('.') ? sentence : `${sentence}.`
    return `${sentence.slice(0, 61).trim()}…`
  }
  if (data.styleNotes.trim()) {
    const note = data.styleNotes.trim()
    return note.length <= 64 ? note : `${note.slice(0, 61).trim()}…`
  }
  if (data.category.trim()) return `Made for ${data.category.trim()}.`
  return 'Your brand, in every frame.'
}

function previewCtaLabel(data: OnboardingData, productName: string): string {
  const raw = data.ctaPreferences.trim()
  if (raw) {
    const first = raw.split(/[·|,]/)[0]?.trim()
    if (first) return first.length > 28 ? `${first.slice(0, 25).trim()}…` : first
  }
  if (productName) {
    const short = productName.length > 22 ? `${productName.slice(0, 19).trim()}…` : productName
    return `Shop ${short}`
  }
  return 'Shop now'
}

function contrastOn(hex: string): string {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim())
  if (!m) return '#ffffff'
  const n = parseInt(m[1], 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.62 ? '#0a0a0a' : '#ffffff'
}

function BrandLivePreview({ data }: { data: OnboardingData }) {
  const domain = domainFromUrl(data.websiteUrl)
  const visual = pickBrandPreviewVisual(data)
  const [imgFailed, setImgFailed] = useState(false)
  const [failedSrc, setFailedSrc] = useState('')
  const showPhoto = Boolean(visual.src) && !(imgFailed && failedSrc === visual.src)
  const name = data.businessName.trim() || 'Your brand'
  const handle = brandHandleFromName(name, domain)
  const colors = (data.brandColors.length ? data.brandColors : ['#0A0A0A', '#3F3F46', '#A1A1AA', '#F4F4F5']).slice(
    0,
    4,
  )
  const primary = colors[0] || '#0A0A0A'
  const secondary = colors[1] || colors[0] || '#3F3F46'
  const accent = colors[2] || colors[0] || '#A1A1AA'
  const soft = colors[3] || '#F4F4F5'
  const headline = previewHeadline(data)
  const cta = previewCtaLabel(data, visual.productName)
  const displayFont = data.brandFonts[0] || 'Georgia, "Times New Roman", serif'

  return (
    <div className="ob-brand-live">
      <div className="ob-brand-live-card">
        <div className="ob-brand-live-top">
          <div className="ob-brand-live-id">
            {data.logoUrl ? (
              <img src={data.logoUrl} alt="" />
            ) : (
              <span style={{ background: primary }}>{name.slice(0, 2).toUpperCase()}</span>
            )}
            <strong>@{handle}</strong>
          </div>
          <span className="ob-live-pill">
            <i /> Live
          </span>
        </div>

        <div className="ob-brand-live-stage">
          {showPhoto ? (
            <img
              key={visual.src!}
              src={visual.src!}
              alt=""
              className="ob-brand-live-photo"
              onError={() => {
                setImgFailed(true)
                setFailedSrc(visual.src || '')
              }}
            />
          ) : (
            <div
              className="ob-brand-live-fallback"
              style={{
                background: `linear-gradient(155deg, ${soft} 0%, ${accent} 42%, ${secondary} 100%)`,
              }}
              aria-hidden="true"
            >
              <div
                className="ob-brand-live-silhouette"
                style={{
                  background: `linear-gradient(180deg, ${primary} 0%, ${secondary} 100%)`,
                  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.22)',
                }}
              />
              <span className="ob-brand-live-sample">Sample preview</span>
            </div>
          )}
          <div className="ob-brand-live-overlay">
            <p className="ob-brand-live-headline" style={{ fontFamily: displayFont }}>
              {headline}
            </p>
            <span className="ob-brand-live-cta" style={{ background: primary, color: contrastOn(primary) }}>
              {cta}
            </span>
          </div>
        </div>

        <div className="ob-brand-live-colors">
          <span>Your colors</span>
          <div className="ob-swatches">
            {colors.map((c, i) => (
              <i key={`${c}-${i}`} style={{ background: c }} title={c} />
            ))}
          </div>
        </div>
      </div>
      <div className="ob-brand-live-note">
        <span className="ob-brand-live-check" aria-hidden="true">
          <CheckMark />
        </span>
        <p>The more accurate this is, the more on-brand every image, video and caption will be.</p>
      </div>
    </div>
  )
}

/** 4 — Confirm fetched brand kit (hero) */
const BRAND_REVIEW_TABS = [
  { id: 'identity', label: 'Identity' },
  { id: 'look', label: 'Colors & type' },
  { id: 'products', label: 'Products' },
] as const

type BrandReviewTabId = (typeof BRAND_REVIEW_TABS)[number]['id']

export function BrandStep({
  data,
  patch,
  marketInput,
  setMarketInput,
  fontInput,
  setFontInput,
}: {
  data: OnboardingData
  patch: Patch
  marketInput: string
  setMarketInput: (v: string) => void
  fontInput: string
  setFontInput: (v: string) => void
}) {
  const found = (f: string) => data.foundFields.includes(f)
  const domain = domainFromUrl(data.websiteUrl)
  const [reviewTab, setReviewTab] = useState<BrandReviewTabId>('identity')

  function setColor(index: number, value: string) {
    const next = [...data.brandColors]
    next[index] = value
    patch({ brandColors: next })
  }

  const tabActive = (id: BrandReviewTabId) =>
    reviewTab === id ? 'ob-brand-block is-active' : 'ob-brand-block'

  return (
    <div className="ob-brand-review ob-rise">
      <header className="ob-brand-review-head">
        <span className="ob-chip-label">Review brand</span>
        <h1 className="ob-title">Confirm your brand kit</h1>
        <p className="ob-sub">
          {data.websiteUrl.trim()
            ? `Drafted from ${domain}. Verified fields come from your site; AI-inferred fields show their evidence — edit anything.`
            : 'Fill this in carefully — it drives every image and video in your workspace.'}
        </p>
      </header>

      <div className="ob-brand-tabs" role="tablist" aria-label="Brand kit sections">
        {BRAND_REVIEW_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={reviewTab === tab.id}
            className={`ob-brand-tab${reviewTab === tab.id ? ' is-active' : ''}`}
            onClick={() => setReviewTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className={`ob-brand-review-layout${
          reviewTab === 'products' ? ' is-products-only' : ''
        }`}
      >
      <section className="ob-card-panel ob-brand-kit">
        <div className={tabActive('identity')}>
          <div className="ob-brand-block-label">
            <h2>Brand Identity</h2>
            <p>Logo, name, niche, and how you describe the business.</p>
          </div>
          <div className="ob-identity">
            <label className="ob-logo-tile">
              <span className="ob-lbl">
                Logo <Found show={found('logoUrl')} />
              </span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file || file.size > 5 * 1024 * 1024) return
                  const reader = new FileReader()
                  reader.onload = () => {
                    if (typeof reader.result === 'string') patch({ logoUrl: reader.result })
                  }
                  reader.readAsDataURL(file)
                }}
              />
              {data.logoUrl ? (
                <img src={data.logoUrl} alt="" />
              ) : (
                <span className="ob-logo-fallback">
                  {(data.businessName || 'L').slice(0, 2).toUpperCase()}
                </span>
              )}
            </label>
            <div className="ob-identity-fields">
              <label className="ob-field">
                <span>
                  Business name <Found show={found('businessName')} />{' '}
                  <EvidenceBadge
                    status={kitField(data, 'brandName')?.status}
                    evidence={kitField(data, 'brandName')?.evidence}
                  />
                </span>
                <input
                  value={data.businessName}
                  onChange={(e) => patch({ businessName: e.target.value })}
                />
              </label>
              <CategoryPicker
                value={data.category}
                industry={data.industry}
                found={found('category')}
                onSelect={({ category, industry }) => patch({ category, industry })}
              />
              <label className="ob-field">
                <span>
                  Niche{' '}
                  <EvidenceBadge
                    status={kitField(data, 'niche')?.status}
                    evidence={kitField(data, 'niche')?.evidence}
                  />
                </span>
                <input
                  value={data.niche}
                  onChange={(e) => patch({ niche: e.target.value })}
                  placeholder="e.g. clean beauty for South Asian skin"
                />
              </label>
              <label className="ob-field">
                <span>
                  Elevator pitch <Found show={found('pitch')} />{' '}
                  <EvidenceBadge
                    status={kitField(data, 'description')?.status}
                    evidence={kitField(data, 'description')?.evidence}
                  />
                </span>
                <textarea
                  rows={3}
                  value={data.pitch}
                  onChange={(e) => patch({ pitch: e.target.value })}
                />
              </label>
            </div>
          </div>
        </div>

        <div className={tabActive('identity')}>
          <div className="ob-brand-block-label">
            <h2>
              Audience & Positioning <Found show={found('audienceSummary')} />
            </h2>
            <p>Who creatives should speak to — age, gender, and intent.</p>
          </div>
          <label className="ob-field">
            <span>Audience summary</span>
            <input
              value={data.audienceSummary}
              onChange={(e) => patch({ audienceSummary: e.target.value })}
              placeholder="Men 22 to 40 in Pakistan shopping for grooming essentials"
            />
          </label>
          <div className="ob-brand-3col">
            <label className="ob-field">
              <span>Age from</span>
              <input
                value={data.audienceAgeFrom}
                onChange={(e) => patch({ audienceAgeFrom: e.target.value })}
                inputMode="numeric"
              />
            </label>
            <label className="ob-field">
              <span>Age to</span>
              <input
                value={data.audienceAgeTo}
                onChange={(e) => patch({ audienceAgeTo: e.target.value })}
                inputMode="numeric"
              />
            </label>
            <label className="ob-field">
              <span>Gender focus</span>
              <select
                value={data.audienceGender}
                onChange={(e) => patch({ audienceGender: e.target.value })}
              >
                <option value="all">All</option>
                <option value="women">Women</option>
                <option value="men">Men</option>
              </select>
            </label>
          </div>
        </div>

        <div className={tabActive('identity')}>
          <div className="ob-brand-block-label">
            <h2>
              Sell markets <Found show={found('markets')} />
            </h2>
            <p>
              Countries or regions you sell into. Used for targeting language, currency cues, and
              campaign defaults — not ad accounts.
            </p>
          </div>
          <div className="ob-field">
            <div className="ob-chips">
              {data.markets.map((m) => (
                <button
                  key={m}
                  type="button"
                  className="ob-chip is-on"
                  onClick={() => patch({ markets: data.markets.filter((x) => x !== m) })}
                >
                  {m} ×
                </button>
              ))}
            </div>
            <div className="ob-market-suggestions">
              {['Pakistan', 'United Arab Emirates', 'Saudi Arabia', 'United Kingdom', 'United States', 'India']
                .filter((m) => !data.markets.includes(m))
                .slice(0, 4)
                .map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="ob-chip"
                    onClick={() => patch({ markets: [...data.markets, m].slice(0, 5) })}
                  >
                    + {m}
                  </button>
                ))}
            </div>
            <form
              className="ob-chip-add"
              onSubmit={(e) => {
                e.preventDefault()
                const next = marketInput
                  .trim()
                  .replace(/\s+/g, ' ')
                  .replace(/\b\w/g, (c) => c.toUpperCase())
                if (!next || data.markets.includes(next)) return
                patch({ markets: [...data.markets, next].slice(0, 5) })
                setMarketInput('')
              }}
            >
              <input
                value={marketInput}
                onChange={(e) => setMarketInput(e.target.value)}
                placeholder="+ Add another country"
              />
            </form>
          </div>
        </div>

        <div className={tabActive('look')}>
          <div className="ob-brand-block-label">
            <h2>
              Colors & type <Found show={found('brandColors') || found('brandFonts')} />
            </h2>
            <p>Edit anything — these lock into every image and video.</p>
          </div>
          <div className="ob-field">
            <span>Colors</span>
            <div className="ob-color-edit">
              {(data.brandColors.length ? data.brandColors : []).slice(0, 6).map((c, i) => (
                <label key={`${c}-${i}`} className="ob-color-swatch-edit">
                  <input
                    type="color"
                    value={/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#0A0A0A'}
                    onChange={(e) => setColor(i, e.target.value)}
                  />
                  <span>{c.toUpperCase()}</span>
                </label>
              ))}
              {!data.brandColors.length ? (
                <p className="ob-brand-empty">No colors found yet — pick some below.</p>
              ) : null}
              {data.brandColors.length < 6 ? (
                <button
                  type="button"
                  className="ob-color-add"
                  onClick={() =>
                    patch({
                      brandColors: [...data.brandColors, '#E5E5E5'].slice(0, 6),
                    })
                  }
                >
                  + Add
                </button>
              ) : null}
            </div>
          </div>
          <div className="ob-field">
            <span>Fonts</span>
            <div className="ob-chips">
              {data.brandFonts.map((f) => (
                <button
                  key={f}
                  type="button"
                  className="ob-chip is-on"
                  onClick={() =>
                    patch({ brandFonts: data.brandFonts.filter((x) => x !== f) })
                  }
                >
                  {f} ×
                </button>
              ))}
            </div>
            {!data.brandFonts.length ? (
              <p className="ob-brand-empty">No fonts found yet — add one below.</p>
            ) : null}
            <form
              className="ob-chip-add"
              onSubmit={(e) => {
                e.preventDefault()
                const next = fontInput.trim()
                if (!next || data.brandFonts.includes(next)) return
                patch({ brandFonts: [...data.brandFonts, next].slice(0, 3) })
                setFontInput('')
              }}
            >
              <input
                value={fontInput}
                onChange={(e) => setFontInput(e.target.value)}
                placeholder="+ Add font name"
              />
            </form>
          </div>
          <label className="ob-field">
            <span>Voice</span>
            <select
              value={data.brandVoice}
              onChange={(e) => patch({ brandVoice: e.target.value })}
            >
              {BRAND_TONE_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ob-field">
            <span>Style notes</span>
            <textarea
              rows={2}
              value={data.styleNotes}
              onChange={(e) => patch({ styleNotes: e.target.value })}
              placeholder="e.g. soft daylight, clean product shots, no neon"
            />
          </label>
        </div>

        <div
          className={`${tabActive('products')} ob-brand-block-last ob-brand-block-products`}
        >
          <div className="ob-brand-block-label ob-brand-block-label-row">
            <div>
              <h2>
                Product Identity <Found show={found('scannedProducts')} />
              </h2>
              <p>Pulled from your site — product appearance stays separate from brand styling.</p>
            </div>
            <span className="ob-meta">
              {data.scannedProducts.length
                ? `${data.scannedProducts.length} saved to workspace`
                : 'None found yet'}
            </span>
          </div>
          {data.scannedProducts.length ? (
            <div className="ob-product-strip">
              {data.scannedProducts
                .filter((p) => Boolean(p.imageUrl?.trim() || p.name?.trim()))
                .map((p) => (
                  <article key={p.id} className="ob-product-thumb" title={p.name}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <div className="ob-skel" aria-hidden="true" />
                    )}
                    <strong>{p.name}</strong>
                  </article>
                ))}
            </div>
          ) : (
            <p className="ob-brand-empty">
              No catalog products detected. You can add products later from the Products page.
            </p>
          )}
        </div>
      </section>

      {reviewTab === 'products' ? null : (
        <aside className="ob-brand-live-aside">
          <p className="ob-preview-label">Preview with your brand</p>
          <BrandLivePreview data={data} />
          {data.scannedProducts.some((p) => p.imageUrl) ? (
            <div className="ob-brand-live-products">
              <span>From your scan</span>
              <div className="ob-brand-live-product-row">
                {data.scannedProducts
                  .filter((p) => p.imageUrl)
                  .slice(0, 4)
                  .map((p) => (
                    <img key={p.id} src={p.imageUrl} alt="" title={p.name} />
                  ))}
              </div>
            </div>
          ) : null}
        </aside>
      )}
      </div>
    </div>
  )
}

/** 5 — Channels + main goal (short) */
export function GoalsStep({
  data,
  patch,
}: {
  data: OnboardingData
  patch: Patch
}) {
  function toggleChannel(id: ChannelId) {
    const on = data.channels.includes(id)
    patch({
      channels: on ? data.channels.filter((c) => c !== id) : [...data.channels, id],
    })
  }

  type ChannelOption = (typeof CHANNEL_GROUPS)[number]['items'][number]
  const featuredIds: ChannelId[] = ['ig', 'tt', 'meta', 'reels', 'fb', 'shop']
  const allChannels: ChannelOption[] = CHANNEL_GROUPS.flatMap(
    (g) => [...g.items] as ChannelOption[],
  )
  const featured = featuredIds
    .map((id) => allChannels.find((ch) => ch.id === id))
    .filter((ch): ch is ChannelOption => Boolean(ch))

  return (
    <div className="ob-split">
      <div className="ob-stack ob-rise">
        <div>
          <span className="ob-chip-label">Channels and goals</span>
          <h1 className="ob-title">Where should we focus first?</h1>
          <p className="ob-sub">
            Pick channels and a main goal. You can change these anytime — nothing posts until you
            approve it.
          </p>
        </div>

        <section className="ob-card-panel">
          <h2 className="ob-section-title">Main goal</h2>
          <div className="ob-goal-grid">
            {GOAL_OPTIONS.map((opt) => {
              const selected = data.goal === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`ob-goal-card${selected ? ' is-selected' : ''}`}
                  onClick={() => patch({ goal: opt.id as GoalId })}
                >
                  <strong>{opt.label}</strong>
                  <span>{opt.desc}</span>
                  {selected ? (
                    <span className="ob-check-dot">
                      <CheckMark />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>

        <section className="ob-card-panel">
          <h2 className="ob-section-title">Channels</h2>
          <div className="ob-channel-grid">
            {featured.map((ch) => {
              const on = data.channels.includes(ch.id)
              return (
                <button
                  key={ch.id}
                  type="button"
                  className={`ob-channel-chip${on ? ' is-selected' : ''}`}
                  onClick={() => toggleChannel(ch.id)}
                >
                  <span className="ob-channel-ab">{ch.ab}</span>
                  <span>{ch.name}</span>
                  <span className={`ob-check-dot${on ? ' is-on' : ''}`}>
                    {on ? <CheckMark /> : null}
                  </span>
                </button>
              )
            })}
          </div>
        </section>
      </div>
      <aside className="ob-helper-card ob-rise ob-d2">
        <strong>Almost there</strong>
        <p>
          Your brand kit stays with every image, video, and campaign Luce generates — including
          colors, voice, and positioning.
        </p>
        <ul className="ob-check-list">
          <li>Brand kit persisted</li>
          <li>Products saved to workspace</li>
          <li>Choose a plan next</li>
        </ul>
      </aside>
    </div>
  )
}

/** 6 — Launch / choose a plan */
export function PlanStep({
  data,
  patch,
  onStartTrial,
  busy,
}: {
  data: OnboardingData
  patch: Patch
  onStartTrial: () => void
  busy?: boolean
}) {
  const selected =
    PLANS.find((p) => p.id === data.plan) || PLANS.find((p) => p.recommended) || PLANS[1]!
  const price = data.billingYearly
    ? Math.round(selected.monthly * 0.8)
    : selected.monthly
  const trialEnd = trialEndLabel()
  const cardName =
    data.fullName.trim() ||
    [data.firstName, data.lastName].filter(Boolean).join(' ').trim() ||
    ''

  const weeklyCredits = 20
  const monthlyCredits = 80

  return (
    <div className="ob-plan-launch ob-rise">
      <div className="ob-plan-copy">
        <span className="ob-chip-label">Step · Launch</span>
        <h1 className="ob-title">Choose a plan to launch them</h1>
        <p className="ob-sub">
          Plans include monthly credits. 1 credit = 1 image. Start free, upgrade when you need
          more — cancel anytime before trial ends.
        </p>

        <div className="ob-plan-billing" role="group" aria-label="Billing period">
          <button
            type="button"
            className={!data.billingYearly ? 'is-active' : undefined}
            onClick={() => patch({ billingYearly: false })}
          >
            Monthly
          </button>
          <button
            type="button"
            className={data.billingYearly ? 'is-active' : undefined}
            onClick={() => patch({ billingYearly: true })}
          >
            Yearly — save ~20%
          </button>
        </div>

        <div className="ob-plan-usage">
          <span className="ob-plan-usage-ico" aria-hidden="true">
            ⚡
          </span>
          <p>
            A light first week is about <strong>{weeklyCredits} credits</strong> — roughly{' '}
            <strong>{monthlyCredits}/mo</strong>. Starter covers that; Growth gives room to ship
            weekly.
          </p>
        </div>

        <div className="ob-plan-cards" role="radiogroup" aria-label="Plans">
          {PLANS.map((plan) => {
            const active = selected.id === plan.id
            const planPrice = data.billingYearly
              ? Math.round(plan.monthly * 0.8)
              : plan.monthly
            return (
              <button
                key={plan.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={`ob-plan-card${active ? ' is-selected' : ''}${plan.recommended ? ' is-recommended' : ''}`}
                onClick={() => patch({ plan: plan.id })}
              >
                <div className="ob-plan-card-top">
                  <div>
                    <strong>{plan.name}</strong>
                    {plan.recommended ? <em>Recommended</em> : null}
                  </div>
                  <span className={`ob-check-dot${active ? ' is-on' : ''}`}>
                    {active ? <CheckMark /> : null}
                  </span>
                </div>
                <p className="ob-plan-price">
                  <b>${planPrice}</b>
                  <span>/mo</span>
                </p>
                <p className="ob-plan-credits">{plan.credits} credits / month</p>
                <ul>
                  {plan.feats.map((feat) => (
                    <li key={feat}>{feat}</li>
                  ))}
                </ul>
                {plan.tag && !plan.recommended ? (
                  <span className="ob-plan-tag">{plan.tag}</span>
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="ob-plan-shared">
          {PLAN_SHARED_FEATURES.map((feat) => (
            <div key={feat} className="ob-plan-shared-item">
              <span aria-hidden="true">✓</span>
              <p>{feat}</p>
            </div>
          ))}
        </div>
      </div>

      <aside className="ob-plan-checkout">
        <h2>Order summary</h2>
        <div className="ob-plan-summary">
          <div>
            <span>{selected.name} plan</span>
            <strong>${price}</strong>
          </div>
          <div>
            <span>Free trial</span>
            <strong className="is-credit">−${price}</strong>
          </div>
          <div className="ob-plan-due">
            <span>Due today</span>
            <strong>$0.00</strong>
          </div>
        </div>
        <p className="ob-plan-trial-note">
          Then ${price} a month from {trialEnd}. We&apos;ll remind you 2 days before.
        </p>

        <form
          className="ob-plan-pay"
          onSubmit={(e) => {
            e.preventDefault()
            onStartTrial()
          }}
        >
          <label>
            Card number
            <input
              inputMode="numeric"
              autoComplete="cc-number"
              placeholder="ACCT-000015"
              disabled={busy}
            />
          </label>
          <div className="ob-plan-pay-row">
            <label>
              Expiry
              <input
                inputMode="numeric"
                autoComplete="cc-exp"
                placeholder="MM / YY"
                disabled={busy}
              />
            </label>
            <label>
              CVC
              <input
                inputMode="numeric"
                autoComplete="cc-csc"
                placeholder="123"
                disabled={busy}
              />
            </label>
          </div>
          <label>
            Name on card
            <input
              autoComplete="cc-name"
              defaultValue={cardName}
              placeholder="Name on card"
              disabled={busy}
            />
          </label>
          <button type="submit" className="ob-plan-start" disabled={busy}>
            <span aria-hidden="true">🔒</span>
            {busy ? 'Launching…' : 'Start free trial and launch'}
          </button>
        </form>
        <p className="ob-plan-secure">
          Secure checkout. Your card is never stored on Luce servers.
        </p>
      </aside>
    </div>
  )
}

function trialEndLabel() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
