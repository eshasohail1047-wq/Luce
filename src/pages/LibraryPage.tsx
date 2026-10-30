import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import {
  listSavedAssets,
  removeSavedAsset,
  type SavedAsset,
} from '../lib/savedAssets'
import { downloadMockOutput } from '../lib/mockCampaign'

function relativeSaved(ms: number) {
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`
}

type LibraryFilter = 'all' | 'image' | 'video' | 'copy'

function SavedCard({
  asset,
  onRemove,
  onExport,
  busy,
}: {
  asset: SavedAsset
  onRemove: () => void
  onExport: () => void
  busy: boolean
}) {
  const kindLabel =
    asset.kind === 'video' ? 'Video' : asset.kind === 'copy' ? 'Copy' : 'Image'

  return (
    <article className="ws-card">
      <div className="ws-card-media">
        {asset.kind === 'video' && asset.videoUrl ? (
          <video
            src={asset.videoUrl}
            poster={asset.imageUrl}
            muted
            playsInline
            preload="metadata"
          />
        ) : asset.imageUrl ? (
          <img src={asset.imageUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="ws-card-fallback" aria-hidden="true">
            {kindLabel}
          </span>
        )}
        <span className="ws-card-tag is-done">{kindLabel}</span>
        <button
          type="button"
          className="ws-card-export"
          disabled={busy}
          onClick={() => void onExport()}
        >
          {busy ? '…' : 'Export'}
        </button>
      </div>
      <div className="ws-card-body">
        <strong>{asset.label}</strong>
        <span>
          {asset.productName}
          <span aria-hidden="true"> · </span>
          {relativeSaved(asset.savedAt)}
        </span>
      </div>
      <div className="ws-card-actions">
        <Link
          className="dash-campaign-delete-btn dash-campaign-delete-btn-cancel"
          to={`/app/campaigns/${asset.campaignId}`}
        >
          Open
        </Link>
        <button
          type="button"
          className="dash-campaign-delete-btn"
          disabled={busy}
          aria-label={`Remove ${asset.label} from saved`}
          onClick={() => void onRemove()}
        >
          Remove
        </button>
      </div>
    </article>
  )
}

export default function LibraryPage() {
  const { user, loading } = useAuth()
  const [assets, setAssets] = useState<SavedAsset[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [listing, setListing] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [filter, setFilter] = useState<LibraryFilter>('all')

  async function refresh() {
    if (!user) return
    const rows = await listSavedAssets(user.uid)
    setAssets(rows)
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listSavedAssets(user.uid)
        if (!cancelled) setAssets(rows)
      } catch (err) {
        console.error(err)
        if (!cancelled) setListError('Could not load saved creatives.')
      } finally {
        if (!cancelled) setListing(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const filtered = useMemo(() => {
    if (filter === 'all') return assets
    return assets.filter((a) => a.kind === filter)
  }, [assets, filter])

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
            <h1>Saved</h1>
            <Link className="dash-create-btn" to="/app">
              <span aria-hidden="true">+</span> Create
            </Link>
          </div>

          <div className="workspace-page-toolbar">
            <div className="workspace-filters" role="tablist" aria-label="Filter saved">
              {(
                [
                  ['all', 'All'],
                  ['image', 'Images'],
                  ['video', 'Videos'],
                  ['copy', 'Copy'],
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
            <p>{assets.length === 0 ? 'Nothing saved yet.' : 'Nothing matches.'}</p>
            {assets.length === 0 ? (
              <Link className="dash-create-btn dash-create-btn-sm" to="/app/campaigns">
                Browse projects
              </Link>
            ) : null}
          </div>
        ) : (
          <ul className="ws-card-grid">
            {filtered.map((asset) => (
              <li key={asset.id}>
                <SavedCard
                  asset={asset}
                  busy={busyId === asset.id}
                  onExport={async () => {
                    setBusyId(asset.id)
                    setListError(null)
                    try {
                      await downloadMockOutput(
                        {
                          id: asset.outputId,
                          assetType: asset.assetType,
                          label: asset.label,
                          kind: asset.kind,
                          imageUrl: asset.imageUrl,
                          videoUrl: asset.videoUrl,
                          text: asset.text,
                        },
                        asset.productName,
                      )
                    } catch (err) {
                      console.error(err)
                      setListError('Could not export that creative.')
                    } finally {
                      setBusyId(null)
                    }
                  }}
                  onRemove={async () => {
                    setBusyId(asset.id)
                    try {
                      await removeSavedAsset(asset.id)
                      await refresh()
                    } catch (err) {
                      console.error(err)
                      setListError('Could not remove from saved.')
                    } finally {
                      setBusyId(null)
                    }
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </main>
    </AppLayout>
  )
}
