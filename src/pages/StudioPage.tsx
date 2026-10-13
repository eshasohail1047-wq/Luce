import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import { createStudioProject } from '../lib/campaigns'
import {
  AD_STYLES,
  PHOTO_STYLES,
  VIDEO_STYLES,
  studioTitle,
  type AdStyleId,
  type PhotoStyleId,
  type StudioKind,
  type VideoStyleId,
} from '../lib/deliverables'

const VALID_KINDS: StudioKind[] = ['photos', 'videos', 'ads']

function isStudioKind(value: string | undefined): value is StudioKind {
  return Boolean(value && VALID_KINDS.includes(value as StudioKind))
}

export default function StudioPage() {
  const { kind: kindParam } = useParams()
  const kind = isStudioKind(kindParam) ? kindParam : null
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [productName, setProductName] = useState('')
  const [description, setDescription] = useState('')
  const [brand, setBrand] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [photoStyles, setPhotoStyles] = useState<PhotoStyleId[]>([])
  const [videoStyles, setVideoStyles] = useState<VideoStyleId[]>([])
  const [adStyles, setAdStyles] = useState<AdStyleId[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  useEffect(() => {
    setPhotoStyles([])
    setVideoStyles([])
    setAdStyles([])
    setError(null)
    setWarning(null)
  }, [kind])

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

  if (!kind) {
    return <Navigate to="/app" replace />
  }

  function pickFile(file: File | null | undefined) {
    setError(null)
    setWarning(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image (JPG, PNG, or WebP).')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('Image must be under 12MB.')
      return
    }
    setImageFile(file)
    if (!productName.trim()) {
      const guess = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
      if (guess) setProductName(guess)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  function selectionCount() {
    if (kind === 'photos') return photoStyles.length
    if (kind === 'videos') return videoStyles.length
    return adStyles.length
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !kind || !imageFile) {
      setError('Add a product photo to continue.')
      return
    }
    setBusy(true)
    setError(null)
    setWarning(null)
    try {
      const result = await createStudioProject({
        userId: user.uid,
        kind,
        productName: productName.trim() || undefined,
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        imageFile,
        photoStyles,
        videoStyles,
        adStyles,
      })
      if (result.storageWarning) setWarning(result.storageWarning)
      navigate(`/app/campaigns/${result.campaignId}`, { replace: true })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not start this project.')
    } finally {
      setBusy(false)
    }
  }

  const title = studioTitle(kind)
  const usingDefaults = selectionCount() === 0
  const lead =
    kind === 'photos'
      ? 'Upload a product photo. Choose styles, or leave blank for a full photo set.'
      : kind === 'videos'
        ? 'Upload a product photo. Choose video types, or leave blank for all formats.'
        : 'Upload a product photo. Choose ad outputs, or leave blank for creatives and copy.'

  const ctaLabel =
    kind === 'photos' ? 'Create photos' : kind === 'videos' ? 'Create videos' : 'Create ads'

  const bannerImage =
    kind === 'photos'
      ? '/images/moisturizer-studio.jpg'
      : kind === 'videos'
        ? '/images/output-ugc.jpg'
        : '/images/output-ads.jpg'
  const kicker = kind === 'photos' ? 'Photos' : kind === 'videos' ? 'Videos' : 'Ads'

  return (
    <AppLayout>
      <main className="app-main campaign-create studio-page">
        <header className={`create-banner tone-${kind}`}>
          <div className="create-banner-copy">
            <p className="dash-kicker">{kicker}</p>
            <h1>{title}</h1>
            <p className="app-lead">{lead}</p>
          </div>
          <div className="create-banner-media" aria-hidden="true">
            <img src={bannerImage} alt="" />
          </div>
        </header>

        <form className="app-form campaign-form create-panel" onSubmit={onSubmit}>
          <section className="form-section">
            <div className="form-section-head">
              <h2>Product photo</h2>
            </div>

            <div className="upload-block">
              <input
                ref={fileInputRef}
                id="studio-image"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                hidden
                onChange={(e) => pickFile(e.target.files?.[0])}
                disabled={busy}
              />

              <div
                className={`upload-drop${dragOver ? ' is-over' : ''}${previewUrl ? ' has-preview' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
              >
                {previewUrl ? (
                  <div className="upload-preview">
                    <img src={previewUrl} alt="Product preview" />
                    <div className="upload-preview-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={busy}
                      >
                        Replace
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setImageFile(null)}
                        disabled={busy}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="upload-empty"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={busy}
                  >
                    <span className="upload-empty-title">Drop product photo here</span>
                    <span className="upload-empty-copy">JPG, PNG, or WebP · up to 12MB</span>
                  </button>
                )}
              </div>
            </div>

            <div className="details-head">
              <div>
                <h2>Details</h2>
                <p>Optional</p>
              </div>
              <button
                type="button"
                className="details-toggle"
                onClick={() => setShowDetails((v) => !v)}
                disabled={busy}
              >
                {showDetails ? 'Hide' : 'Show'}
              </button>
            </div>

            {showDetails && (
              <div className="details-grid">
                <div className="auth-field">
                  <label htmlFor="studio-name">Product name</label>
                  <input
                    id="studio-name"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Rose Oud Perfume"
                    disabled={busy}
                  />
                </div>
                <div className="auth-field">
                  <label htmlFor="studio-brand">Brand</label>
                  <input
                    id="studio-brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Maison Luce"
                    disabled={busy}
                  />
                </div>
                <div className="auth-field details-span">
                  <label htmlFor="studio-desc">Notes</label>
                  <textarea
                    id="studio-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Mood, setting, or offer…"
                    disabled={busy}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>
                {kind === 'photos' ? 'Photo styles' : kind === 'videos' ? 'Video types' : 'Ad outputs'}
              </h2>
              <p>
                {usingDefaults
                  ? 'Nothing selected — defaults will be used.'
                  : `${selectionCount()} selected`}
              </p>
            </div>

            {kind === 'photos' && (
              <div className="check-grid" role="group" aria-label="Photo styles">
                {PHOTO_STYLES.map((item) => {
                  const checked = photoStyles.includes(item.id)
                  return (
                    <label
                      key={item.id}
                      className={`check-card${checked ? ' is-checked' : ''}${usingDefaults ? ' is-default' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setPhotoStyles((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((x) => x !== item.id)
                              : [...prev, item.id],
                          )
                        }
                        disabled={busy}
                      />
                      <span className="check-card-body">
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}

            {kind === 'videos' && (
              <div className="check-grid" role="group" aria-label="Video types">
                {VIDEO_STYLES.map((item) => {
                  const checked = videoStyles.includes(item.id)
                  return (
                    <label
                      key={item.id}
                      className={`check-card${checked ? ' is-checked' : ''}${usingDefaults ? ' is-default' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setVideoStyles((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((x) => x !== item.id)
                              : [...prev, item.id],
                          )
                        }
                        disabled={busy}
                      />
                      <span className="check-card-body">
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}

            {kind === 'ads' && (
              <div className="check-grid" role="group" aria-label="Ad outputs">
                {AD_STYLES.map((item) => {
                  const checked = adStyles.includes(item.id)
                  return (
                    <label
                      key={item.id}
                      className={`check-card${checked ? ' is-checked' : ''}${usingDefaults ? ' is-default' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setAdStyles((prev) =>
                            prev.includes(item.id)
                              ? prev.filter((x) => x !== item.id)
                              : [...prev, item.id],
                          )
                        }
                        disabled={busy}
                      />
                      <span className="check-card-body">
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </section>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {warning && (
            <p className="auth-notice" role="status">
              {warning}
            </p>
          )}

          <button type="submit" className="btn btn-grad campaign-submit" disabled={busy}>
            {busy ? 'Creating…' : ctaLabel}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </main>
    </AppLayout>
  )
}
