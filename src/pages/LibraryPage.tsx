import { useEffect, useState } from 'react'
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
  return (
    <article className="campaign-media-card saved-asset-card">
      <div className="campaign-media-link saved-asset-media">
        <div className="campaign-media-frame">
          {asset.kind === 'video' && asset.videoUrl ? (
            <video
              className="campaign-media-img"
              src={asset.videoUrl}
              poster={asset.imageUrl}
              muted
              playsInline
              preload="metadata"
            />
          ) : asset.imageUrl ? (
            <img className="campaign-media-img" src={asset.imageUrl} alt="" />
          ) : (
            <span className="campaign-media-soft">
              {asset.kind === 'video' ? 'Video' : asset.kind === 'copy' ? 'Copy' : 'Asset'}
            </span>
          )}
          <span className="campaign-media-shade" />
        </div>
        <div className="campaign-media-copy">
          <span className="dash-badge dash-badge-done campaign-media-badge">Saved</span>
          <strong>{asset.label}</strong>
          <span className="campaign-media-sub">
            {asset.productName}
            <span aria-hidden="true"> · </span>
            {relativeSaved(asset.savedAt)}
          </span>
        </div>
        <div className="saved-asset-overlay">
          <button
            type="button"
            className="btn btn-grad saved-asset-export"
            disabled={busy}
            onClick={() => void onExport()}
          >
            {busy ? '…' : 'Export'}
          </button>
        </div>
      </div>
      <div className="campaign-media-actions saved-asset-actions">
        <Link
          className="dash-campaign-delete-btn dash-campaign-delete-btn-cancel"
          to={`/app/campaigns/${asset.campaignId}`}
        >
          Open project
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
            <h1>Saved</h1>
            <p>
              Creatives you save from a campaign. Export any image or video from here anytime.
            </p>
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
        ) : assets.length === 0 ? (
          <div className="dash-empty">
            <p>
              Nothing saved yet. Generate in a campaign, then tap <strong>Save</strong> on the
              creatives you want to keep.
            </p>
            <div className="workspace-empty-actions">
              <Link className="dash-create-btn dash-create-btn-sm" to="/app/studio/photos">
                Image Studio
              </Link>
              <Link
                className="dash-create-btn dash-create-btn-ghost dash-create-btn-sm"
                to="/app/campaigns"
              >
                Campaigns
              </Link>
            </div>
          </div>
        ) : (
          <ul className="campaign-media-grid">
            {assets.map((asset) => (
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
