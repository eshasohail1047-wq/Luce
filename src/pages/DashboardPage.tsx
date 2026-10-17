import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import {
  getProductsByIds,
  listUserCampaigns,
  type CampaignDoc,
  type ProductSummary,
} from '../lib/campaigns'
import { isPaidPlan } from '../lib/plans'
import {
  campaignModeLabel,
  isCampaignComplete,
  relativeTime,
} from '../lib/workspaceUi'

const CREATE_PATHS = [
  {
    to: '/app/studio/photos',
    label: 'Product Images',
    hint: 'Free — studio photos for your store',
    image: '/images/audience-beauty.jpg',
    pro: false,
  },
  {
    to: '/app/studio/videos',
    label: 'Product Videos',
    hint: 'Short clips for product pages',
    image: '/images/campaign-home-lifestyle.jpg',
    pro: true,
  },
  {
    to: '/app/studio/videos?style=ugc',
    label: 'UGC Videos',
    hint: 'Creator-style Reels & TikToks',
    image: '/images/ugc-makeup-lipstick.jpg',
    pro: true,
  },
  {
    to: '/app/studio/ads',
    label: 'Ads & Social',
    hint: 'Creatives ready to run paid ads',
    image: '/images/output-social.jpg',
    pro: true,
  },
  {
    to: '/app/campaigns/new',
    label: 'Full Campaign',
    hint: 'Strategy + visuals + ads in one',
    image: '/images/campaign-beauty-flatlay.jpg',
    pro: true,
  },
] as const

function ProductThumb({
  name,
  imageUrl,
  className,
}: {
  name: string
  imageUrl?: string
  className?: string
}) {
  if (imageUrl) {
    return <img className={className} src={imageUrl} alt="" />
  }
  return (
    <span className={`${className ?? ''} dash-thumb-fallback`.trim()} aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

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
      <main className="dash dash-simple">
        <section className="dash-hero-card dash-hero-card-simple" aria-label="Start creating">
          <div className="dash-hero-card-copy">
            <p className="dash-hero-kicker">How it works</p>
            <h2>Add a product. Get campaign creatives.</h2>
            <p>
              Paste a product URL or upload a photo. LUCE builds the visuals you need to sell —
              images, video, ads, or a full campaign pack.
            </p>
            <div className="dash-hero-card-actions">
              <Link className="dash-create-btn" to="/app/studio/photos">
                <span aria-hidden="true">+</span>{' '}
                {isPaidPlan(plan) ? 'Add your product' : 'Try free images'}
              </Link>
              {!isPaidPlan(plan) ? (
                <Link className="dash-create-btn dash-create-btn-ghost" to="/app/settings#plan">
                  View plans
                </Link>
              ) : null}
            </div>
          </div>
          <div className="dash-hero-card-media" aria-hidden="true">
            <img src="/images/campaign-social-flatlay.jpg" alt="" />
          </div>
        </section>

        <section className="dash-create-block" aria-label="Create">
          <div className="dash-panel-head">
            <h2>Choose what to create</h2>
          </div>
          <div className="dash-paths">
            {CREATE_PATHS.map((path) => {
              const paidHint = path.pro && !isPaidPlan(plan)
              return (
                <Link
                  key={path.to + path.label}
                  className="dash-path"
                  to={path.to}
                >
                  <img className="dash-path-img" src={path.image} alt="" />
                  <span className="dash-path-shade" aria-hidden="true" />
                  <span className="dash-path-copy">
                    <strong>
                      {path.label}
                      {paidHint ? <span className="dash-path-pro">Paid</span> : null}
                    </strong>
                    <span>
                      {paidHint ? 'Browse free — pay when you generate' : path.hint}
                    </span>
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
            {campaigns.length > 0 ? <Link to="/app/campaigns">View all</Link> : null}
          </div>

          {listing ? (
            <p className="dash-muted">Loading…</p>
          ) : recent.length === 0 ? (
            <div className="dash-empty">
              <p>Nothing here yet. Add a product to begin.</p>
            </div>
          ) : (
            <ul className="dash-campaign-list">
              {recent.map((c) => {
                const product = c.productId ? productsById.get(c.productId) : undefined
                const name = c.title || c.productName || 'Untitled'
                const done = isCampaignComplete(c.status)
                return (
                  <li key={c.id}>
                    <Link className="dash-campaign-row" to={`/app/campaigns/${c.id}`}>
                      <ProductThumb
                        className="dash-campaign-thumb"
                        name={name}
                        imageUrl={product?.imageUrl}
                      />
                      <div className="dash-campaign-meta">
                        <strong>{name}</strong>
                        <span>{campaignModeLabel(c)}</span>
                      </div>
                      <span className={`dash-badge dash-badge-${done ? 'done' : 'progress'}`}>
                        {done ? 'Done' : 'In progress'}
                      </span>
                      <span className="dash-campaign-time">{relativeTime(c)}</span>
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
