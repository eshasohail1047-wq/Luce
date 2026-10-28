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

const CREATE_PATHS = [
  {
    to: '/app/studio/photos',
    label: 'Images',
    hint: 'Product photos',
    image: '/images/audience-beauty.jpg',
    pro: false,
  },
  {
    to: '/app/studio/videos',
    label: 'Videos',
    hint: 'Clips & UGC',
    image: '/images/campaign-home-lifestyle.jpg',
    pro: true,
  },
  {
    to: '/app/campaigns/new',
    label: 'Campaign',
    hint: 'Full pack',
    image: '/images/campaign-beauty-flatlay.jpg',
    pro: true,
  },
] as const

export default function DashboardPage() {
  const { user, plan, loading } = useAuth()
  const [campaigns, setCampaigns] = useState<CampaignDoc[]>([])
  const [productsById, setProductsById] = useState<Map<string, ProductSummary>>(new Map())
  const [listError, setListError] = useState<string | null>(null)
  const [listing, setListing] = useState(true)

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
      <main className="dash dash-simple dash-minimal">
        <header className="dash-minimal-header">
          <div>
            <h1>Dashboard</h1>
            <p>Start a project or open recent work.</p>
          </div>
          <Link className="dash-create-btn" to="/app/studio/photos">
            <span aria-hidden="true">+</span>{' '}
            {isPaidPlan(plan) ? 'New images' : 'Try free'}
          </Link>
        </header>

        <section className="dash-create-block" aria-label="Create">
          <div className="dash-paths dash-paths-essential">
            {CREATE_PATHS.map((path) => {
              const paidHint = path.pro && !isPaidPlan(plan)
              return (
                <Link key={path.to + path.label} className="dash-path" to={path.to}>
                  <img className="dash-path-img" src={path.image} alt="" />
                  <span className="dash-path-shade" aria-hidden="true" />
                  <span className="dash-path-copy">
                    <strong>
                      {path.label}
                      {paidHint ? <span className="dash-path-pro">Paid</span> : null}
                    </strong>
                    <span>{path.hint}</span>
                  </span>
                </Link>
              )
            })}
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
              <p>No projects yet.</p>
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
