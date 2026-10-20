import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CreativeDirectionFields from '../components/CreativeDirectionFields'
import FormatPickGrid from '../components/FormatPickGrid'
import { useAuth } from '../auth/AuthProvider'
import { getPlanLimits } from '../lib/planLimits'
import { createStudioProject, type ProductSourceType } from '../lib/campaigns'
import type {
  BackgroundId,
  LightingId,
  MoodId,
  StyleThemeId,
} from '../lib/creativeDirection'
import {
  AD_STYLES,
  DEFAULT_PHOTO_STYLES,
  DEFAULT_VIDEO_STYLES,
  PHOTO_STYLES,
  VIDEO_STYLES,
  normalizePhotoStyleId,
  normalizeVideoStyleId,
  resolveAdStyles,
  resolvePhotoStyles,
  resolveVideoStyles,
  type AdStyleId,
  type PhotoStyleId,
  type StudioKind,
  type VideoStyleId,
} from '../lib/deliverables'
import { updateCampaignStatus } from '../lib/campaigns'
import {
  fileToDataUrl,
  isLocalCampaignId,
  newLocalId,
  saveLocalCampaign,
  stashCampaignImage,
  stashCampaignOutputs,
  stashCampaignRefImage,
  updateLocalCampaign,
  withTimeout,
} from '../lib/localDemoCampaign'
import {
  isImageAssetKind,
  requestGenerateImages,
} from '../lib/generateImages'
import { recreateMockOutput, type MockOutput } from '../lib/mockCampaign'
import { consumePendingProduct } from '../lib/pendingProduct'
import { canGenerate, type GenerateAction } from '../lib/planAccess'
import {
  clearRecreateSession,
  dataUrlToFile,
  loadRecreateSession,
  type RecreateSession,
} from '../lib/recreateSession'
import PaywallModal from '../components/PaywallModal'

const VALID_KINDS: StudioKind[] = ['photos', 'videos', 'ads']

function isStudioKind(value: string | undefined): value is StudioKind {
  return Boolean(value && VALID_KINDS.includes(value as StudioKind))
}

