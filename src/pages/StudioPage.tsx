import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CreativeDirectionFields from '../components/CreativeDirectionFields'
import { useAuth } from '../auth/AuthProvider'
import { createStudioProject, type ProductSourceType } from '../lib/campaigns'
import type {
  BackgroundId,
  LightingId,
  MoodId,
  StyleThemeId,
} from '../lib/creativeDirection'
import {
  AD_STYLES,
  PHOTO_STYLES,
  VIDEO_STYLES,
  type AdStyleId,
  type PhotoStyleId,
  type StudioKind,
  type VideoStyleId,
} from '../lib/deliverables'
import { consumePendingProduct } from '../lib/pendingProduct'
import { canAccessStudio } from '../lib/planAccess'
import UpgradeGate from '../components/UpgradeGate'

const VALID_KINDS: StudioKind[] = ['photos', 'videos', 'ads']

function isStudioKind(value: string | undefined): value is StudioKind {
  return Boolean(value && VALID_KINDS.includes(value as StudioKind))
}

export default function StudioPage() {
  const { kind: kindParam } = useParams()
  const kind = isStudioKind(kindParam) ? kindParam : null
  const [searchParams] = useSearchParams()
  const { user, plan, loading } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [sourceType, setSourceType] = useState<ProductSourceType>('upload')
  const [productName, setProductName] = useState('')
  const [productUrl, setProductUrl] = useState('')
  const [description, setDescription] = useState('')
  const [brand, setBrand] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [photoStyles, setPhotoStyles] = useState<PhotoStyleId[]>([])
  const [videoStyles, setVideoStyles] = useState<VideoStyleId[]>([])
  const [adStyles, setAdStyles] = useState<AdStyleId[]>([])
  const [prompt, setPrompt] = useState('')
  const [lighting, setLighting] = useState<LightingId | ''>('')
  const [background, setBackground] = useState<BackgroundId | ''>('')
  const [mood, setMood] = useState<MoodId | ''>('')
  const [styleTheme, setStyleTheme] = useState<StyleThemeId | ''>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [tryFree, setTryFree] = useState(false)

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
    if (!user) return
    let cancelled = false
    void (async () => {
      const pending = await consumePendingProduct()
      if (cancelled) return
      if (pending.tryFree) setTryFree(true)
      if (pending.url) {
        setSourceType('url')
        setProductUrl(pending.url)
        setShowDetails(true)
      }
      if (pending.file) {
        setSourceType('upload')
        setImageFile(pending.file)
        if (!pending.url) setShowDetails(true)
      }
      if (pending.hint && !pending.file && !pending.url) {
        setShowDetails(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    setPhotoStyles([])
    setVideoStyles([])
    setAdStyles([])
    setPrompt('')
    setLighting('')
    setBackground('')
    setMood('')
    setStyleTheme('')
    setError(null)
    setWarning(null)

    const style = searchParams.get('style')
    if (kind === 'videos' && style === 'ugc') {
      setVideoStyles(['ugc_video'])
    }
  }, [kind, searchParams])

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
    return <Navigate to="/app/studio/photos" replace />
  }

  if (!canAccessStudio(plan, kind)) {
    const titles: Record<StudioKind, { title: string; feature: string }> = {
      photos: { title: 'Image Studio', feature: 'Product images' },
      videos: { title: 'Video Studio', feature: 'Product videos & UGC' },
      ads: { title: 'Ads & Social', feature: 'Ad creatives & social copy' },
    }
    return (
      <AppLayout>
        <UpgradeGate title={titles[kind].title} feature={titles[kind].feature} />
      </AppLayout>
    )
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
    if (!user || !kind) return
    if (sourceType === 'upload' && !imageFile) {
      setError('Add a product photo to continue.')
      return
    }
    if (sourceType === 'url' && !productUrl.trim()) {
      setError('Add a product URL to continue.')
      return
    }
    setBusy(true)
    setError(null)
    setWarning(null)
    try {
      const result = await createStudioProject({
        userId: user.uid,
        kind,
        sourceType,
        productUrl: sourceType === 'url' ? productUrl.trim() : undefined,
        productName: productName.trim() || undefined,
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        imageFile: sourceType === 'upload' ? imageFile : null,
        photoStyles,
        videoStyles,
        adStyles,
        tryFree: tryFree && kind === 'photos',
        creativeDirection: {
          prompt,
          lighting: lighting || undefined,
          background: background || undefined,
          mood: mood || undefined,
          styleTheme: styleTheme || undefined,
        },
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

  const isUgcFocus = kind === 'videos' && searchParams.get('style') === 'ugc'
  const usingDefaults = selectionCount() === 0

  const studioMeta =
    kind === 'photos'
      ? {
          kicker: 'Image Studio',
          title: tryFree ? 'Your free product images' : 'Craft product images',
          lead: tryFree
            ? 'Your product is ready — pick styles and generate your first free image pack. Packaging stays true across every still.'
            : 'Add a product photo or URL. We’ll keep packaging true across studio, lifestyle, and promo stills.',
          image: '/images/audience-beauty.jpg',
          accent: 'photos' as const,
          cta: tryFree ? 'Generate free images' : 'Generate images',
          stylesTitle: 'Choose photo styles',
          stylesHint: 'Pick one or more — or leave blank for a full set.',
        }
      : kind === 'videos' && isUgcFocus
        ? {
            kicker: 'UGC Studio',
            title: 'Creator-style product videos',
            lead: 'Start from your product photo. Build authentic shorts ready for Reels, TikTok, and social proof.',
            image: '/images/ugc-makeup-lipstick.jpg',
            accent: 'videos' as const,
            cta: 'Generate UGC video',
            stylesTitle: 'Choose video formats',
            stylesHint: 'UGC is pre-selected. Add more formats if you want.',
          }
        : kind === 'videos'
          ? {
              kicker: 'Video Studio',
              title: 'Bring the product to life',
              lead: 'Upload a product photo, then choose UGC, Reels, or polished marketing clips.',
              image: '/images/campaign-home-lifestyle.jpg',
              accent: 'videos' as const,
              cta: 'Generate videos',
              stylesTitle: 'Choose video formats',
              stylesHint: 'Pick formats — or leave blank for all video types.',
            }
          : {
              kicker: 'Ads & Social',
              title: 'Build ad-ready creatives',
              lead: 'Upload your product, then generate paid visuals and conversion-focused copy for Meta, TikTok, and more.',
              image: '/images/output-social.jpg',
              accent: 'ads' as const,
              cta: 'Generate ads',
              stylesTitle: 'Choose ad outputs',
              stylesHint: 'Select creatives, copy, or both — blank uses defaults.',
            }

  const styleVisuals: Record<string, string> = {
    product_image: '/images/fidelity-studio.jpg',
    lifestyle_image: '/images/campaign-home-lifestyle.jpg',
    promo_creative: '/images/campaign-beauty-flatlay.jpg',
    ugc_video: '/images/campaign-ugc-serum.jpg',
    reels_video: '/images/ugc-makeup-lipstick.jpg',
    marketing_video: '/images/campaign-ad-handbag.jpg',
    ad_creative: '/images/output-ads.jpg',
    ad_copy: '/images/output-social.jpg',
  }

  return (
    <AppLayout>
      <main className={`app-main campaign-create studio-page studio-page-${studioMeta.accent}`}>
        <header className={`studio-hero tone-${studioMeta.accent}`}>
          <div className="studio-hero-copy">
            <p className="studio-hero-kicker">{studioMeta.kicker}</p>
            <h1>{studioMeta.title}</h1>
            <p className="studio-hero-lead">{studioMeta.lead}</p>
            {tryFree && kind === 'photos' && (
              <p className="studio-free-banner" role="status">
                Free trial — first image pack included, no card required
              </p>
            )}
            <ol className="studio-hero-steps" aria-label="How it works">
              <li>{sourceType === 'url' ? 'Confirm product' : 'Upload product'}</li>
              <li>Set creative direction</li>
              <li>Generate</li>
            </ol>
          </div>
          <div className="studio-hero-media" aria-hidden="true">
            <img src={studioMeta.image} alt="" />
            <div className="studio-hero-glow" />
          </div>
        </header>

        <form className="app-form campaign-form create-panel studio-panel" onSubmit={onSubmit}>
          <section className="form-section">
            <div className="form-section-head">
              <h2>1. Product</h2>
              <p>Photo or product page URL</p>
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
            ) : (
              <div className="url-block">
                <label htmlFor="studio-product-url">Product page URL</label>
                <input
                  id="studio-product-url"
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
              <h2>2. Creative direction</h2>
              <p>Optional — shape lighting, mood, and scene</p>
            </div>
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
              promptPlaceholder={
                kind === 'photos'
                  ? 'e.g. Soft morning light on marble, keep bottle label sharp…'
                  : kind === 'videos'
                    ? 'e.g. Slow 360 reveal, soft voiceover energy, keep packaging true…'
                    : 'e.g. Bold offer creative for Meta ads, clean white space for CTA…'
              }
            />
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>3. {studioMeta.stylesTitle}</h2>
              <p>
                {usingDefaults
                  ? studioMeta.stylesHint
                  : `${selectionCount()} selected`}
              </p>
            </div>

            {kind === 'photos' && (
              <div className="style-pick-grid" role="group" aria-label="Photo styles">
                {PHOTO_STYLES.map((item) => {
                  const checked = photoStyles.includes(item.id)
                  return (
                    <label
                      key={item.id}
                      className={`style-pick${checked ? ' is-checked' : ''}${usingDefaults ? ' is-default' : ''}`}
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
                      <span className="style-pick-media">
                        <img src={styleVisuals[item.id]} alt="" />
                      </span>
                      <span className="style-pick-body">
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}

            {kind === 'videos' && (
              <div className="style-pick-grid" role="group" aria-label="Video types">
                {VIDEO_STYLES.map((item) => {
                  const checked = videoStyles.includes(item.id)
                  return (
                    <label
                      key={item.id}
                      className={`style-pick${checked ? ' is-checked' : ''}${usingDefaults ? ' is-default' : ''}`}
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
                      <span className="style-pick-media">
                        <img src={styleVisuals[item.id]} alt="" />
                      </span>
                      <span className="style-pick-body">
                        <strong>{item.label}</strong>
                        <span>{item.description}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}

            {kind === 'ads' && (
              <div className="style-pick-grid style-pick-grid-2" role="group" aria-label="Ad outputs">
                {AD_STYLES.map((item) => {
                  const checked = adStyles.includes(item.id)
                  return (
                    <label
                      key={item.id}
                      className={`style-pick${checked ? ' is-checked' : ''}${usingDefaults ? ' is-default' : ''}`}
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
                      <span className="style-pick-media">
                        <img src={styleVisuals[item.id]} alt="" />
                      </span>
                      <span className="style-pick-body">
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

          <button type="submit" className="btn btn-grad campaign-submit studio-submit" disabled={busy}>
            {busy ? 'Creating…' : studioMeta.cta}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </main>
    </AppLayout>
  )
}
