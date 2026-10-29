import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CampaignMediaCard from '../components/CampaignMediaCard'
import { useAuth } from '../auth/AuthProvider'
import { useCampaignCovers } from '../hooks/useCampaignCovers'
import {
  deleteUserCampaign,
  getProductsByIds,
  listUserCampaigns,
  type CampaignDoc,
  type ProductSummary,
} from '../lib/campaigns'

export default function CampaignsPage() {
  const { user, loading } = useAuth()
  const [campaigns, setCampaigns] = useState<CampaignDoc[]>([])
  const [productsById, setProductsById] = useState<Map<string, ProductSummary>>(new Map())
  const [listError, setListError] = useState<string | null>(null)
  const [listing, setListing] = useState(true)
  const [filter, setFilter] = useState<'all' | 'studio' | 'campaign'>('all')
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const query = (searchParams.get('q') || '').trim().toLowerCase()
  const [searchDraft, setSearchDraft] = useState(searchParams.get('q') || '')

  async function refreshCampaigns() {
    if (!user) return
    const rows = await listUserCampaigns(user.uid)
    setCampaigns(rows)
    const productMap = await getProductsByIds(rows.map((c) => c.productId))
    setProductsById(productMap)
  }

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

  async function handleDelete(campaignId: string) {
    if (!user) return
    setDeletingId(campaignId)
    setListError(null)
    try {
      await deleteUserCampaign(user.uid, campaignId)
      setConfirmId(null)
      await refreshCampaigns()
    } catch (err) {
      console.error(err)
      setListError(err instanceof Error ? err.message : 'Could not delete campaign.')
    } finally {
      setDeletingId(null)
    }
  }

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
  const covers = useCampaignCovers(filtered, productsById)

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
              Every image, video, ads, and full-campaign workspace. Open one to generate, export, or
              save creatives to Saved.
              {query ? ` Showing results for “${searchParams.get('q')}”.` : ''}
            </p>
          </div>
          <div className="workspace-list-tools">
            <label className="workspace-list-search">
              <span className="sr-only">Search campaigns</span>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder="Search campaigns…"
                value={searchDraft}
                onChange={(e) => {
                  const next = e.target.value
                  setSearchDraft(next)
                  const trimmed = next.trim()
                  if (trimmed) setSearchParams({ q: trimmed })
                  else setSearchParams({})
                }}
              />
            </label>
            <Link className="dash-create-btn" to="/app/studio/photos">
              <span aria-hidden="true">+</span> New images
            </Link>
          </div>
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
          <ul className="campaign-media-grid workspace-campaign-grid">
            {filtered.map((c) => {
              const name = c.title || c.productName || 'Untitled'
              const confirming = confirmId === c.id
              const busy = deletingId === c.id
              return (
                <li key={c.id}>
                  <CampaignMediaCard
                    campaign={c}
                    imageUrl={covers.get(c.id)}
                    showStatusDetail
                    actions={
                      <div className="dash-campaign-actions">
                        {confirming ? (
                          <>
                            <span className="dash-campaign-confirm-label">Delete?</span>
                            <button
                              type="button"
                              className="dash-campaign-delete-btn dash-campaign-delete-btn-confirm"
                              disabled={busy}
                              onClick={() => void handleDelete(c.id)}
                            >
                              {busy ? 'Deleting…' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              className="dash-campaign-delete-btn dash-campaign-delete-btn-cancel"
                              disabled={busy}
                              onClick={() => setConfirmId(null)}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="dash-campaign-delete-btn"
                            disabled={Boolean(deletingId)}
                            aria-label={`Delete ${name}`}
                            onClick={() => setConfirmId(c.id)}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    }
                  />
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </AppLayout>
  )
}
