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
import {
  campaignModeLabel,
  isCampaignComplete,
  relativeTime,
  statusLabel,
} from '../lib/workspaceUi'

export default function LibraryPage() {
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
        if (!cancelled) setListError('Could not load library.')
      } finally {
        if (!cancelled) setListing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const ready = useMemo(
    () => campaigns.filter((c) => isCampaignComplete(c.status)),
    [campaigns],
  )
  const inProgress = useMemo(
    () => campaigns.filter((c) => !isCampaignComplete(c.status)),
    [campaigns],
  )

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
            <h1>Library</h1>
            <p>Exports and finished packs will collect here after generation.</p>
          </div>
          <Link className="dash-create-btn" to="/app/studio/photos">
            Create images
          </Link>
        </header>

        {listError && (
          <p className="auth-error" role="alert">
            {listError}
          </p>
        )}

        {listing ? (
          <p className="dash-muted">Loading…</p>
        ) : campaigns.length === 0 ? (
          <div className="dash-empty">
            <p>Your library is empty. Create a project to start collecting assets.</p>
            <div className="workspace-empty-actions">
              <Link className="dash-create-btn dash-create-btn-sm" to="/app/studio/photos">
                Image Studio
              </Link>
            </div>
          </div>
        ) : (
          <>
            <section className="library-section" aria-labelledby="library-ready-title">
              <div className="dash-panel-head">
                <h2 id="library-ready-title">Ready &amp; exported</h2>
                <span className="library-count">{ready.length}</span>
              </div>
              {ready.length === 0 ? (
                <div className="library-placeholder">
                  <p>
                    No finished packs yet. Projects stay here after generation completes — ready for
                    download and reuse.
                  </p>
                </div>
              ) : (
                <ul className="dash-campaign-list">
                  {ready.map((c) => {
                    const product = c.productId ? productsById.get(c.productId) : undefined
                    const name = c.title || c.productName || 'Untitled'
                    return (
                      <li key={c.id}>
                        <Link className="dash-campaign-row" to={`/app/campaigns/${c.id}`}>
                          {product?.imageUrl ? (
                            <img className="dash-campaign-thumb" src={product.imageUrl} alt="" />
                          ) : (
                            <span className="dash-campaign-thumb dash-thumb-fallback" aria-hidden="true">
                              {name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div className="dash-campaign-meta">
                            <strong>{name}</strong>
                            <span>{campaignModeLabel(c)}</span>
                          </div>
                          <span className="dash-badge dash-badge-done">{statusLabel(c.status)}</span>
                          <span className="dash-campaign-time">{relativeTime(c)}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>

            <section className="library-section" aria-labelledby="library-progress-title">
              <div className="dash-panel-head">
                <h2 id="library-progress-title">In progress</h2>
                <span className="library-count">{inProgress.length}</span>
              </div>
              {inProgress.length === 0 ? (
                <p className="dash-muted">No open projects.</p>
              ) : (
                <ul className="dash-campaign-list">
                  {inProgress.map((c) => {
                    const product = c.productId ? productsById.get(c.productId) : undefined
                    const name = c.title || c.productName || 'Untitled'
                    return (
                      <li key={c.id}>
                        <Link className="dash-campaign-row" to={`/app/campaigns/${c.id}`}>
                          {product?.imageUrl ? (
                            <img className="dash-campaign-thumb" src={product.imageUrl} alt="" />
                          ) : (
                            <span className="dash-campaign-thumb dash-thumb-fallback" aria-hidden="true">
                              {name.slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <div className="dash-campaign-meta">
                            <strong>{name}</strong>
                            <span>{campaignModeLabel(c)}</span>
                          </div>
                          <span className="dash-badge dash-badge-progress">{statusLabel(c.status)}</span>
                          <span className="dash-campaign-time">{relativeTime(c)}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </AppLayout>
  )
}
