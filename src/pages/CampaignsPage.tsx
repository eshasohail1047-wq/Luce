import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import {
  getProductsByIds,
  listUserCampaigns,
  type CampaignDoc,
  type ProductSummary,
} from '../lib/campaigns'
import {
  campaignModeLabel,
  isCampaignComplete,
  relativeTime,
  statusLabel,
} from '../lib/workspaceUi'

function ProductThumb({
  name,
  imageUrl,
}: {
  name: string
  imageUrl?: string
}) {
  if (imageUrl) {
    return <img className="dash-campaign-thumb" src={imageUrl} alt="" />
  }
  return (
    <span className="dash-campaign-thumb dash-thumb-fallback" aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export default function CampaignsPage() {
  const { user, loading } = useAuth()
  const [campaigns, setCampaigns] = useState<CampaignDoc[]>([])
  const [productsById, setProductsById] = useState<Map<string, ProductSummary>>(new Map())
  const [listError, setListError] = useState<string | null>(null)
  const [listing, setListing] = useState(true)
  const [filter, setFilter] = useState<'all' | 'studio' | 'campaign'>('all')
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') || '').trim().toLowerCase()

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
        if (!cancelled) setListError('Could not load campaigns.')
      } finally {
        if (!cancelled) setListing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const filtered = useMemo(() => {
    let rows = campaigns
    if (filter === 'studio') rows = rows.filter((c) => c.mode === 'studio')
    if (filter === 'campaign') rows = rows.filter((c) => c.mode !== 'studio')
    if (query) {
      rows = rows.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.productName.toLowerCase().includes(query),
      )
    }
    return rows
  }, [campaigns, filter, query])

  if (loading) {
    return (
      <div className="studio-shell studio-shell-alone">
        <p className="app-loading">Loading…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return (
    <AppLayout>
      <main className="dash dash-simple workspace-list">
        <header className="workspace-list-header">
          <div>
            <h1>Campaigns</h1>
            <p>
              Studio projects and full campaign packs in one place.
              {query ? ` Showing results for “${searchParams.get('q')}”.` : ''}
            </p>
          </div>
          <Link className="dash-create-btn" to="/app/studio/photos">
            <span aria-hidden="true">+</span> New images
          </Link>
        </header>

        <div className="workspace-filters" role="tablist" aria-label="Filter campaigns">
          {(
            [
              ['all', 'All'],
              ['studio', 'Studio'],
              ['campaign', 'Full campaigns'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={filter === id}
              className={filter === id ? 'is-active' : ''}
              onClick={() => setFilter(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {listError && (
          <p className="auth-error" role="alert">
            {listError}
          </p>
        )}

        {listing ? (
          <p className="dash-muted">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="dash-empty">
            <p>
              {campaigns.length === 0
                ? 'No campaigns yet. Start from Image Studio or create a full campaign.'
                : 'Nothing matches this filter.'}
            </p>
            <div className="workspace-empty-actions">
              <Link className="dash-create-btn dash-create-btn-sm" to="/app/studio/photos">
                Image Studio
              </Link>
              <Link className="dash-create-btn dash-create-btn-ghost dash-create-btn-sm" to="/app/campaigns/new">
                Full campaign
              </Link>
            </div>
          </div>
        ) : (
          <ul className="dash-campaign-list workspace-campaign-list">
            {filtered.map((c) => {
              const product = c.productId ? productsById.get(c.productId) : undefined
              const name = c.title || c.productName || 'Untitled'
              const done = isCampaignComplete(c.status)
              return (
                <li key={c.id}>
                  <Link className="dash-campaign-row" to={`/app/campaigns/${c.id}`}>
                    <ProductThumb name={name} imageUrl={product?.imageUrl} />
                    <div className="dash-campaign-meta">
                      <strong>{name}</strong>
                      <span>
                        {campaignModeLabel(c)}
                        {c.tryFree ? ' · Free trial' : ''}
                      </span>
                    </div>
                    <span className={`dash-badge dash-badge-${done ? 'done' : 'progress'}`}>
                      {done ? 'Done' : statusLabel(c.status)}
                    </span>
                    <span className="dash-campaign-time">{relativeTime(c)}</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </AppLayout>
  )
}