export default function StudioPage() {
  const { kind: kindParam } = useParams()
  const kind = isStudioKind(kindParam) ? kindParam : null
  const [searchParams] = useSearchParams()
  const { user, plan, freeImageUsed, markFreeImageUsed, loading } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [sourceType, setSourceType] = useState<ProductSourceType>('upload')
  const [productName, setProductName] = useState('')
  const [productUrl, setProductUrl] = useState('')
  const [description, setDescription] = useState('')
  const [brand, setBrand] = useState('')
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
  const [recreate, setRecreate] = useState<RecreateSession | null>(null)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [paywallReason, setPaywallReason] = useState<string | undefined>()
  const isRecreate = Boolean(recreate) || searchParams.get('recreate') === '1'
  const limits = getPlanLimits(plan)

  function generateActionForKind(): GenerateAction {
    if (isRecreate) {
      if (kind === 'videos') return 'recreate-videos'
      if (kind === 'ads') return 'recreate-ads'
      return 'recreate-photos'
    }
    if (kind === 'videos') return 'videos'
    if (kind === 'ads') return 'ads'
    return 'photos'
  }

  function assertCanGenerate(): boolean {
    const check = canGenerate({
      plan,
      action: generateActionForKind(),
      freeImageUsed,
    })
    if (check.allowed) return true
    setPaywallReason(check.reason)
    setPaywallOpen(true)
    return false
  }

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
    const wantsVideo = kind === 'videos'
    if (wantsVideo) {
      if (!file.type.startsWith('video/')) {
        setReferenceError('Reference must be a video (MP4, WebM, or MOV).')
        return
      }
      if (file.size > 40 * 1024 * 1024) {
        setReferenceError('Reference video must be under 40MB.')
        return
      }
    } else {
      if (!file.type.startsWith('image/')) {
        setReferenceError('Reference must be an image (JPG, PNG, or WebP).')
        return
      }
      if (file.size > 12 * 1024 * 1024) {
        setReferenceError('Reference image must be under 12MB.')
        return
      }
    }
    setReferenceFile(file)
  }

  useEffect(() => {
    if (!user) return
    let cancelled = false
    void (async () => {
      const session = loadRecreateSession()
      if (
        session &&
        searchParams.get('recreate') === '1' &&
        (!kind || session.studioKind === kind)
      ) {
        if (cancelled) return
        setRecreate(session)
        setProductName(session.productName)
        setShowDetails(true)
        if (session.productUrl) {
          setSourceType('url')
          setProductUrl(session.productUrl)
        }
        if (session.imageUrl) {
          setSourceType('upload')
          setPreviewUrl(session.imageUrl)
          const file = await dataUrlToFile(
            session.imageUrl,
            `${session.productName || 'product'}.jpg`,
          )
          if (!cancelled && file) setImageFile(file)
        }
        const asset = session.assetType
        const photoId = normalizePhotoStyleId(asset)
        const videoId = normalizeVideoStyleId(asset)
        if (session.studioKind === 'photos' && photoId) {
          setPhotoStyles([photoId])
        } else if (session.studioKind === 'videos' && videoId) {
          setVideoStyles([videoId])
        } else if (session.studioKind === 'ads' && AD_STYLES.some((s) => s.id === asset)) {
          setAdStyles([asset as AdStyleId])
        }
        setPrompt(
          `Recreate “${session.label}”.\nWhat I want changed: `,
        )
        return
      }

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
  }, [user, kind, searchParams])

  useEffect(() => {
    if (searchParams.get('recreate') === '1') return
    setPhotoStyles([])
    setVideoStyles([])
    setAdStyles([])
    setPrompt('')
    setLighting('')
    setBackground('')
    setMood('')
    setStyleTheme('')
    setReferenceFile(null)
    setReferenceError(null)
    setError(null)
    setWarning(null)
    setRecreate(null)

    const style = searchParams.get('style')
    if (kind === 'videos' && style === 'ugc') {
      setVideoStyles(['video_ugc_selfie', 'video_howto_demo'])
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

  async function applyRecreateAndReturn(session: RecreateSession) {
    const outputs: MockOutput[] =
      session.outputs?.length > 0
        ? session.outputs
        : [
            {
              id: session.assetId,
              assetType: session.assetType,
              label: session.label,
              kind: session.kind,
              imageUrl: session.imageUrl,
              version: 1,
            },
          ]

    const index = Math.max(
      0,
      outputs.findIndex((o) => o.id === session.assetId || o.assetType === session.assetType),
    )
    const current = outputs[index] || outputs[0]!
    let next = recreateMockOutput(
      current,
      index,
      productName.trim() || session.productName,
      previewUrl || session.imageUrl,
    )
    const directionNote = prompt.trim()
    next = {
      ...next,
      note: directionNote
        ? `Recreated in studio · ${directionNote.slice(0, 120)}`
        : next.note,
      text:
        next.kind === 'copy'
          ? directionNote
            ? `${directionNote}\n\n—\nUpdated for ${productName.trim() || session.productName}`
            : next.text
          : next.text,
    }

    if (isImageAssetKind(current.assetType) && next.kind === 'image') {
      try {
        let productImage: string | undefined
        if (imageFile) {
          try {
            productImage = await fileToDataUrl(imageFile)
          } catch {
            /* fall through */
          }
        }
        if (!productImage) {
          const candidate = session.imageUrl || previewUrl || undefined
          if (
            candidate &&
            (candidate.startsWith('data:') || candidate.startsWith('http'))
          ) {
            productImage = candidate
          }
        }

        let referenceImage: string | undefined
        if (referenceFile) {
          try {
            referenceImage = await fileToDataUrl(referenceFile)
          } catch {
            /* optional */
          }
        }

        const ai = await requestGenerateImages({
          productName: productName.trim() || session.productName,
          productImage,
          referenceImage,
          creativeDirection: {
            prompt: directionNote || undefined,
            lighting: lighting || undefined,
            background: background || undefined,
            mood: mood || undefined,
            styleTheme: styleTheme || undefined,
          },
          assets: [current.assetType],
          recreateNote: directionNote || undefined,
        })
        const generated = ai.assets[0]
        if (generated?.imageDataUrl) {
          next = {
            ...next,
            imageUrl: generated.imageDataUrl,
            note: directionNote
              ? `AI recreate · ${directionNote.slice(0, 120)}`
              : 'AI recreate · packaging fidelity from your product photo',
          }
        }
      } catch (err) {
        console.warn('[Studio] AI recreate fallback to mock', err)
        setWarning(
          err instanceof Error
            ? `${err.message} Showing a demo variant instead.`
            : 'AI recreate unavailable — showing a demo variant instead.',
        )
      }
    }
    const nextOutputs = outputs.map((o, i) => (i === index ? next : o))
    const nextStatus =
      session.campaignStatus === 'exported' ? 'ready' : session.campaignStatus || 'ready'

    stashCampaignOutputs(session.campaignId, nextOutputs)

    if (isLocalCampaignId(session.campaignId)) {
      updateLocalCampaign(session.campaignId, {
        status: nextStatus,
        outputs: nextOutputs,
        imageUrl: previewUrl || session.imageUrl,
      })
    } else {
      try {
        await updateCampaignStatus(session.campaignId, nextStatus as 'ready' | 'generating' | 'exported', {
          outputs: nextOutputs,
          demoPack: true,
        })
      } catch (err) {
        console.warn('[Studio] Firestore recreate save failed — using local stash', err)
      }
    }

    clearRecreateSession()
    navigate(`/app/campaigns/${session.campaignId}`, { replace: true })
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !kind) return

    const session = recreate || loadRecreateSession()
    if (session && searchParams.get('recreate') === '1') {
      if (!prompt.trim()) {
        setError('Describe what you want changed before recreating.')
        return
      }
      if (!assertCanGenerate()) return
      setBusy(true)
      setError(null)
      setWarning(null)
      try {
        await new Promise((r) => setTimeout(r, 700))
        if (generateActionForKind() === 'recreate-photos' && plan === 'free' && !freeImageUsed) {
          await markFreeImageUsed()
        }
        await applyRecreateAndReturn(session)
      } catch (err) {
        console.error(err)
        setError(err instanceof Error ? err.message : 'Could not recreate this asset.')
        setBusy(false)
      }
      return
    }

    if (sourceType === 'upload' && !imageFile) {
      setError('Add a product photo to continue.')
      return
    }
    if (sourceType === 'url' && !productUrl.trim()) {
      setError('Add a product URL to continue.')
      return
    }
    if (!assertCanGenerate()) return
    setBusy(true)
    setError(null)
    setWarning(null)

    let imageDataUrl: string | undefined
    try {
      if (imageFile) imageDataUrl = await fileToDataUrl(imageFile)
    } catch {
      /* optional */
    }

    const clampedPhotos = photoStyles.slice(0, limits.maxImages)
    const clampedVideos = videoStyles.slice(0, limits.maxVideos)
    const selectedAssets =
      kind === 'photos'
        ? resolvePhotoStyles(clampedPhotos).slice(0, limits.maxImages)
        : kind === 'videos'
          ? resolveVideoStyles(clampedVideos).slice(0, Math.max(limits.maxVideos, 1))
          : resolveAdStyles(adStyles)
    const displayName =
      productName.trim() ||
      (imageFile ? imageFile.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') : '') ||
      'Untitled product'

    const isFreeTry = kind === 'photos' && plan === 'free' && !freeImageUsed

    try {
      const result = await withTimeout(
        createStudioProject({
          userId: user.uid,
          kind,
          sourceType,
          productUrl: sourceType === 'url' ? productUrl.trim() : undefined,
          productName: productName.trim() || undefined,
          description: description.trim() || undefined,
          brand: brand.trim() || undefined,
          imageFile: sourceType === 'upload' ? imageFile : null,
          photoStyles: clampedPhotos,
          videoStyles: clampedVideos,
          adStyles,
          tryFree: isFreeTry,
          creativeDirection: {
            prompt,
            lighting: lighting || undefined,
            background: background || undefined,
            mood: mood || undefined,
            styleTheme: styleTheme || undefined,
          },
        }),
        12_000,
        'create-studio',
      )
      if (imageDataUrl) stashCampaignImage(result.campaignId, imageDataUrl)
      if (referenceFile) {
        try {
          stashCampaignRefImage(result.campaignId, await fileToDataUrl(referenceFile))
        } catch {
          /* optional */
        }
      }
      // Reserve the free image try when the project is started
      if (isFreeTry) await markFreeImageUsed()
      navigate(`/app/campaigns/${result.campaignId}`, { replace: true })
    } catch (err) {
      console.warn('[Studio] falling back to local demo project', err)
      try {
        const id = newLocalId('studio')
        const titleSuffix =
          kind === 'photos' ? 'Photos' : kind === 'videos' ? 'Videos' : 'Ads'
        const imageUrl = imageDataUrl || previewUrl || undefined
        saveLocalCampaign({
          id,
          title: `${displayName} — ${titleSuffix}`,
          status: 'product_confirmed',
          productName: displayName,
          productId: `local-product-${id}`,
          productUrl: sourceType === 'url' ? productUrl.trim() : undefined,
          mode: 'studio',
          studioKind: kind,
          deliverables: [],
          selectedAssets,
          includeStrategy: false,
          tryFree: isFreeTry,
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
        if (isFreeTry) await markFreeImageUsed()
        navigate(`/app/campaigns/${id}`, { replace: true })
      } catch (localErr) {
        console.error(localErr)
        setError(
          localErr instanceof Error
            ? localErr.message
            : 'Could not start this project.',
        )
        setBusy(false)
      }
    }
  }

  const isUgcFocus = kind === 'videos' && searchParams.get('style') === 'ugc'
  const usingDefaults = selectionCount() === 0

  const baseMeta =
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
          stylesTitle: 'Pick photo formats',
          stylesHint: 'Same product, different themes — blank uses a starter set of 3.',
        }
      : kind === 'videos' && isUgcFocus
        ? {
            kicker: 'UGC Studio',
            title: 'Creator-style product videos',
            lead: 'Pick winning formats — table talk, UGC, GRWM, mirror selfie, and more — same product every time.',
            image: '/images/video-poster-ugc.jpg',
            accent: 'videos' as const,
            cta: 'Generate UGC video',
            stylesTitle: 'Winning formats',
            stylesHint: 'Hover to preview · click a card to select · click again for sound.',
          }
        : kind === 'videos'
          ? {
              kicker: 'Video Studio',
              title: 'Create endless content from winning formats',
              lead: 'Same perfume across winning formats — your HeyGen-quality table talk and cinematic clips lead the set.',
              image: '/images/video-poster-table-talk.jpg',
              accent: 'videos' as const,
              cta: 'Generate videos',
              stylesTitle: 'Winning formats',
              stylesHint: 'Videos autoplay muted · click a card to select · click the clip for sound.',
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

  const studioMeta =
    isRecreate && recreate
      ? {
          ...baseMeta,
          kicker: `Recreate · ${baseMeta.kicker}`,
          title: `Recreate “${recreate.label}”`,
          lead: 'Tell us what you want changed — lighting, scene, mood, or copy. Your product photo stays locked for fidelity.',
          image: recreate.imageUrl || previewUrl || baseMeta.image,
          cta: busy ? 'Saving…' : 'Apply recreate',
          stylesTitle: 'Confirm style',
          stylesHint: 'Pre-selected from your campaign. Change it if needed.',
        }
      : baseMeta

  return (
    <AppLayout>
      <PaywallModal
        open={paywallOpen}
        title={
          kind === 'videos'
            ? 'Unlock Video Studio generation'
            : kind === 'ads'
              ? 'Unlock Ads & Social generation'
              : 'Upgrade for more images'
        }
        reason={paywallReason}
        onClose={() => setPaywallOpen(false)}
      />
      <main className={`app-main campaign-create studio-page studio-page-${studioMeta.accent}`}>
        {plan === 'free' && kind !== 'photos' ? (
          <p className="studio-paid-banner" role="status">
            Explore the full {kind === 'videos' ? 'video' : 'ads'} workflow — upgrade is only
            required when you generate.
          </p>
        ) : null}
        <header className={`studio-hero tone-${studioMeta.accent}`}>
          <div className="studio-hero-copy">
            <p className="studio-hero-kicker">{studioMeta.kicker}</p>
            <h1>{studioMeta.title}</h1>
            <p className="studio-hero-lead">{studioMeta.lead}</p>
            {isRecreate && recreate ? (
              <p className="studio-free-banner" role="status">
                Editing from your campaign — describe changes below, then apply
              </p>
            ) : null}
            {tryFree && kind === 'photos' && !isRecreate && (
              <p className="studio-free-banner" role="status">
                Free trial — first image pack included, no card required
              </p>
            )}
            <ol className="studio-hero-steps" aria-label="How it works">
              <li>{isRecreate ? 'Confirm product' : sourceType === 'url' ? 'Confirm product' : 'Upload product'}</li>
              <li>{isRecreate ? 'Describe changes' : 'Set creative direction'}</li>
              <li>{isRecreate ? 'Apply' : 'Generate'}</li>
            </ol>
            {isRecreate && recreate ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 12 }}
                onClick={() => {
                  clearRecreateSession()
                  navigate(`/app/campaigns/${recreate.campaignId}`)
                }}
              >
                ← Back to campaign
              </button>
            ) : null}
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
              <p>
                {isRecreate
                  ? 'Your campaign product — change only if needed'
                  : 'Photo or product page URL'}
              </p>
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
              <p>
                {isRecreate
                  ? 'Required — write what you want changed'
                  : 'Optional — shape lighting, mood, and scene'}
              </p>
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
              compact={!isRecreate}
              referencePreviewUrl={referencePreviewUrl}
              onReferenceFile={pickReferenceFile}
              referenceError={referenceError}
              referenceKind={kind === 'videos' ? 'video' : 'image'}
              promptPlaceholder={
                isRecreate
                  ? 'e.g. Brighter lighting, white background, less glitter, keep packaging sharp…'
                  : kind === 'photos'
                    ? 'e.g. Soft morning light on marble, keep bottle label sharp…'
                    : kind === 'videos'
                      ? 'e.g. Natural talking pace, keep packaging true, soft vanity light…'
                      : 'e.g. Bold offer creative for Meta ads, clean white space for CTA…'
              }
            />
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>3. {studioMeta.stylesTitle}</h2>
              <p>
                {kind === 'photos'
                  ? usingDefaults
                    ? `Blank uses starter set · max ${limits.maxImages} images`
                    : `${photoStyles.length} / ${limits.maxImages} selected`
                  : kind === 'videos'
                    ? usingDefaults
                      ? `Clips autoplay · blank uses ${Math.min(DEFAULT_VIDEO_STYLES.length, limits.maxVideos)} · max ${limits.maxVideos}`
                      : `${videoStyles.length} / ${limits.maxVideos} selected`
                    : usingDefaults
                      ? studioMeta.stylesHint
                      : `${selectionCount()} selected`}
              </p>
            </div>

            {kind === 'photos' && (
              <FormatPickGrid
                items={PHOTO_STYLES}
                selected={photoStyles}
                onChange={setPhotoStyles}
                defaultIds={DEFAULT_PHOTO_STYLES}
                max={limits.maxImages}
                disabled={busy}
                ariaLabel="Photo formats"
                onLimitHit={() =>
                  setWarning(`Your plan allows up to ${limits.maxImages} images per generate.`)
                }
              />
            )}

            {kind === 'videos' && (
              <FormatPickGrid
                items={VIDEO_STYLES}
                selected={videoStyles}
                onChange={setVideoStyles}
                defaultIds={DEFAULT_VIDEO_STYLES}
                max={Math.max(limits.maxVideos, 1)}
                disabled={busy}
                videoAspect
                ariaLabel="Video formats"
                onLimitHit={() =>
                  setWarning(`Your plan allows up to ${limits.maxVideos} videos per generate.`)
                }
              />
            )}

            {kind === 'ads' && (
              <FormatPickGrid
                items={AD_STYLES}
                selected={adStyles}
                onChange={setAdStyles}
                disabled={busy}
                ariaLabel="Ad outputs"
              />
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
            {busy
              ? isRecreate
                ? 'Applying…'
                : 'Creating…'
              : studioMeta.cta}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </main>
    </AppLayout>
  )
}
