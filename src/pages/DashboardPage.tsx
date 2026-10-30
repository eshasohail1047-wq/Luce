import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CreativeShowcase from '../components/CreativeShowcase'
import { useAuth } from '../auth/AuthProvider'
import { useCampaignCovers } from '../hooks/useCampaignCovers'
import {
  getProductsByIds,
  listUserCampaigns,
  type CampaignDoc,
  type ProductSummary,
} from '../lib/campaigns'

type StartSource = 'upload' | 'url' | null

const DESTINATIONS = [
  { to: '/app/studio/photos', title: 'Images' },
  { to: '/app/studio/videos', title: 'Videos' },
  { to: '/app/campaigns/new', title: 'Full Campaign' },
]

function formatRelative(ts?: { toMillis?: () => number } | null) {
  const ms = ts?.toMillis?.()
  if (!ms) return 'Recently'
  const diff = Date.now() - ms
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return mins <= 1 ? 'Just now' : `${mins} min ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`
  const days = Math.floor(hours / 24)
  if (days === 1) return '1 day ago'
  if (days < 14) return `${days} days ago`
  return new Date(ms).toLocaleDateString()
}

function projectKind(c: CampaignDoc) {
  if (c.mode === 'studio' && c.studioKind === 'photos') return 'Images'
  if (c.mode === 'studio' && c.studioKind === 'videos') return 'Video'
  return 'Campaign'
}

function projectKindLabel(c: CampaignDoc) {
  if (c.mode === 'studio' && c.studioKind === 'photos') return 'Product Images'
  if (c.mode === 'studio' && c.studioKind === 'videos') return 'Product Videos'
  return 'Full Campaign'
}

function destinationHref(base: string, source: StartSource) {
  if (!source) return base
  const join = base.includes('?') ? '&' : '?'
  return `${base}${join}source=${source}`
}

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const firstName =
    user?.displayName?.trim()?.split(/\s+/)[0] ||
    user?.email?.split('@')[0] ||
    'there'

  const [campaigns, setCampaigns] = useState<CampaignDoc[]>([])
  const [productsById, setProductsById] = useState<Map<string, ProductSummary>>(new Map())
  const [listing, setListing] = useState(true)
  const [startSource, setStartSource] = useState<StartSource>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listUserCampaigns(user.uid)
        if (cancelled) return
        setCampaigns(rows)
        const productMap = await getProductsByIds(rows.map((c) => c.productId))
        if (!cancelled) setProductsById(productMap)
      } catch (err) {
        console.error(err)
      } finally {
        if (!cancelled) setListing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const recent = useMemo(() => campaigns.slice(0, 3), [campaigns])
  const covers = useCampaignCovers(recent, productsById)

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

  const choosing = startSource !== null

  return (
    <AppLayout>
      <main className="dash dash-home">
        <section className="dash-home-hero" aria-labelledby="dash-hero-title">
          <h1 id="dash-hero-title" className="dash-home-title">
            Create <em>your creatives</em>
            {firstName !== 'there' ? `, ${firstName}` : ''}
          </h1>

          <div className="dash-home-composer" data-open={choosing ? 'true' : 'false'}>
            <div className="dash-home-entry" role="group" aria-label="How to start">
              <button
                type="button"
                className={`dash-home-entry-btn${startSource === 'upload' ? ' is-active' : ''}`}
                aria-pressed={startSource === 'upload'}
                onClick={() => setStartSource((s) => (s === 'upload' ? null : 'upload'))}
              >
                <span className="dash-home-entry-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path
                      d="M12 16V8m0 0 3 3m-3-3-3 3M5 19h14a2 2 0 0 0 2-2V9.5A2.5 2.5 0 0 0 18.5 7H16l-1.5-2h-5L8 7H5.5A2.5 2.5 0 0 0 3 9.5V17a2 2 0 0 0 2 2Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <strong>Upload product</strong>
              </button>

              <span className="dash-home-or">or</span>

              <button
                type="button"
                className={`dash-home-entry-btn${startSource === 'url' ? ' is-active' : ''}`}
                aria-pressed={startSource === 'url'}
                onClick={() => setStartSource((s) => (s === 'url' ? null : 'url'))}
              >
                <span className="dash-home-entry-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path
                      d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                    <path
                      d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07L13 19"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <strong>Paste URL</strong>
              </button>
            </div>

            {choosing ? (
              <div className="dash-home-dest" role="region" aria-label="Choose what to create">
                <div className="dash-home-dest-head">
                  <strong>Choose a studio</strong>
                  <button
                    type="button"
                    className="dash-home-dest-close"
                    onClick={() => setStartSource(null)}
                  >
                    Cancel
                  </button>
                </div>
                <div className="dash-home-dest-grid">
                  {DESTINATIONS.map((dest) => (
                    <Link
                      key={dest.to}
                      to={destinationHref(dest.to, startSource)}
                      className="dash-home-dest-card"
                    >
                      <strong>{dest.title}</strong>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <CreativeShowcase />

        <section className="dash-home-recent" aria-labelledby="dash-recent-title">
          <div className="dash-home-recent-head">
            <h2 id="dash-recent-title">Recent projects</h2>
            <Link to="/app/campaigns">View all</Link>
          </div>

          {listing ? (
            <p className="dash-home-empty">Loading projects…</p>
          ) : recent.length === 0 ? (
            <div className="dash-home-empty-card">
              <p>No projects yet.</p>
            </div>
          ) : (
            <div className="dash-home-recent-grid">
              {recent.map((c) => {
                const cover = covers.get(c.id)
                const kind = projectKind(c)
                return (
                  <Link key={c.id} to={`/app/campaigns/${c.id}`} className="dash-home-recent-card">
                    <div className="dash-home-recent-media">
                      {cover ? (
                        <img src={cover} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <div className="dash-home-recent-fallback" aria-hidden="true" />
                      )}
                      <span className="dash-home-recent-tag">{kind}</span>
                    </div>
                    <div className="dash-home-recent-body">
                      <strong>{c.title || c.productName}</strong>
                      <span>
                        {projectKindLabel(c)} · {formatRelative(c.updatedAt)}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </AppLayout>
  )
}
