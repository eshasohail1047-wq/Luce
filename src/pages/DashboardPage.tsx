import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CampaignMediaCard from '../components/CampaignMediaCard'
import { useAuth } from '../auth/AuthProvider'
import { useCampaignCovers } from '../hooks/useCampaignCovers'
import {
  getProductsByIds,
  listUserCampaigns,
  type CampaignDoc,
  type ProductSummary,
} from '../lib/campaigns'
import { isPaidPlan } from '../lib/plans'

const RECOMMENDED = [
  {
    to: '/app/studio/photos',
    title: 'Create product images',
    description: 'Packshots, lifestyle, and promo frames from one product photo.',
    image: '/images/fidelity-studio.jpg',
    cta: 'Try it',
    accent: true,
    pro: false,
  },
  {
    to: '/app/studio/videos',
    title: 'Generate product videos',
    description: 'Turn your product photo into UGC-style and demo clips.',
    image: '/images/video-poster-ugc.jpg',
    cta: 'Try it',
    accent: false,
    pro: true,
  },
  {
    to: '/app/campaigns/new',
    title: 'Launch a full campaign',
    description: 'One product → images, videos, captions, and ads together.',
    image: '/images/campaign-beauty-flatlay.jpg',
    cta: 'Try it',
    accent: false,
    pro: true,
  },
] as const

export default function DashboardPage() {
  const { user, plan, loading } = useAuth()
  const [campaigns, setCampaigns] = useState<CampaignDoc[]>([])
  const [productsById, setProductsById] = useState<Map<string, ProductSummary>>(new Map())
  const [listError, setListError] = useState<string | null>(null)
  const [listing, setListing] = useState(true)
  const paid = isPaidPlan(plan)
  const firstName =
    user?.displayName?.trim()?.split(/\s+/)[0] ||
    user?.email?.split('@')[0] ||
    'there'

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
        if (!cancelled) setListError('Could not load your workspace.')
      } finally {
        if (!cancelled) setListing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const recent = useMemo(() => campaigns.slice(0, 5), [campaigns])
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

  return (
    <AppLayout>
      <main className="dash dash-simple dash-home">
        <header className="dash-welcome">
          <p className="dash-welcome-kicker">Welcome to LUCE</p>
          <h1>Hi {firstName} — generate product creatives that stay on-brand.</h1>
          <p>Start from a product photo, then pick formats or upload your own reference.</p>
          <Link className="dash-welcome-cta" to="/app/studio/photos">
            {paid ? 'Create images' : 'Try images free'}
            <span aria-hidden="true">→</span>
          </Link>
        </header>

        <section className="dash-recommended" aria-labelledby="dash-rec-title">
          <div className="dash-recommended-head">
            <h2 id="dash-rec-title">Recommended features</h2>
            <Link to="/app/studio/photos">See all studios</Link>
          </div>
          <div className="dash-rec-grid">
            {RECOMMENDED.map((item) => (
              <article key={item.to} className="dash-rec-card">
                <div className="dash-rec-media">
                  <img src={item.image} alt="" loading="lazy" />
                </div>
                <div className="dash-rec-body">
                  <h3>
                    {item.title}
                    {item.pro && !paid ? <span className="dash-path-pro">Paid</span> : null}
                  </h3>
                  <p>{item.description}</p>
                  <Link
                    className={`dash-rec-cta${item.accent ? ' is-accent' : ''}`}
                    to={item.to}
                  >
                    {item.cta}
                    <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        {listError && (
          <p className="auth-error" role="alert">
            {listError}
          </p>
        )}

        <section className="dash-panel dash-panel-simple" aria-labelledby="dash-recent-title">
          <div className="dash-panel-head">
            <h2 id="dash-recent-title">Recent</h2>
            {campaigns.length > 0 ? <Link to="/app/campaigns">All</Link> : null}
          </div>

          {listing ? (
            <p className="dash-muted">Loading…</p>
          ) : recent.length === 0 ? (
            <div className="dash-empty">
              <p>No projects yet — start with Image Studio.</p>
              <Link className="btn btn-grad" to="/app/studio/photos">
                Create images
              </Link>
            </div>
          ) : (
            <ul className="campaign-media-grid">
              {recent.map((c) => (
                <li key={c.id}>
                  <CampaignMediaCard campaign={c} imageUrl={covers.get(c.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </AppLayout>
  )
}
