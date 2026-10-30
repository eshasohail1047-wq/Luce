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
    try {
      const productMap = await getProductsByIds(
        rows.filter((c) => c.productId && !c.id.startsWith('local-')).map((c) => c.productId),
      )
      setProductsById(productMap)
    } catch (err) {
      console.warn('[projects] product covers skipped', err)
    }
  }

  useEffect(() => {
    if (!user) {
      // Auth resolved without a user (redirect handles it) — never stick on Loading
      if (!loading) setListing(false)
      return
    }
    let cancelled = false
    setListing(true)
    ;(async () => {
      try {
        const rows = await listUserCampaigns(user.uid)
        if (cancelled) return
        setCampaigns(rows)
        // Unblock the grid immediately — covers are optional and can hang on Storage.
        setListing(false)
        try {
          const productMap = await getProductsByIds(
            rows
              .filter((c) => c.productId && !c.id.startsWith('local-'))
              .map((c) => c.productId),
          )
          if (!cancelled) setProductsById(productMap)
        } catch (coverErr) {
          console.warn('[projects] product covers skipped', coverErr)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setListError('Could not load projects.')
          setListing(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, loading])

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
      setListError(err instanceof Error ? err.message : 'Could not delete project.')
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
      <main className="dash workspace-page">
        <header className="workspace-page-header">
          <div className="workspace-page-title-row">
            <h1>Projects</h1>
            <Link className="dash-create-btn" to="/app">
              <span aria-hidden="true">+</span> New
            </Link>
          </div>

          <div className="workspace-page-toolbar">
            <div className="workspace-filters" role="tablist" aria-label="Filter projects">
              {(
                [
                  ['all', 'All'],
                  ['studio', 'Studio'],
                  ['campaign', 'Full'],
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

            <label className="workspace-page-search">
              <span className="sr-only">Search projects</span>
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder="Search…"
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
          </div>
        </header>

        {listError && (
          <p className="auth-error" role="alert">
            {listError}
          </p>
        )}

        {listing ? (
          <p className="workspace-page-empty">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="workspace-page-empty-card">
            <p>{campaigns.length === 0 ? 'No projects yet.' : 'Nothing matches.'}</p>
            {campaigns.length === 0 ? (
              <Link className="dash-create-btn dash-create-btn-sm" to="/app">
                Create project
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="ws-card-grid">
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
