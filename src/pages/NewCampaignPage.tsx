import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CreativeDirectionFields from '../components/CreativeDirectionFields'
import FormatPickGrid from '../components/FormatPickGrid'
import { useAuth } from '../auth/AuthProvider'
import {
  createCampaignWithProduct,
  friendlyFirestoreError,
  type ProductSourceType,
} from '../lib/campaigns'
import { canGenerate } from '../lib/planAccess'
import { getPlanLimits } from '../lib/planLimits'
import PaywallModal from '../components/PaywallModal'
import type {
  BackgroundId,
  LightingId,
  MoodId,
  StyleThemeId,
} from '../lib/creativeDirection'
import {
  DEFAULT_PHOTO_STYLES,
  DEFAULT_VIDEO_STYLES,
  PHOTO_STYLES,
  VIDEO_STYLES,
  resolveCampaignFromFormats,
  type PhotoStyleId,
  type VideoStyleId,
} from '../lib/deliverables'
import {
  fileToDataUrl,
  newLocalId,
  saveLocalCampaign,
  stashCampaignImage,
  stashCampaignRefImage,
  withTimeout,
} from '../lib/localDemoCampaign'

export default function NewCampaignPage() {
  const { user, plan, freeImageUsed, loading } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [sourceType, setSourceType] = useState<ProductSourceType>('upload')
  const [productName, setProductName] = useState('')
  const [productUrl, setProductUrl] = useState('')
  const [description, setDescription] = useState('')
  const [brand, setBrand] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [referenceFile, setReferenceFile] = useState<File | null>(null)
  const [referencePreviewUrl, setReferencePreviewUrl] = useState<string | null>(
    null,
  )
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showDetails, setShowDetails] = useState(true)
  const [photoStyles, setPhotoStyles] = useState<PhotoStyleId[]>([])
  const [videoStyles, setVideoStyles] = useState<VideoStyleId[]>([])
  const [includeSocial, setIncludeSocial] = useState(true)
  const [includeAds, setIncludeAds] = useState(false)
  const [includeStrategy, setIncludeStrategy] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [lighting, setLighting] = useState<LightingId | ''>('')
  const [background, setBackground] = useState<BackgroundId | ''>('')
  const [mood, setMood] = useState<MoodId | ''>('')
  const [styleTheme, setStyleTheme] = useState<StyleThemeId | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [paywallReason, setPaywallReason] = useState<string | undefined>()
  const limits = getPlanLimits(plan)

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
    if (!referenceFile) {
      setReferencePreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(referenceFile)
    setReferencePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [referenceFile])

  function pickReferenceFile(file: File | null) {
    setReferenceError(null)
    if (!file) {
      setReferenceFile(null)
      return
    }
    if (!file.type.startsWith('image/')) {
      setReferenceError('Reference must be an image (JPG, PNG, or WebP).')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setReferenceError('Reference image must be under 12MB.')
      return
    }
    setReferenceFile(file)
  }

  useEffect(() => {
    // Try-free flow lands in Image Studio; only hydrate here if something is left over.
    try {
      if (sessionStorage.getItem('luce.tryFreeImages') === '1') return
      const pendingUrl = sessionStorage.getItem('luce.pendingProductUrl')
      if (pendingUrl) {
        setSourceType('url')
        setProductUrl(pendingUrl)
        setShowDetails(true)
        sessionStorage.removeItem('luce.pendingProductUrl')
      }
      sessionStorage.removeItem('luce.pendingProductHint')
    } catch {
      /* ignore */
    }
  }, [])

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

  function assertCanCreate(): boolean {
    const check = canGenerate({
      plan,
      action: 'campaign',
      freeImageUsed,
    })
    if (check.allowed) return true
    setPaywallReason(check.reason)
    setPaywallOpen(true)
    return false
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

  async function createLocalDemoAndGo(imageDataUrl?: string) {
    const displayName =
      productName.trim() ||
      (imageFile ? imageFile.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') : '') ||
      (productUrl.trim() ? 'Product from URL' : 'Untitled product')
    const resolved = resolveCampaignFromFormats({
      photoStyles: photoStyles.slice(0, limits.maxImages),
      videoStyles: videoStyles.slice(0, limits.maxVideos),
      includeSocial,
      includeAds,
      includeStrategy,
    })
    const id = newLocalId('campaign')
    const imageUrl = imageDataUrl || previewUrl || undefined
    saveLocalCampaign({
      id,
      title: `${displayName} campaign`,
      status: 'product_confirmed',
      productName: displayName,
      productId: `local-product-${id}`,
      productUrl: productUrl.trim() || undefined,
      mode: 'campaign',
      deliverables: resolved.deliverables,
      selectedAssets: resolved.selectedAssets,
      includeStrategy: resolved.includeStrategy,
      tryFree: false,
      imageUrl,
      createdAt: Date.now(),
    })
    if (imageUrl) stashCampaignImage(id, imageUrl)
    if (referenceFile) {
      try {
        stashCampaignRefImage(id, await fileToDataUrl(referenceFile))
      } catch {
        /* optional */
      }
    }
    navigate(`/app/campaigns/${id}`, { replace: true })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (sourceType === 'upload' && !imageFile) {
      setError('Add a product photo to continue.')
      return
    }
    if (sourceType === 'url' && !productUrl.trim()) {
      setError('Enter a product URL to continue.')
      return
    }
    if (!assertCanCreate()) return
    setBusy(true)
    setError(null)
    setWarning(null)

    let imageDataUrl: string | undefined
    try {
      if (imageFile) imageDataUrl = await fileToDataUrl(imageFile)
    } catch {
      /* optional preview */
    }

    try {
      const result = await withTimeout(
        createCampaignWithProduct({
          userId: user.uid,
          sourceType,
          productName: productName.trim() || undefined,
          productUrl: productUrl.trim() || undefined,
          description: description.trim() || undefined,
          brand: brand.trim() || undefined,
          price: price.trim() || undefined,
          category: category.trim() || undefined,
          imageFile: sourceType === 'upload' ? imageFile : null,
          photoStyles: photoStyles.slice(0, limits.maxImages),
          videoStyles: videoStyles.slice(0, limits.maxVideos),
          includeSocial,
          includeAds,
          includeStrategy,
          creativeDirection: {
            prompt,
            lighting: lighting || undefined,
            background: background || undefined,
            mood: mood || undefined,
            styleTheme: styleTheme || undefined,
          },
        }),
        12_000,
        'create-campaign',
      )
      if (imageDataUrl) stashCampaignImage(result.campaignId, imageDataUrl)
      if (referenceFile) {
        try {
          stashCampaignRefImage(
            result.campaignId,
            await fileToDataUrl(referenceFile),
          )
        } catch {
          /* optional */
        }
      }
      navigate(`/app/campaigns/${result.campaignId}`, { replace: true })
    } catch (err) {
      console.warn('[NewCampaign] falling back to local demo campaign', err)
      try {
        await createLocalDemoAndGo(imageDataUrl)
      } catch (localErr) {
        console.error(localErr)
        setError(
          friendlyFirestoreError(
            localErr,
            'Could not create campaign. Try again or use a smaller photo.',
          ),
        )
        setBusy(false)
      }
    }
  }

  const photoCount = photoStyles.length || DEFAULT_PHOTO_STYLES.length
  const videoCount = videoStyles.length || DEFAULT_VIDEO_STYLES.length

  return (
    <AppLayout>
      <PaywallModal
        open={paywallOpen}
        title="Unlock full campaigns"
        reason={paywallReason}
        onClose={() => setPaywallOpen(false)}
      />
      <main className="app-main campaign-create studio-page">
        {plan === 'free' ? (
          <p className="studio-paid-banner" role="status">
            Explore the full campaign builder — upgrade is only required when you create.
          </p>
        ) : null}
        <header className="studio-hero tone-campaign">
          <div className="studio-hero-copy">
            <p className="studio-hero-kicker">Full Campaign</p>
            <h1>Build a complete campaign pack</h1>
            <p className="studio-hero-lead">
              Pick exact image and video formats for one product. Packaging stays true across every
              look.
            </p>
            <ol className="studio-hero-steps" aria-label="How it works">
              <li>Add product</li>
              <li>Pick formats</li>
              <li>Generate pack</li>
            </ol>
            <p className="studio-limit-chip" role="status">
              {limits.label}
            </p>
          </div>
          <div className="studio-hero-media" aria-hidden="true">
            <img src="/images/fidelity-studio.jpg" alt="" />
            <div className="studio-hero-glow" />
          </div>
        </header>

        <form className="app-form campaign-form create-panel studio-panel" onSubmit={onSubmit}>
          <section className="form-section">
            <div className="form-section-head">
              <h2>Product</h2>
            </div>

            <div className="source-toggle" role="tablist" aria-label="Product source">
              <button
                type="button"
                role="tab"
                aria-selected={sourceType === 'upload'}
                className={sourceType === 'upload' ? 'is-active' : ''}
                onClick={() => {
                  setSourceType('upload')
                  setError(null)
                }}
                disabled={busy}
              >
                <span className="source-toggle-title">Photo</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sourceType === 'url'}
                className={sourceType === 'url' ? 'is-active' : ''}
                onClick={() => {
                  setSourceType('url')
                  setError(null)
                  setShowDetails(true)
                }}
                disabled={busy}
              >
                <span className="source-toggle-title">Product URL</span>
              </button>
            </div>

            {sourceType === 'upload' ? (
              <div className="upload-block">
                <input
                  ref={fileInputRef}
                  id="product-image"
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
            ) : (
              <div className="url-block">
                <label htmlFor="product-url">Product page URL</label>
                <input
                  id="product-url"
                  type="url"
                  required
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://yourstore.com/products/…"
                  disabled={busy}
                />
              </div>
            )}

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
                  <label htmlFor="product-name">Product name</label>
                  <input
                    id="product-name"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Rose Oud Perfume"
                    disabled={busy}
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="product-brand">Brand</label>
                  <input
                    id="product-brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Maison Luce"
                    disabled={busy}
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="product-price">Price</label>
                  <input
                    id="product-price"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="$48"
                    disabled={busy}
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="product-category">Category</label>
                  <input
                    id="product-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Fragrance"
                    disabled={busy}
                  />
                </div>

                <div className="auth-field details-span">
                  <label htmlFor="product-desc">Description</label>
                  <textarea
                    id="product-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Notes, benefits, who it’s for…"
                    disabled={busy}
                  />
                </div>
              </div>
            )}
          </section>

          <CreativeDirectionFields
            prompt={prompt}
            onPromptChange={setPrompt}
            lighting={lighting}
            onLightingChange={setLighting}
            background={background}
            onBackgroundChange={setBackground}
            mood={mood}
            onMoodChange={setMood}
            styleTheme={styleTheme}
            onStyleThemeChange={setStyleTheme}
            disabled={busy}
            compact
            referencePreviewUrl={referencePreviewUrl}
            onReferenceFile={pickReferenceFile}
            referenceError={referenceError}
            promptPlaceholder="e.g. Soft morning light, keep packaging exact, quiet premium mood…"
          />

          <section className="form-section">
            <div className="form-section-head">
              <h2>Image formats</h2>
              <p>
                {photoStyles.length === 0
                  ? `Pick looks — blank uses ${Math.min(DEFAULT_PHOTO_STYLES.length, limits.maxImages)} starter formats · max ${limits.maxImages}`
                  : `${photoStyles.length} / ${limits.maxImages} selected`}
              </p>
            </div>
            <FormatPickGrid
              items={PHOTO_STYLES}
              selected={photoStyles}
              onChange={setPhotoStyles}
              defaultIds={DEFAULT_PHOTO_STYLES}
              max={limits.maxImages}
              disabled={busy}
              ariaLabel="Image formats"
              onLimitHit={() =>
                setWarning(`Your plan allows up to ${limits.maxImages} images per campaign.`)
              }
            />
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>Video formats</h2>
              <p>
                {limits.maxVideos === 0
                  ? 'Upgrade to unlock video formats'
                  : videoStyles.length === 0
                    ? `Winning formats — hover to preview · blank uses ${Math.min(DEFAULT_VIDEO_STYLES.length, limits.maxVideos)} · max ${limits.maxVideos}`
                    : `${videoStyles.length} / ${limits.maxVideos} selected`}
              </p>
            </div>
            <FormatPickGrid
              items={VIDEO_STYLES}
              selected={videoStyles}
              onChange={setVideoStyles}
              defaultIds={DEFAULT_VIDEO_STYLES}
              max={limits.maxVideos}
              disabled={busy || limits.maxVideos === 0}
              videoAspect
              ariaLabel="Video formats"
              onLimitHit={() =>
                setWarning(`Your plan allows up to ${limits.maxVideos} videos per campaign.`)
              }
            />
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>Extras</h2>
              <p>Optional copy and ads alongside your formats</p>
            </div>
            <div className="campaign-extra-toggles" role="group" aria-label="Campaign extras">
              <label className={`extra-toggle${includeSocial ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={includeSocial}
                  onChange={(e) => setIncludeSocial(e.target.checked)}
                  disabled={busy}
                />
                <span>Social copy</span>
              </label>
              <label className={`extra-toggle${includeAds ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={includeAds}
                  onChange={(e) => setIncludeAds(e.target.checked)}
                  disabled={busy}
                />
                <span>Ad creative + copy</span>
              </label>
              <label className={`extra-toggle${includeStrategy ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={includeStrategy}
                  onChange={(e) => setIncludeStrategy(e.target.checked)}
                  disabled={busy}
                />
                <span>Strategy notes</span>
              </label>
            </div>
            <p className="dash-muted" style={{ marginTop: 10 }}>
              Pack preview: ~{Math.min(photoCount, limits.maxImages)} images
              {limits.maxVideos > 0
                ? ` · ~${Math.min(videoCount, limits.maxVideos)} videos`
                : ''}
              {includeSocial ? ' · social copy' : ''}
              {includeAds ? ' · ads' : ''}
            </p>
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
            {busy ? 'Creating…' : 'Create campaign'}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </main>
    </AppLayout>
  )
}
