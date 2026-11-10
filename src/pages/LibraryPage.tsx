import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CreativeFormatPreview from '../components/CreativeFormatPreview'
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

type TypeFilter = 'all' | 'image' | 'video' | 'copy'
type StatusFilter = 'all'
type DateFilter = 'all' | 'today' | 'week' | 'month'
type SortOrder = 'newest' | 'oldest'
type ViewMode = 'grid' | 'list'

function kindLabel(kind: SavedAsset['kind']) {
  if (kind === 'video') return 'Video'
  if (kind === 'copy') return 'Copy'
  return 'Image'
}

function matchesDate(savedAt: number, filter: DateFilter) {
  if (filter === 'all') return true
  const age = Date.now() - savedAt
  if (filter === 'today') return age < 86_400_000
  if (filter === 'week') return age < 7 * 86_400_000
  return age < 30 * 86_400_000
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  const selected = options.find((o) => o.value === value)
  const showValue = value !== 'all' && selected

  return (
    <label className="library-filter-pill">
      <span className="library-filter-pill-label">
        {label}
        {showValue ? `: ${selected.label}` : ''}
      </span>
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M3 4.5L6 7.5L9 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </label>
  )
}

function EmptyBoxIllustration({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="88"
      height="88"
      viewBox="0 0 88 88"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M18 34 L44 22 L70 34 L70 58 L44 70 L18 58 Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M18 34 L44 46 L70 34"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M44 46 L44 70" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M32 28 L38 18 M44 26 L44 14 M56 28 L50 18"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function SavedCard({
  asset,
  view,
  onRemove,
  onExport,
  onPreview,
  busy,
}: {
  asset: SavedAsset
  view: ViewMode
  onRemove: () => void
  onExport: () => void
  onPreview: () => void
  busy: boolean
}) {
  const label = kindLabel(asset.kind)

  const media = (
    <button
      type="button"
      className={view === 'list' ? 'library-list-media' : 'ws-card-media'}
      onClick={onPreview}
    >
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
      {view === 'grid' ? (
        <>
          <span className={`ws-card-tag${asset.kind === 'video' ? ' is-done' : ''}`}>
            {label}
          </span>
          {asset.kind === 'video' ? (
            <span className="ws-card-play" aria-hidden="true">
              ▶
            </span>
          ) : null}
          <span className="ws-card-export" aria-hidden="true">
            Preview
          </span>
        </>
      ) : null}
    </button>
  )

  const actions = (
    <div className={view === 'list' ? 'library-list-actions' : 'ws-card-actions'}>
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
        aria-label={`Remove ${asset.label} from library`}
        onClick={() => void onRemove()}
      >
        Remove
      </button>
    </div>
  )

  if (view === 'list') {
    return (
      <article className="library-list-row">
        {media}
        <div className="library-list-body">
          <strong>{asset.label}</strong>
          <span>
            {label}
            <span aria-hidden="true"> · </span>
            {asset.productName}
            <span aria-hidden="true"> · </span>
            {relativeSaved(asset.savedAt)}
          </span>
        </div>
        {actions}
      </article>
    )
  }

  return (
    <article className="ws-card">
      {media}
      <div className="ws-card-body">
        <strong>{asset.label}</strong>
        <span>
          {asset.productName}
          <span aria-hidden="true"> · </span>
          {relativeSaved(asset.savedAt)}
        </span>
      </div>
      {actions}
    </article>
  )
}

