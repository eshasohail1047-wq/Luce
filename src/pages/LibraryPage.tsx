import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import {
  listSavedAssets,
  removeSavedAsset,
  type SavedAsset,
} from '../lib/savedAssets'
import { downloadMockOutput, ensurePlayableVideoOutputs } from '../lib/mockCampaign'

function relativeSaved(ms: number) {
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`
}

type LibraryFilter = 'all' | 'image' | 'video' | 'copy'

function kindLabel(kind: SavedAsset['kind']) {
  if (kind === 'video') return 'Video'
  if (kind === 'copy') return 'Copy'
  return 'Image'
}

function SavedCard({
  asset,
  onRemove,
  onExport,
  onPreview,
  busy,
}: {
  asset: SavedAsset
  onRemove: () => void
  onExport: () => void
  onPreview: () => void
  busy: boolean
}) {
  const label = kindLabel(asset.kind)

  return (
    <article className="ws-card">
      <button type="button" className="ws-card-media" onClick={onPreview}>
        {asset.kind === 'video' && asset.videoUrl ? (
          <video
            src={asset.videoUrl}
            poster={asset.imageUrl}
            muted
            playsInline
            loop
            preload="metadata"
          />
        ) : asset.imageUrl ? (
          <img src={asset.imageUrl} alt="" loading="lazy" decoding="async" />
        ) : asset.text ? (
          <span className="ws-card-copy-preview">{asset.text}</span>
        ) : (
          <span className="ws-card-fallback" aria-hidden="true">
            {label}
          </span>
        )}
        <span className={`ws-card-tag${asset.kind === 'video' ? ' is-done' : ''}`}>{label}</span>
        {asset.kind === 'video' ? (
          <span className="ws-card-play" aria-hidden="true">
            ▶
          </span>
        ) : null}
        <span className="ws-card-export" aria-hidden="true">
          Preview
        </span>
      </button>
      <div className="ws-card-body">
        <strong>{asset.label}</strong>
        <span>
          {asset.productName}
          <span aria-hidden="true"> · </span>
          {relativeSaved(asset.savedAt)}
        </span>
      </div>
      <div className="ws-card-actions">
        <button
          type="button"
          className="dash-campaign-delete-btn dash-campaign-delete-btn-cancel"
          disabled={busy}
          onClick={() => void onExport()}
        >
          Export
        </button>
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
  const [previewId, setPreviewId] = useState<string | null>(null)

  async function refresh() {
    if (!user) return
    const rows = await listSavedAssets(user.uid)
    const healed = ensurePlayableVideoOutputs(rows as never) as unknown as SavedAsset[]
    setAssets(
      healed.map((row, i) => ({
        ...rows[i]!,
        videoUrl: row.videoUrl || rows[i]!.videoUrl,
      })),
    )
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listSavedAssets(user.uid)
        const healed = ensurePlayableVideoOutputs(
          rows.map((r) => ({
            id: r.outputId,
            assetType: r.assetType,
            label: r.label,
            kind: r.kind,
            imageUrl: r.imageUrl,
            videoUrl: r.videoUrl,
            text: r.text,
          })),
        )
        if (!cancelled) {
          setAssets(
            rows.map((row, i) => ({
              ...row,
              videoUrl: healed[i]?.videoUrl || row.videoUrl,
            })),
          )
        }
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

  const preview = previewId ? assets.find((a) => a.id === previewId) || null : null

  useEffect(() => {
    if (!previewId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewId(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewId])

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
                  onPreview={() => setPreviewId(asset.id)}
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
                      if (previewId === asset.id) setPreviewId(null)
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

        {preview ? (
          <div
            className="ws-preview-overlay"
            role="dialog"
            aria-modal="true"
            aria-label={preview.label}
            onClick={() => setPreviewId(null)}
          >
            <div className="ws-preview-panel" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="ws-preview-close"
                aria-label="Close preview"
                onClick={() => setPreviewId(null)}
              >
                ×
              </button>
              <div className="ws-preview-media">
                {preview.kind === 'video' && preview.videoUrl ? (
                  <video
                    key={preview.id}
                    src={preview.videoUrl}
                    poster={preview.imageUrl}
                    controls
                    autoPlay
                    playsInline
                    loop
                  />
                ) : preview.imageUrl ? (
                  <img src={preview.imageUrl} alt={preview.label} />
                ) : preview.text ? (
                  <blockquote>{preview.text}</blockquote>
                ) : (
                  <p>No preview available.</p>
                )}
              </div>
              <div className="ws-preview-meta">
                <div>
                  <strong>{preview.label}</strong>
                  <span>
                    {kindLabel(preview.kind)} · {preview.productName}
                  </span>
                </div>
                <div className="ws-preview-actions">
                  <button
                    type="button"
                    className="dash-create-btn dash-create-btn-sm"
                    disabled={busyId === preview.id}
                    onClick={() => {
                      void (async () => {
                        setBusyId(preview.id)
                        try {
                          await downloadMockOutput(
                            {
                              id: preview.outputId,
                              assetType: preview.assetType,
                              label: preview.label,
                              kind: preview.kind,
                              imageUrl: preview.imageUrl,
                              videoUrl: preview.videoUrl,
                              text: preview.text,
                            },
                            preview.productName,
                          )
                        } finally {
                          setBusyId(null)
                        }
                      })()
                    }}
                  >
                    Export
                  </button>
                  <Link
                    className="dash-create-btn dash-create-btn-ghost dash-create-btn-sm"
                    to={`/app/campaigns/${preview.campaignId}`}
                  >
                    Open project
                  </Link>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </AppLayout>
  )
}
