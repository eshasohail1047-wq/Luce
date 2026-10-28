import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CreativeDirectionFields from '../components/CreativeDirectionFields'
import FormatPickGrid from '../components/FormatPickGrid'
import { useAuth } from '../auth/AuthProvider'
import {
  createCampaignWithProduct,
  friendlyFirestoreError,
  getProductById,
  type ProductSourceType,
} from '../lib/campaigns'
import { dataUrlToFile, imageUrlToFile } from '../lib/recreateSession'
import {
  remoteMediaToFile,
  requestFetchProductPage,
  requestFetchRemoteMedia,
} from '../lib/fetchProduct'
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
  compressImageDataUrl,
  fileToDataUrl,
  loadLocalCampaign,
  newLocalId,
  resolveProductImage,
  saveLocalCampaign,
  stashCampaignImageSafe,
  stashProductImageSafe,
  stashCampaignRefImage,
  withTimeout,
} from '../lib/localDemoCampaign'

export default function NewCampaignPage() {
  const { user, plan, freeImageUsed, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
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
  const [referenceUrlBusy, setReferenceUrlBusy] = useState(false)
  const [urlImages, setUrlImages] = useState<string[]>([])
  const [urlFetchBusy, setUrlFetchBusy] = useState(false)
  const [urlFetchError, setUrlFetchError] = useState<string | null>(null)
  const [selectedUrlImage, setSelectedUrlImage] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showDetails, setShowDetails] = useState(true)
  const [photoStyles, setPhotoStyles] = useState<PhotoStyleId[]>([])
  const [videoStyles, setVideoStyles] = useState<VideoStyleId[]>([])
  const [includeHooks, setIncludeHooks] = useState(true)
  const [includeCaptions, setIncludeCaptions] = useState(true)
  const [includeCtas, setIncludeCtas] = useState(true)
  const [includeHashtags, setIncludeHashtags] = useState(true)
  const [includeAdCreative, setIncludeAdCreative] = useState(true)
  const [includeAdCopy, setIncludeAdCopy] = useState(true)
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
    // Don't clear on null — productId hydration may set a remote/data preview without a File yet.
    if (!imageFile) return
    const url = URL.createObjectURL(imageFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  useEffect(() => {
    if (!referenceFile) return
    const url = URL.createObjectURL(referenceFile)
    setReferencePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [referenceFile])

  useEffect(() => {
    if (sourceType !== 'url') return
    const trimmed = productUrl.trim()
    if (!/^https?:\/\//i.test(trimmed)) {
      setUrlImages([])
      setSelectedUrlImage(null)
      setUrlFetchError(null)
      return
    }
    let cancelled = false
    const timer = window.setTimeout(() => {
      void (async () => {
        setUrlFetchBusy(true)
        setUrlFetchError(null)
        try {
          const page = await requestFetchProductPage(trimmed)
          if (cancelled) return
          setUrlImages(page.images)
          if (page.title && !productName.trim()) setProductName(page.title)
          if (page.description && !description.trim()) setDescription(page.description)
          const first = page.images[0]
          if (first) await applyProductUrlImage(first)
        } catch (err) {
          if (cancelled) return
          setUrlImages([])
          setSelectedUrlImage(null)
          setUrlFetchError(
            err instanceof Error ? err.message : 'Could not fetch product photos.',
          )
        } finally {
          if (!cancelled) setUrlFetchBusy(false)
        }
      })()
    }, 650)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, productUrl])

  async function applyProductUrlImage(imageUrl: string) {
    setSelectedUrlImage(imageUrl)
    setPreviewUrl(imageUrl)
    setError(null)
    try {
      const media = await requestFetchRemoteMedia(imageUrl, 'image')
      const file = await remoteMediaToFile(media, 'product.jpg')
      setImageFile(file)
    } catch (err) {
      console.warn('[NewCampaign] product URL image download failed', err)
      setImageFile(null)
      const viaHttps = await imageUrlToFile(imageUrl, 'product.jpg')
      if (viaHttps) setImageFile(viaHttps)
    }
  }

  function pickReferenceFile(file: File | null) {
    setReferenceError(null)
    if (!file) {
      setReferenceFile(null)
      setReferencePreviewUrl(null)
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

  async function applyReferenceUrl(rawUrl: string) {
    setReferenceError(null)
    setReferenceUrlBusy(true)
    try {
      const media = await requestFetchRemoteMedia(rawUrl, 'image')
      const file = await remoteMediaToFile(media, 'reference.jpg')
      setReferenceFile(file)
      setReferencePreviewUrl(media.dataUrl)
    } catch (err) {
      setReferenceError(
        err instanceof Error ? err.message : 'Could not load that reference link.',
      )
    } finally {
      setReferenceUrlBusy(false)
    }
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

  useEffect(() => {
    if (!user) return
    const productId = searchParams.get('productId')?.trim()
    if (!productId) return
    let cancelled = false
    void (async () => {
      const product = await getProductById(productId, user.uid)
      if (cancelled || !product) return
      setProductName(product.name)
      setShowDetails(true)
      if (product.brand) setBrand(product.brand)
      if (product.description) setDescription(product.description)
      if (product.category) setCategory(product.category)
      if (product.sourceType === 'url' && product.sourceUrl) {
        setSourceType('url')
        setProductUrl(product.sourceUrl)
      }
      const imageUrl = await resolveProductImage(product.id, product.imageUrl)
      if (cancelled || !imageUrl) return
      setSourceType('upload')
      setPreviewUrl(imageUrl)
      const file = await imageUrlToFile(imageUrl, `${product.name || 'product'}.jpg`)
      if (!cancelled && file) setImageFile(file)
      void stashProductImageSafe(product.id, imageUrl)
    })()
    return () => {
      cancelled = true
    }
  }, [user, searchParams])

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
      photoStyles,
      videoStyles,
      includeHooks,
      includeCaptions,
      includeCtas,
      includeHashtags,
      includeAdCreative,
      includeAdCopy,
      includeStrategy,
    })
    const id = newLocalId('campaign')
    let imageUrl = imageDataUrl || undefined
    if (!imageUrl && imageFile) {
      imageUrl = await compressImageDataUrl(await fileToDataUrl(imageFile))
    }
    if (imageUrl?.startsWith('data:image/')) {
      imageUrl = await compressImageDataUrl(imageUrl)
    }
    if (imageUrl?.startsWith('blob:')) {
      throw new Error('Product photo did not finish loading. Re-select it and try again.')
    }
    if (imageUrl) await stashCampaignImageSafe(id, imageUrl)
    const saved = saveLocalCampaign({
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
      imageUrl: imageUrl?.startsWith('data:') ? undefined : imageUrl,
      createdAt: Date.now(),
    })
    if (!saved || !loadLocalCampaign(id)) {
      throw new Error(
        'Could not save this campaign in the browser. Try a smaller photo.',
      )
    }
    if (referenceFile) {
      try {
        stashCampaignRefImage(
          id,
          await compressImageDataUrl(await fileToDataUrl(referenceFile)),
        )
      } catch {
        /* optional */
      }
    }
    navigate(`/app/campaigns/${id}`, {
      replace: true,
      state: {
        autoGenerate: true,
        ...(imageUrl ? { productImage: imageUrl } : {}),
      },
    })
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
    if (sourceType === 'url' && !imageFile && !selectedUrlImage && !previewUrl) {
      setError('Pick a product photo from the URL, or upload one.')
      return
    }
    if (!assertCanCreate()) return
    setBusy(true)
    setError(null)
    setWarning(null)

    let imageDataUrl: string | undefined
    try {
      if (imageFile) {
        imageDataUrl = await compressImageDataUrl(await fileToDataUrl(imageFile))
      } else if (selectedUrlImage || (previewUrl && /^https?:\/\//i.test(previewUrl))) {
        const src = selectedUrlImage || previewUrl!
        try {
          const media = await requestFetchRemoteMedia(src, 'image')
          imageDataUrl = await compressImageDataUrl(media.dataUrl)
        } catch {
          imageDataUrl = src
        }
      }
    } catch {
      /* optional preview */
    }

    let fileForCreate = imageFile
    if (!fileForCreate && imageDataUrl?.startsWith('data:image/')) {
      fileForCreate = await dataUrlToFile(imageDataUrl, 'product.jpg')
    }

    try {
      const result = await withTimeout(
        createCampaignWithProduct({
          userId: user.uid,
          sourceType: fileForCreate || imageDataUrl ? 'upload' : sourceType,
          productName: productName.trim() || undefined,
          productUrl: productUrl.trim() || undefined,
          description: description.trim() || undefined,
          brand: brand.trim() || undefined,
          price: price.trim() || undefined,
          category: category.trim() || undefined,
          imageFile: fileForCreate,
          photoStyles,
          videoStyles,
          includeHooks,
          includeCaptions,
          includeCtas,
          includeHashtags,
          includeAdCreative,
          includeAdCopy,
          includeStrategy,
          creativeDirection: {
            prompt,
            lighting: lighting || undefined,
            background: background || undefined,
            mood: mood || undefined,
            styleTheme: styleTheme || undefined,
          },
        }),
        45_000,
        'create-campaign',
      )
      const cloudImage = result.imageUrls?.[0] || imageDataUrl
      const productStill = imageDataUrl || cloudImage
      if (productStill) {
        await stashCampaignImageSafe(result.campaignId, productStill)
        await stashProductImageSafe(result.productId, productStill)
      }
      if (result.storageWarning) {
        setWarning(result.storageWarning)
      }
      if (referenceFile) {
        try {
          stashCampaignRefImage(
            result.campaignId,
            await compressImageDataUrl(await fileToDataUrl(referenceFile)),
          )
        } catch {
          /* optional */
        }
      }
      navigate(`/app/campaigns/${result.campaignId}`, {
        replace: true,
        state: {
          autoGenerate: true,
          ...(imageDataUrl || cloudImage
            ? { productImage: imageDataUrl || cloudImage }
            : {}),
        },
      })
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
                          onClick={() => {
                            setImageFile(null)
                            setPreviewUrl(null)
                          }}
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
                {urlFetchBusy ? (
                  <p className="field-hint">Fetching photos from that page…</p>
                ) : null}
                {urlFetchError ? (
                  <p className="auth-error" role="alert">
                    {urlFetchError}
                  </p>
                ) : null}
                {urlImages.length > 0 ? (
                  <div className="url-image-picker" role="listbox" aria-label="Product photos from URL">
                    <p className="field-hint">Pick the product photo to use</p>
                    <div className="url-image-grid">
                      {urlImages.map((src) => (
                        <button
                          key={src}
                          type="button"
                          role="option"
                          aria-selected={selectedUrlImage === src}
                          className={`url-image-thumb${selectedUrlImage === src ? ' is-selected' : ''}`}
                          onClick={() => void applyProductUrlImage(src)}
                          disabled={busy || urlFetchBusy}
                        >
                          <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />
                        </button>
                      ))}
                    </div>
                    {previewUrl ? (
                      <div className="upload-preview url-image-selected">
                        <img src={previewUrl} alt="Selected product" referrerPolicy="no-referrer" />
                      </div>
                    ) : null}
                  </div>
                ) : null}
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
            onReferenceUrl={applyReferenceUrl}
            referenceUrlBusy={referenceUrlBusy}
            referenceError={referenceError}
            promptPlaceholder="e.g. Soft morning light, keep packaging exact, quiet premium mood…"
          />

          <section className="form-section">
            <div className="form-section-head">
              <h2>Image formats</h2>
              <p>
                {photoStyles.length === 0
                  ? `Pick as many as you want — blank uses ${DEFAULT_PHOTO_STYLES.length} starters`
                  : `${photoStyles.length} selected · choose any combination`}
              </p>
            </div>
            <FormatPickGrid
              items={PHOTO_STYLES}
              selected={photoStyles}
              onChange={setPhotoStyles}
              defaultIds={DEFAULT_PHOTO_STYLES}
              max={Math.max(limits.maxImages, PHOTO_STYLES.length)}
              disabled={busy}
              ariaLabel="Image formats"
            />
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>Video formats</h2>
              <p>
                {limits.maxVideos === 0
                  ? 'Upgrade to unlock video formats'
                  : videoStyles.length === 0
                    ? `Pick as many as you want — blank uses ${DEFAULT_VIDEO_STYLES.length} starters`
                    : `${videoStyles.length} selected · choose any combination`}
              </p>
            </div>
            <FormatPickGrid
              items={VIDEO_STYLES}
              selected={videoStyles}
              onChange={setVideoStyles}
              defaultIds={DEFAULT_VIDEO_STYLES}
              max={Math.max(limits.maxVideos, VIDEO_STYLES.length)}
              disabled={busy || limits.maxVideos === 0}
              videoAspect
              ariaLabel="Video formats"
            />
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>Ads & copy extras</h2>
              <p>Add hooks, captions, CTAs and ad creatives to the same campaign</p>
            </div>
            <div className="campaign-extra-toggles" role="group" aria-label="Campaign extras">
              <label className={`extra-toggle${includeHooks ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={includeHooks}
                  onChange={(e) => setIncludeHooks(e.target.checked)}
                  disabled={busy}
                />
                <span>Hooks</span>
              </label>
              <label className={`extra-toggle${includeCaptions ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={includeCaptions}
                  onChange={(e) => setIncludeCaptions(e.target.checked)}
                  disabled={busy}
                />
                <span>Captions</span>
              </label>
              <label className={`extra-toggle${includeCtas ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={includeCtas}
                  onChange={(e) => setIncludeCtas(e.target.checked)}
                  disabled={busy}
                />
                <span>CTAs</span>
              </label>
              <label className={`extra-toggle${includeHashtags ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={includeHashtags}
                  onChange={(e) => setIncludeHashtags(e.target.checked)}
                  disabled={busy}
                />
                <span>Hashtags</span>
              </label>
              <label className={`extra-toggle${includeAdCreative ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={includeAdCreative}
                  onChange={(e) => setIncludeAdCreative(e.target.checked)}
                  disabled={busy}
                />
                <span>Ad creative</span>
              </label>
              <label className={`extra-toggle${includeAdCopy ? ' is-on' : ''}`}>
                <input
                  type="checkbox"
                  checked={includeAdCopy}
                  onChange={(e) => setIncludeAdCopy(e.target.checked)}
                  disabled={busy}
                />
                <span>Ad copy</span>
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
              Pack preview: ~{photoCount} images
              {limits.maxVideos > 0 ? ` · ~${videoCount} videos` : ''}
              {includeHooks ? ' · hooks' : ''}
              {includeCaptions ? ' · captions' : ''}
              {includeCtas ? ' · CTAs' : ''}
              {includeAdCreative || includeAdCopy ? ' · ads' : ''}
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