export default function LibraryPage() {
  const { user, loading } = useAuth()
  const [assets, setAssets] = useState<SavedAsset[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [listing, setListing] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

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
    const q = search.trim().toLowerCase()
    let rows = assets.filter((a) => {
      if (typeFilter !== 'all' && a.kind !== typeFilter) return false
      if (statusFilter !== 'all') return false
      if (!matchesDate(a.savedAt, dateFilter)) return false
      if (!q) return true
      const hay = `${a.label} ${a.productName} ${a.text || ''} ${a.assetType}`.toLowerCase()
      return hay.includes(q)
    })
    rows = [...rows].sort((a, b) =>
      sortOrder === 'newest' ? b.savedAt - a.savedAt : a.savedAt - b.savedAt,
    )
    return rows
  }, [assets, search, typeFilter, statusFilter, dateFilter, sortOrder])

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

  const isEmptyLibrary = !listing && assets.length === 0
  const isEmptyFiltered = !listing && assets.length > 0 && filtered.length === 0

  return (
    <AppLayout>
      <main className="dash workspace-page library-page">
        <header className="library-header">
          <h1 className="library-title">Library</h1>

          <div className="library-toolbar">
            <label className="library-search">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
                <circle
                  cx="7"
                  cy="7"
                  r="4.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M10.5 10.5L13.5 13.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <input
                type="search"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search library"
              />
            </label>

            <div className="library-filters">
              <FilterSelect
                label="Type"
                value={typeFilter}
                onChange={(v) => setTypeFilter(v as TypeFilter)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'image', label: 'Images' },
                  { value: 'video', label: 'Videos' },
                  { value: 'copy', label: 'Copy' },
                ]}
              />
              <FilterSelect
                label="Status"
                value={statusFilter}
                onChange={(v) => setStatusFilter(v as StatusFilter)}
                options={[{ value: 'all', label: 'All' }]}
              />
              <FilterSelect
                label="Date"
                value={dateFilter}
                onChange={(v) => setDateFilter(v as DateFilter)}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'today', label: 'Today' },
                  { value: 'week', label: 'Past week' },
                  { value: 'month', label: 'Past month' },
                ]}
              />
            </div>

            <div className="library-toolbar-actions">
              <Link className="library-btn library-btn-outline" to="/app">
                <span aria-hidden="true">+</span> Add new
              </Link>
              <button type="button" className="library-btn library-btn-ghost" disabled>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path
                    d="M12 2L6.5 7.5M12 2L8.5 12L6.5 7.5M12 2L2 5.5L6.5 7.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Launch Ads
              </button>
            </div>

            <div className="library-view-toggles" role="group" aria-label="View options">
              <button
                type="button"
                className={sortOrder === 'oldest' ? 'is-active' : ''}
                aria-label={
                  sortOrder === 'newest' ? 'Sort oldest first' : 'Sort newest first'
                }
                title={sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
                onClick={() =>
                  setSortOrder((s) => (s === 'newest' ? 'oldest' : 'newest'))
                }
              >
                <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
                  <path
                    d="M4.5 2.5V12.5M4.5 2.5L2.5 4.5M4.5 2.5L6.5 4.5M10.5 12.5V2.5M10.5 12.5L8.5 10.5M10.5 12.5L12.5 10.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                type="button"
                className={viewMode === 'grid' ? 'is-active' : ''}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                onClick={() => setViewMode('grid')}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
                  <rect x="2" y="2" width="4.5" height="4.5" rx="0.8" fill="currentColor" />
                  <rect x="8.5" y="2" width="4.5" height="4.5" rx="0.8" fill="currentColor" />
                  <rect x="2" y="8.5" width="4.5" height="4.5" rx="0.8" fill="currentColor" />
                  <rect
                    x="8.5"
                    y="8.5"
                    width="4.5"
                    height="4.5"
                    rx="0.8"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <button
                type="button"
                className={viewMode === 'list' ? 'is-active' : ''}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                onClick={() => setViewMode('list')}
              >
                <svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
                  <path
                    d="M2.5 3.5H12.5M2.5 7.5H12.5M2.5 11.5H12.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          <p className="library-files-count">
            Files <span>{filtered.length}</span>
          </p>
        </header>

        {listError && (
          <p className="auth-error" role="alert">
            {listError}
          </p>
        )}

        {listing ? (
          <p className="workspace-page-empty">Loading…</p>
        ) : isEmptyLibrary ? (
          <div className="library-empty" role="status">
            <EmptyBoxIllustration className="library-empty-icon" />
            <h2>No files yet</h2>
            <p>Videos and images you create show up here.</p>
          </div>
        ) : isEmptyFiltered ? (
          <div className="library-empty library-empty-filtered" role="status">
            <EmptyBoxIllustration className="library-empty-icon" />
            <h2>No matching files</h2>
            <p>Try a different search or filter.</p>
          </div>
        ) : (
          <ul
            className={
              viewMode === 'list' ? 'library-list' : 'ws-card-grid library-grid'
            }
          >
            {filtered.map((asset) => (
              <li key={asset.id}>
                <SavedCard
                  asset={asset}
                  view={viewMode}
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
          <CreativeFormatPreview
            open
            item={{
              id: preview.id,
              label: preview.label,
              kind: preview.kind,
              imageUrl: preview.imageUrl,
              videoUrl: preview.videoUrl,
              text: preview.text,
              productName: preview.productName,
            }}
            onClose={() => setPreviewId(null)}
            actions={
              <>
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
                  onClick={() => setPreviewId(null)}
                >
                  Open project
                </Link>
              </>
            }
          />
        ) : null}
      </main>
    </AppLayout>
  )
}
