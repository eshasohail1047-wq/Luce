import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import { planLabel as formatPlanLabel } from '../lib/plans'
import {
  BRAND_TONE_OPTIONS,
  formatBrandDisplayName,
  sellTypeLabel,
  workspaceInitials,
} from '../lib/userSettings'

export default function BrandKitPage() {
  const { user, loading, workspace, plan, updateWorkspace } = useAuth()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [logoFailed, setLogoFailed] = useState(false)

  const [brandName, setBrandName] = useState('')
  const [brandPitch, setBrandPitch] = useState('')
  const [brandTone, setBrandTone] = useState('premium')
  const [brandFonts, setBrandFonts] = useState('')
  const [brandStyleNotes, setBrandStyleNotes] = useState('')
  const [brandColors, setBrandColors] = useState<string[]>([])

  useEffect(() => {
    setBrandName(workspace.brandName)
    setBrandPitch(workspace.brandPitch)
    setBrandTone(workspace.brandVoice || workspace.brandTone)
    setBrandFonts((workspace.brandFonts || []).join(', '))
    setBrandStyleNotes(workspace.brandStyleNotes)
    setBrandColors(
      workspace.brandColors?.length
        ? [...workspace.brandColors]
        : ['#0A0A0A', '#71717A', '#D4D4D8', '#FAFAFA'],
    )
    setLogoFailed(false)
  }, [workspace])

  const name = formatBrandDisplayName(workspace.brandName)
  const initials = workspaceInitials(name)
  const website = workspace.brandWebsite.trim().replace(/^https?:\/\//, '')
  const industry = workspace.brandIndustry.trim()
  const sell = sellTypeLabel(workspace.brandSellType)
  const colors =
    workspace.brandColors?.length > 0
      ? workspace.brandColors
      : ['#0A0A0A', '#71717A', '#D4D4D8', '#FAFAFA']
  const fonts = workspace.brandFonts?.length ? workspace.brandFonts : ['Geist', 'Inter']
  const tone =
    BRAND_TONE_PILLS[workspace.brandVoice || workspace.brandTone] ||
    BRAND_TONE_PILLS.premium

  const accent = colors.find((c) => !isNearWhite(c) && !isNearBlack(c)) || colors[1] || '#338FB1'
  const deep = colors.find((c) => isNearBlack(c)) || colors[0] || '#17171f'
  const soft = colors.find((c) => !isNearBlack(c) && c !== accent) || colors[2] || '#FED3C6'

  const themeStyle = useMemo(
    () =>
      ({
        '--bk-accent': accent,
        '--bk-deep': deep,
        '--bk-soft': soft,
        '--bk-wash-a': hexToRgba(accent, 0.28),
        '--bk-wash-b': hexToRgba(soft, 0.34),
        '--bk-wash-c': hexToRgba(deep, 0.08),
      }) as CSSProperties,
    [accent, deep, soft],
  )

  if (loading) {
    return (
      <div className="studio-shell studio-shell-alone">
        <p className="app-loading">Loading…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  async function onSave(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    setMsg(null)
    try {
      const parsedFonts = brandFonts
        .split(/[,|]/)
        .map((f) => f.trim())
        .filter(Boolean)
      await updateWorkspace({
        brandName: brandName.trim(),
        brandPitch: brandPitch.trim(),
        brandTone,
        brandVoice: brandTone,
        brandFonts: parsedFonts.length ? parsedFonts : ['Outfit', 'Inter'],
        brandStyleNotes: brandStyleNotes.trim(),
        brandColors: brandColors.slice(0, 6),
      })
      setMsg('Brand kit saved')
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save brand kit.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppLayout>
      <main className="brand-kit" style={themeStyle}>
        <header className="brand-kit-top">
          <div>
            <h1>Brand kit</h1>
            <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
              Applied to every new image, video, and caption
            </p>
          </div>
          <div className="brand-kit-top-actions">
            <button
              type="button"
              className="brand-kit-ghost"
              onClick={() => {
                setEditing((v) => !v)
                setMsg(null)
                setError(null)
              }}
            >
              {editing ? 'Cancel' : 'Edit kit'}
            </button>
            <Link to="/app/plans" className="brand-kit-ghost">
              Plans & credits
            </Link>
          </div>
        </header>

        {error ? (
          <p className="ob-error" role="alert">
            {error}
          </p>
        ) : null}
        {msg ? (
          <p className="settings-success" role="status">
            {msg}
          </p>
        ) : null}

        {editing ? (
          <form className="brand-kit-edit" onSubmit={(e) => void onSave(e)}>
            <section className="brand-kit-panel">
              <div className="brand-kit-panel-head">
                <h2>Edit brand kit</h2>
              </div>
              <div className="settings-form-row">
                <div className="auth-field">
                  <label htmlFor="bk-name">Brand name</label>
                  <input
                    id="bk-name"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    disabled={busy}
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="bk-tone">Voice</label>
                  <select
                    id="bk-tone"
                    value={brandTone}
                    onChange={(e) => setBrandTone(e.target.value)}
                    disabled={busy}
                  >
                    {BRAND_TONE_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="auth-field">
                <label htmlFor="bk-pitch">Pitch</label>
                <textarea
                  id="bk-pitch"
                  rows={3}
                  value={brandPitch}
                  onChange={(e) => setBrandPitch(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="auth-field">
                <label htmlFor="bk-fonts">Fonts (comma-separated)</label>
                <input
                  id="bk-fonts"
                  value={brandFonts}
                  onChange={(e) => setBrandFonts(e.target.value)}
                  disabled={busy}
                  placeholder="Outfit, Inter"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="bk-notes">Style notes</label>
                <textarea
                  id="bk-notes"
                  rows={2}
                  value={brandStyleNotes}
                  onChange={(e) => setBrandStyleNotes(e.target.value)}
                  disabled={busy}
                />
              </div>
              <div className="ob-color-edit" style={{ marginTop: 8 }}>
                {brandColors.slice(0, 4).map((c, i) => (
                  <label key={i} className="ob-color-swatch-edit">
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(c) ? c : '#7c3aed'}
                      onChange={(e) => {
                        const next = [...brandColors]
                        next[i] = e.target.value
                        setBrandColors(next)
                      }}
                      disabled={busy}
                    />
                    <span>{c.toUpperCase()}</span>
                  </label>
                ))}
              </div>
              <div className="brand-kit-cta-row" style={{ marginTop: 16 }}>
                <button type="submit" className="brand-kit-cta" disabled={busy}>
                  {busy ? 'Saving…' : 'Save brand kit'}
                </button>
              </div>
            </section>
          </form>
        ) : (
          <>
            <div className="bk-lookbook">
              <div className="bk-lookbook-col">
                <section className="bk-panel" aria-label="Identity">
                  <div className="brand-kit-card-head">
                    <h2>Identity</h2>
                    <button type="button" className="brand-kit-ghost" onClick={() => setEditing(true)}>
                      Edit
                    </button>
                  </div>
                  <div className="bk-hero">
                    <div className="bk-hero-mark">
                      {workspace.brandLogoUrl && !logoFailed ? (
                        <img
                          src={workspace.brandLogoUrl}
                          alt=""
                          onError={() => setLogoFailed(true)}
                        />
                      ) : (
                        <span>{initials}</span>
                      )}
                    </div>
                    <div className="bk-hero-copy">
                      <p className="bk-hero-meta">
                        {[industry, sell].filter(Boolean).join(' · ') || 'Your brand'}
                      </p>
                      <h2>{name || 'Your brand'}</h2>
                      {website ? (
                        <a
                          className="bk-hero-link"
                          href={`https://${website}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {website}
                        </a>
                      ) : (
                        <span className="bk-hero-link is-muted">Add your website</span>
                      )}
                      {workspace.brandPitch ? (
                        <p className="bk-hero-pitch">{workspace.brandPitch}</p>
                      ) : (
                        <p className="bk-hero-pitch is-empty">
                          No pitch yet — finish onboarding or edit this kit.
                        </p>
                      )}
                    </div>
                  </div>
                </section>

                <section className="bk-panel" aria-labelledby="bk-fonts-title">
                  <div className="bk-section-head">
                    <h3 id="bk-fonts-title">Typography</h3>
                    <p>Headlines on images · Captions and body</p>
                  </div>
                  <div className="bk-fonts">
                    {fonts.map((f, i) => (
                      <div key={f} className={`bk-font-sample${i === 0 ? ' is-display' : ''}`}>
                        <em>{i === 0 ? 'Headlines on images' : 'Captions and body'}</em>
                        <strong style={{ fontFamily: `"${f}", var(--font-display), sans-serif` }}>
                          {f}
                        </strong>
                        <span style={{ fontFamily: `"${f}", var(--font-sans), sans-serif` }}>
                          The quick creative stays on brand.
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bk-panel" aria-labelledby="bk-refs-title">
                  <div className="bk-section-head">
                    <h3 id="bk-refs-title">Reference images</h3>
                    <p>Shots from your site. Luce matches their light, framing and mood.</p>
                  </div>
                  {workspace.brandScannedProducts.some((p) => p.imageUrl) ? (
                    <div className="bk-refs">
                      {workspace.brandScannedProducts
                        .filter((p) => p.imageUrl)
                        .slice(0, 6)
                        .map((p) => (
                          <figure key={p.id}>
                            <img src={p.imageUrl} alt={p.name} loading="lazy" />
                          </figure>
                        ))}
                    </div>
                  ) : (
                    <p className="bk-hero-pitch is-empty">
                      Re-scan your website or upload product photos to build references.
                    </p>
                  )}
                </section>
              </div>

              <div className="bk-lookbook-col">
                <section className="bk-panel" aria-labelledby="bk-palette-title">
                  <div className="bk-section-head">
                    <h3 id="bk-palette-title">Colors</h3>
                    <p>Applied to every new creative</p>
                  </div>
                  <div className="bk-palette-strip">
                    {colors.map((c) => (
                      <div key={c} className="bk-palette-chip">
                        <span className="bk-palette-swatch" style={{ background: c }} />
                        <strong>{c.toUpperCase()}</strong>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="bk-panel" aria-labelledby="bk-voice-title">
                  <div className="bk-section-head">
                    <h3 id="bk-voice-title">Voice and tone</h3>
                    <p>Shapes every caption and CTA</p>
                  </div>
                  <div className="bk-voice-pills">
                    {tone.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                  {workspace.brandStyleNotes ? (
                    <p className="bk-voice-notes">{workspace.brandStyleNotes}</p>
                  ) : (
                    <div className="bk-say-avoid">
                      <div>
                        <strong className="is-say">Say</strong>
                        <p>Product-true, clear benefits, sensory detail</p>
                      </div>
                      <div>
                        <strong className="is-avoid">Avoid</strong>
                        <p>
                          {workspace.brandThingsToAvoid.length
                            ? workspace.brandThingsToAvoid.slice(0, 3).join(', ')
                            : 'Generic AI hype, discount-first language'}
                        </p>
                      </div>
                    </div>
                  )}
                </section>

                <section className="bk-panel" aria-labelledby="bk-look-title">
                  <div className="bk-section-head">
                    <h3 id="bk-look-title">Default look</h3>
                    <p>Photography direction for new generations</p>
                  </div>
                  <div className="bk-default-look">
                    {workspace.brandScannedProducts.find((p) => p.imageUrl)?.imageUrl ? (
                      <img
                        src={workspace.brandScannedProducts.find((p) => p.imageUrl)!.imageUrl}
                        alt=""
                      />
                    ) : (
                      <span>{initials}</span>
                    )}
                    <div>
                      <strong>
                        {workspace.brandPhotographyStyle || 'Soft studio'}
                      </strong>
                      <p>
                        {[
                          workspace.brandLighting,
                          workspace.brandComposition,
                          workspace.brandPackagingIdentity,
                        ]
                          .filter(Boolean)
                          .join(' · ') || 'Clean neutral · Product locked'}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="bk-panel" aria-labelledby="bk-markets-title">
                  <div className="bk-section-head">
                    <h3 id="bk-markets-title">Audience & markets</h3>
                  </div>
                  {workspace.brandMarkets.length ? (
                    <div className="bk-voice-pills">
                      {workspace.brandMarkets.map((m) => (
                        <span key={m}>{m}</span>
                      ))}
                    </div>
                  ) : (
                    <p className="bk-hero-pitch is-empty">No markets saved yet.</p>
                  )}
                  {workspace.brandAudience ? (
                    <p className="bk-voice-notes">{workspace.brandAudience}</p>
                  ) : null}
                </section>
              </div>
            </div>

            <section className="bk-footer">
              <div>
                <p className="bk-footer-plan">
                  Plan · <strong>{formatPlanLabel(plan)}</strong>
                </p>
                <p>Image Studio, Video Studio, and Full Campaign all pull from this kit.</p>
              </div>
              <div className="brand-kit-cta-row">
                <Link className="brand-kit-cta" to="/app/studio/photos">
                  Open Image Studio
                </Link>
                <Link className="brand-kit-ghost" to="/app/plans">
                  Plans & credits
                </Link>
              </div>
            </section>
          </>
        )}
      </main>
    </AppLayout>
  )
}

const BRAND_TONE_PILLS: Record<string, string[]> = {
  premium: ['Refined', 'Warm', 'Confident', 'Product-true'],
  playful: ['Bold', 'Playful', 'Energetic', 'Social'],
  minimal: ['Minimal', 'Clean', 'Quiet', 'Clear'],
  clinical: ['Trusted', 'Clear', 'Clinical', 'Precise'],
}

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '').trim()
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return `rgba(51, 143, 177, ${alpha})`
  const n = parseInt(full, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function isNearWhite(hex: string): boolean {
  const { r, g, b } = parseRgb(hex)
  return (r + g + b) / 3 > 235
}

function isNearBlack(hex: string): boolean {
  const { r, g, b } = parseRgb(hex)
  return (r + g + b) / 3 < 40
}

function parseRgb(hex: string): { r: number; g: number; b: number } {
  const raw = hex.replace('#', '').trim()
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((c) => c + c)
          .join('')
      : raw
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return { r: 0, g: 0, b: 0 }
  const n = parseInt(full, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}
