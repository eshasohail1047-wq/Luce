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

type CreatePath = {
  to: string
  label: string
  hint: string
  image: string
  pro: boolean
  comingSoon?: boolean
}

const CREATE_PATHS: CreatePath[] = [
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
    hint: 'Coming soon — use Full Campaign for now',
    image: '/images/output-social.jpg',
    pro: true,
    comingSoon: true,
  },
  {
    to: '/app/campaigns/new',
    label: 'Full Campaign',
    hint: 'Any mix of images & videos + ads extras',
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
      <main className="dash dash-simple">
        <section className="dash-hero-card dash-hero-card-simple" aria-label="Start creating">
          <div className="dash-hero-card-copy">
            <p className="dash-hero-kicker">How it works</p>
            <h2>Add a product. Get campaign creatives.</h2>
            <p>
              Paste a product URL or upload a photo. LUCE builds the visuals you need to sell —
              images, video, or a full campaign with hooks, captions & CTAs.
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
              const paidHint = path.pro && !isPaidPlan(plan) && !path.comingSoon
              if (path.comingSoon) {
                return (
                  <div
                    key={path.to + path.label}
                    className="dash-path is-soon"
                    aria-disabled="true"
                    title="Coming soon — not in MVP"
                  >
                    <img className="dash-path-img" src={path.image} alt="" />
                    <span className="dash-path-shade" aria-hidden="true" />
                    <span className="dash-path-copy">
                      <strong>
                        {path.label}
                        <span className="dash-path-soon">Coming soon</span>
                      </strong>
                      <span>{path.hint}</span>
                    </span>
                  </div>
                )
              }
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
            {campaigns.length > 0 ? (
              <Link to="/app/campaigns">View all campaigns</Link>
            ) : null}
          </div>

          {listing ? (
            <p className="dash-muted">Loading…</p>
          ) : recent.length === 0 ? (
            <div className="dash-empty">
              <p>Nothing here yet. Add a product to begin.</p>
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
