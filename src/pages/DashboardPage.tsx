import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import { listUserCampaigns, type CampaignDoc } from '../lib/campaigns'

const TOOLS = [
  {
    to: '/app/campaigns/new',
    title: 'Campaign',
    copy: 'Full pack from one product',
    image: '/images/campaign-perfume-studio.jpg',
  },
  {
    to: '/app/studio/photos',
    title: 'Photos',
    copy: 'Professional product shots',
    image: '/images/moisturizer-studio.jpg',
  },
  {
    to: '/app/studio/videos',
    title: 'Videos',
    copy: 'UGC and short-form',
    image: '/images/output-ugc.jpg',
  },
  {
    to: '/app/studio/ads',
    title: 'Ads',
    copy: 'Creatives and copy',
    image: '/images/output-ads.jpg',
  },
] as const

const PROJECT_COVER: Record<string, string> = {
  campaign: '/images/campaign-beauty-flatlay.jpg',
  photos: '/images/fidelity-studio.jpg',
  videos: '/images/campaign-ugc-serum.jpg',
  ads: '/images/moisturizer-ad-glow.jpg',
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ')
}

function formatUpdated(campaign: CampaignDoc) {
  const ms = campaign.updatedAt?.toMillis?.()
  if (!ms) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
    }).format(new Date(ms))
  } catch {
    return ''
  }
}

function modeKey(campaign: CampaignDoc) {
  if (campaign.mode === 'studio' && campaign.studioKind) return campaign.studioKind
  return 'campaign'
}

function modeLabel(campaign: CampaignDoc) {
  const key = modeKey(campaign)
  if (key === 'photos') return 'Photos'
  if (key === 'videos') return 'Videos'
  if (key === 'ads') return 'Ads'
  return 'Campaign'
}

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<CampaignDoc[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [listing, setListing] = useState(true)
  const [quickUrl, setQuickUrl] = useState('')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listUserCampaigns(user.uid)
        if (!cancelled) setCampaigns(rows)
      } catch (err) {
        console.error(err)
        if (!cancelled) setListError('Could not load projects.')
      } finally {
        if (!cancelled) setListing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  if (loading) {
    return (
      <div className="studio-shell studio-shell-alone">
        <p className="app-loading">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const firstName = user.displayName?.split(' ')[0]

  function startFromUrl(e: FormEvent) {
    e.preventDefault()
    const value = quickUrl.trim()
    if (!value) {
      navigate('/app/campaigns/new')
      return
    }
    try {
      sessionStorage.setItem('luce.pendingProductUrl', value)
    } catch {
      /* ignore */
    }
    navigate('/app/campaigns/new')
  }

  return (
    <AppLayout>
      <main className="studio-home">
        <header className="studio-home-head">
          <h1>
            {greeting()}
            {firstName ? `, ${firstName}` : ''}
          </h1>
          <p className="studio-home-lede">Create a campaign, or start with photos, video, or ads.</p>
        </header>

        <section className="studio-start" aria-label="Start">
          <form className="studio-start-form" onSubmit={startFromUrl}>
            <input
              type="url"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              placeholder="Paste product URL"
              aria-label="Product URL"
            />
            <button type="submit" className="btn btn-grad">
              Continue
            </button>
          </form>
          <Link className="studio-start-alt" to="/app/studio/photos">
            Upload photo
          </Link>
        </section>

        <section className="studio-tools" aria-labelledby="studio-tools-title">
          <h2 id="studio-tools-title" className="studio-h2">
            Create
          </h2>
          <div className="studio-tool-grid">
            {TOOLS.map((tool) => (
              <Link key={tool.to} className="studio-tool" to={tool.to}>
                <div className="studio-tool-media">
                  <img src={tool.image} alt="" />
                </div>
                <div className="studio-tool-body">
                  <strong>{tool.title}</strong>
                  <span>{tool.copy}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="studio-projects" aria-labelledby="studio-projects-title">
          <div className="studio-section-row">
            <h2 id="studio-projects-title" className="studio-h2">
              Projects
            </h2>
            {!listing && campaigns.length > 0 ? (
              <span className="studio-meta">{campaigns.length}</span>
            ) : null}
          </div>

          {listing && <p className="studio-muted">Loading…</p>}
          {listError && (
            <p className="auth-error" role="alert">
              {listError}
            </p>
          )}

          {!listing && !listError && campaigns.length === 0 && (
            <div className="studio-empty">
              <p>No projects yet. Start with a product URL or photo.</p>
              <Link className="btn btn-grad" to="/app/campaigns/new">
                New campaign
              </Link>
            </div>
          )}

          {!listing && campaigns.length > 0 && (
            <ul className="studio-project-grid">
              {campaigns.map((c) => {
                const key = modeKey(c)
                return (
                  <li key={c.id}>
                    <Link className="studio-project-card" to={`/app/campaigns/${c.id}`}>
                      <div className="studio-project-cover">
                        <img src={PROJECT_COVER[key] || PROJECT_COVER.campaign} alt="" />
                      </div>
                      <div className="studio-project-body">
                        <span className="studio-project-type">{modeLabel(c)}</span>
                        <h3>{c.title}</h3>
                        <p>
                          {statusLabel(c.status)}
                          {formatUpdated(c) ? ` · ${formatUpdated(c)}` : ''}
                        </p>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      </main>
    </AppLayout>
  )
}
