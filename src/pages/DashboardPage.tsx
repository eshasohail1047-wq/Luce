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

const TOOLS = [
  {
    to: '/app/studio/photos',
    title: 'Professional Images',
    copy: 'High-quality product photos for your brand.',
    icon: 'image',
  },
  {
    to: '/app/studio/videos',
    title: 'Product Videos',
    copy: 'Cinematic product videos that sell.',
    icon: 'video',
  },
  {
    to: '/app/studio/videos?style=ugc',
    title: 'UGC-Style Videos',
    copy: 'Realistic, creator-style videos with AI.',
    icon: 'ugc',
  },
  {
    to: '/app/studio/ads',
    title: 'Ads & Social Content',
    copy: 'Ready-to-post creatives, captions and more.',
    icon: 'tag',
  },
  {
    to: '/app/campaigns/new',
    title: 'Complete Campaign',
    copy: 'Get everything you need in one go.',
    icon: 'spark',
  },
] as const

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function relativeTime(campaign: CampaignDoc) {
  const ms = campaign.updatedAt?.toMillis?.() ?? campaign.createdAt?.toMillis?.()
  if (!ms) return ''
  const diff = Date.now() - ms
  const days = Math.floor(diff / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  if (days < 14) return '1 week ago'
  return `${Math.floor(days / 7)} weeks ago`
}

function createdLabel(ms?: number) {
  if (!ms) return ''
  const days = Math.max(0, Math.floor((Date.now() - ms) / 86_400_000))
  if (days <= 0) return 'Created today'
  if (days === 1) return 'Created 1 day ago'
  if (days < 7) return `Created ${days} days ago`
  if (days < 14) return 'Created 1 week ago'
  return `Created ${Math.floor(days / 7)} weeks ago`
}

function isComplete(status: string) {
  return status === 'ready' || status === 'exported'
}

function statusBadge(status: string) {
  if (isComplete(status)) return { label: 'Completed', tone: 'done' as const }
  return { label: 'In Progress', tone: 'progress' as const }
}

function modeLabel(campaign: CampaignDoc) {
  if (campaign.mode === 'studio' && campaign.studioKind === 'photos') return 'Photos'
  if (campaign.mode === 'studio' && campaign.studioKind === 'videos') return 'Videos'
  if (campaign.mode === 'studio' && campaign.studioKind === 'ads') return 'Ads'
  return 'Campaign'
}

function campaignMeta(campaign: CampaignDoc) {
  const count = campaign.selectedAssets?.length || campaign.deliverables?.length
  const kind = modeLabel(campaign)
  if (count && count > 0) return `${kind} · ${count} assets`
  return kind
}

function ToolIcon({ name }: { name: (typeof TOOLS)[number]['icon'] }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (name) {
    case 'image':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m21 15-4.5-4.5L7 20" />
        </svg>
      )
    case 'video':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="m16 10 5-3v10l-5-3" />
        </svg>
      )
    case 'ugc':
      return (
        <svg {...common}>
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
          <path d="M10 8h4" />
        </svg>
      )
    case 'tag':
      return (
        <svg {...common}>
          <path d="M20.6 13.4 12.4 21.6a2 2 0 0 1-2.8 0L3 15V4h11l6.6 6.6a2 2 0 0 1 0 2.8Z" />
          <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'spark':
      return (
        <svg {...common}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      )
  }
}

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
  const { user, loading } = useAuth()
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

  const products = useMemo(() => {
    const seen = new Set<string>()
    const cards: Array<{
      id: string
      name: string
      category: string
      imageUrl?: string
      createdLabel: string
      href: string
    }> = []

    for (const c of campaigns) {
      const key = c.productId || c.id
      if (!key || seen.has(key)) continue
      seen.add(key)
      const product = c.productId ? productsById.get(c.productId) : undefined
      cards.push({
        id: key,
        name: product?.name || c.productName || c.title || 'Untitled product',
        category: product?.category || '',
        imageUrl: product?.imageUrl,
        createdLabel: createdLabel(c.createdAt?.toMillis?.()),
        href: `/app/campaigns/${c.id}`,
      })
      if (cards.length >= 3) break
    }
    return cards
  }, [campaigns, productsById])

  const recent = campaigns.slice(0, 4)

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

  const firstName = user.displayName?.split(' ')[0] || user.email?.split('@')[0] || ''
  const fullName = user.displayName?.trim() || firstName || 'Account'
  const initial = fullName.slice(0, 1).toUpperCase()

  return (
    <AppLayout>
      <main className="dash">
        <header className="dash-topbar">
          <div className="dash-topbar-spacer" />
          <div className="dash-topbar-actions">
            <div className="dash-profile">
              <span className="dash-avatar" aria-hidden="true">
                {user.photoURL ? <img src={user.photoURL} alt="" /> : initial}
              </span>
              <span className="dash-profile-name">{fullName}</span>
            </div>
          </div>
        </header>

        <section className="dash-hero">
          <div className="dash-hero-copy">
            <h1>
              {greeting()}
              {firstName ? `, ${firstName}` : ''}
            </h1>
            <p>Create beautiful product visuals, videos and more — all in one place.</p>
          </div>
          <Link className="dash-create-btn" to="/app/campaigns/new">
            <span aria-hidden="true">+</span> Create New Campaign
          </Link>
        </section>

        <section className="dash-tools" aria-label="Create tools">
          {TOOLS.map((tool) => (
            <Link key={tool.title} className="dash-tool" to={tool.to}>
              <span className="dash-tool-icon">
                <ToolIcon name={tool.icon} />
              </span>
              <strong>{tool.title}</strong>
              <span>{tool.copy}</span>
            </Link>
          ))}
        </section>

        {listError && (
          <p className="auth-error" role="alert">
            {listError}
          </p>
        )}

        <div className="dash-panels">
          <section className="dash-panel" aria-labelledby="dash-products-title">
            <div className="dash-panel-head">
              <h2 id="dash-products-title">Your Products</h2>
              {products.length > 0 ? <Link to="/app/products">View all →</Link> : null}
            </div>

            {listing ? (
              <p className="dash-muted">Loading products…</p>
            ) : (
              <div className="dash-product-grid">
                {products.map((p) => (
                  <Link key={p.id} className="dash-product-card" to={p.href}>
                    <div className="dash-product-media">
                      <ProductThumb name={p.name} imageUrl={p.imageUrl} />
                    </div>
                    <div className="dash-product-body">
                      <h3>{p.name}</h3>
                      {p.category ? <p>{p.category}</p> : null}
                      {p.createdLabel ? <span>{p.createdLabel}</span> : null}
                    </div>
                  </Link>
                ))}

                <Link className="dash-product-add" to="/app/campaigns/new">
                  <span aria-hidden="true">+</span>
                  Add Product
                </Link>
              </div>
            )}
          </section>

          <section className="dash-panel" aria-labelledby="dash-campaigns-title">
            <div className="dash-panel-head">
              <h2 id="dash-campaigns-title">Recent Campaigns</h2>
              {recent.length > 0 ? <Link to="/app/campaigns">View all →</Link> : null}
            </div>

            {listing ? (
              <p className="dash-muted">Loading campaigns…</p>
            ) : recent.length === 0 ? (
              <div className="dash-empty">
                <p>No campaigns yet. Create your first one from a product.</p>
                <Link className="dash-create-btn dash-create-btn-sm" to="/app/campaigns/new">
                  + Create New Campaign
                </Link>
              </div>
            ) : (
              <ul className="dash-campaign-list">
                {recent.map((c) => {
                  const badge = statusBadge(c.status)
                  const product = c.productId ? productsById.get(c.productId) : undefined
                  const name = c.title || c.productName || 'Untitled campaign'
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
                          <span>{campaignMeta(c)}</span>
                        </div>
                        <span className={`dash-badge dash-badge-${badge.tone}`}>{badge.label}</span>
                        <span className="dash-campaign-time">{relativeTime(c)}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    </AppLayout>
  )
}
