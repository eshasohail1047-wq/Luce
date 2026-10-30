import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CreativeDirectionFields from '../components/CreativeDirectionFields'
import FormatPickGrid from '../components/FormatPickGrid'
import StudioStagePanel, {
  type StudioStagePhase,
} from '../components/StudioStagePanel'
import { useAuth } from '../auth/AuthProvider'
import {
  createCampaignWithProduct,
  friendlyFirestoreError,
  getProductById,
  updateCampaignStatus,
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
  videoUrlForAsset,
  type PhotoStyleId,
  type VideoStyleId,
} from '../lib/deliverables'
import {
  isImageAssetKind,
  requestGenerateImages,
  type ImageAssetKind,
} from '../lib/generateImages'
import {
  extractVideoFrameDataUrl,
  isVideoAssetKind,
  playableVideoUrl,
  requestGenerateVideos,
  type VideoAssetKind,
} from '../lib/generateVideos'
import { buildMockOutputs, type MockOutput } from '../lib/mockCampaign'
import {
  DEFAULT_VIDEO_DURATION,
  clampVideoDuration,
} from '../lib/formatQuantities'
import {
  compressImageDataUrl,
  fileToDataUrl,
  isLocalCampaignId,
  loadLocalCampaign,
  newLocalId,
  resolveProductImage,
  saveLocalCampaign,
  stashCampaignImageSafe,
  stashCampaignOutputs,
  stashCampaignRefImageSafe,
  stashProductImageSafe,
  updateLocalCampaign,
  withTimeout,
} from '../lib/localDemoCampaign'

export default function NewCampaignPage() {
  const { user, plan, freeImageUsed, loading } = useAuth()
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
  const [videoReferenceFile, setVideoReferenceFile] = useState<File | null>(null)
  const [videoReferencePreviewUrl, setVideoReferencePreviewUrl] = useState<
    string | null
  >(null)
  const [videoReferenceError, setVideoReferenceError] = useState<string | null>(
    null,
  )
  const [videoReferenceUrlBusy, setVideoReferenceUrlBusy] = useState(false)
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
  const [stagePhase, setStagePhase] = useState<StudioStagePhase>('idle')
  const [stageProgress, setStageProgress] = useState(0)
  const [stageMessage, setStageMessage] = useState<string | null>(null)
  const [stageOutputs, setStageOutputs] = useState<MockOutput[]>([])
  const [stageCampaignId, setStageCampaignId] = useState<string | null>(null)
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null)
  const limits = getPlanLimits(plan)
  const hasImageReference = Boolean(referenceFile || referencePreviewUrl)
  const hasVideoReference = Boolean(
    videoReferenceFile || videoReferencePreviewUrl,
  )

  useEffect(() => {
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
    if (!videoReferenceFile) return
    const url = URL.createObjectURL(videoReferenceFile)
    setVideoReferencePreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [videoReferenceFile])

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
          if (
            page.description &&
            !description.trim() &&
            !/single image file/i.test(page.description)
          ) {
            setDescription(page.description)
          }
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
    setStageOutputs([])
    setActiveOutputId(null)
    setStageCampaignId(null)
    setStagePhase('idle')
    setStageProgress(0)
    setStageMessage(null)
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
    setPhotoStyles([])
  }

  async function applyReferenceUrl(rawUrl: string) {
    setReferenceError(null)
    setReferenceUrlBusy(true)
    try {
      let url = rawUrl.trim()
      if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
      const media = await requestFetchRemoteMedia(url, 'image')
      const file = await remoteMediaToFile(media, 'reference.jpg')
      setReferenceFile(file)
      setReferencePreviewUrl(media.dataUrl)
      setPhotoStyles([])
    } catch (err) {
      setReferenceError(
        err instanceof Error ? err.message : 'Could not load that reference link.',
      )
    } finally {
      setReferenceUrlBusy(false)
    }
  }

  function pickVideoReferenceFile(file: File | null) {
    setVideoReferenceError(null)
    if (!file) {
      setVideoReferenceFile(null)
      setVideoReferencePreviewUrl(null)
      return
    }
    if (!file.type.startsWith('video/')) {
      setVideoReferenceError('Reference must be a video (MP4, WebM, or MOV).')
      return
    }
    if (file.size > 40 * 1024 * 1024) {
      setVideoReferenceError('Reference video must be under 40MB.')
      return
    }
    setVideoReferenceFile(file)
    setVideoStyles([])
  }

  async function applyVideoReferenceUrl(rawUrl: string) {
    setVideoReferenceError(null)
    setVideoReferenceUrlBusy(true)
    try {
      let url = rawUrl.trim()
      if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
      const media = await requestFetchRemoteMedia(url, 'video')
      const file = await remoteMediaToFile(media, 'reference.mp4')
      setVideoReferenceFile(file)
      setVideoReferencePreviewUrl(media.dataUrl)
      setVideoStyles([])
    } catch (err) {
      setVideoReferenceError(
        err instanceof Error ? err.message : 'Could not load that reference link.',
      )
    } finally {
      setVideoReferenceUrlBusy(false)
    }
  }

  useEffect(() => {
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
    if (searchParams.get('source') === 'url') {
      setSourceType('url')
    } else if (searchParams.get('source') === 'upload') {
      setSourceType('upload')
    }
  }, [searchParams])

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
    setStageOutputs([])
    setStagePhase('idle')
    setStageMessage(null)
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

  function effectiveFormats() {
    return {
      photoStyles: hasImageReference
        ? (['photo_studio_packshot'] as PhotoStyleId[])
        : photoStyles,
      videoStyles: hasVideoReference
        ? limits.maxVideos > 0
          ? (['video_ugc_selfie'] as VideoStyleId[])
          : ([] as VideoStyleId[])
        : videoStyles,
    }
  }

  async function runCampaignGenerate(opts: {
    campaignId: string
    productName: string
    productImage: string
    selectedAssets: string[]
    referenceDataUrl?: string
    videoReferenceDataUrl?: string
  }) {
    setStageCampaignId(opts.campaignId)
    setStagePhase('preparing')
    setStageProgress(8)
    setStageMessage('Preparing your campaign…')
    setStageOutputs([])
    setActiveOutputId(null)

    await new Promise((r) => setTimeout(r, 350))
    setStagePhase('analyzing')
    setStageProgress(22)
    setStageMessage(
      opts.referenceDataUrl || opts.videoReferenceDataUrl
        ? 'Analyzing product + reference look…'
        : 'Analyzing product packaging…',
    )
    await new Promise((r) => setTimeout(r, 450))

    setStagePhase('generating')
    setStageProgress(40)
    setStageMessage('Generating campaign creatives…')

    let nextOutputs = buildMockOutputs({
      productName: opts.productName,
      productImageUrl: opts.productImage,
      selectedAssets: opts.selectedAssets,
      mode: 'campaign',
    })

    const imageOutputs = nextOutputs.filter((o) => isImageAssetKind(o.assetType))
    const videoOutputs = nextOutputs.filter((o) => isVideoAssetKind(o.assetType))
    let warn: string | null = null

    if (imageOutputs.length > 0) {
      let failCount = 0
      for (let i = 0; i < imageOutputs.length; i++) {
        const item = imageOutputs[i]!
        setStageProgress(42 + Math.round(((i + 1) / imageOutputs.length) * 30))
        setStageMessage(
          `Generating image ${i + 1} of ${imageOutputs.length}: ${item.label}…`,
        )
        try {
          const ai = await requestGenerateImages({
            productName: opts.productName,
            productImage: opts.productImage,
            referenceImage: opts.referenceDataUrl?.startsWith('data:image/')
              ? opts.referenceDataUrl
              : undefined,
            creativeDirection: {
              prompt: prompt || undefined,
              lighting: lighting || undefined,
              background: background || undefined,
              mood: mood || undefined,
              styleTheme: styleTheme || undefined,
            },
            assets: [item.assetType as ImageAssetKind],
            recreateNote: opts.referenceDataUrl
              ? 'Match the reference look; keep product packaging exact.'
              : undefined,
          })
          const generated = ai.assets[0]
          if (generated?.imageDataUrl) {
            nextOutputs = nextOutputs.map((o) =>
              o.id === item.id
                ? {
                    ...o,
                    imageUrl: generated.imageDataUrl,
                    note: 'AI generated in campaign',
                  }
                : o,
            )
            setStageOutputs([...nextOutputs])
            setActiveOutputId(item.id)
          } else {
            throw new Error('No image returned')
          }
        } catch (err) {
          failCount += 1
          console.warn('[Campaign] image failed', item.id, err)
          nextOutputs = nextOutputs.map((o) =>
            o.id === item.id
              ? {
                  ...o,
                  imageUrl: opts.productImage,
                  note: 'AI failed — product photo kept',
                }
              : o,
          )
        }
      }
      if (failCount) {
        warn = `Some AI images failed (${failCount}); your product photo was kept for those.`
      }
    }

    if (videoOutputs.length > 0) {
      let referenceFrameImage: string | undefined
      const videoRef = opts.videoReferenceDataUrl
      if (videoRef?.startsWith('data:image/')) {
        referenceFrameImage = videoRef
      } else if (videoRef?.startsWith('data:video/') || videoRef?.startsWith('blob:')) {
        try {
          referenceFrameImage = await extractVideoFrameDataUrl(videoRef)
        } catch {
          /* optional */
        }
      } else if (opts.referenceDataUrl?.startsWith('data:image/')) {
        referenceFrameImage = opts.referenceDataUrl
      }

      let failCount = 0
      for (let i = 0; i < videoOutputs.length; i++) {
        const item = videoOutputs[i]!
        setStageProgress(72 + Math.round(((i + 1) / videoOutputs.length) * 20))
        setStageMessage(
          `Generating video ${i + 1} of ${videoOutputs.length}: ${item.label}…`,
        )
        try {
          const durationSeconds = clampVideoDuration(
            item.durationSeconds ?? DEFAULT_VIDEO_DURATION,
          )
          const ai = await requestGenerateVideos({
            productName: opts.productName,
            productImage: opts.productImage,
            referenceFrameImage,
            creativeDirection: {
              prompt: prompt || undefined,
              lighting: lighting || undefined,
              background: background || undefined,
              mood: mood || undefined,
              styleTheme: styleTheme || undefined,
            },
            assets: [item.assetType as VideoAssetKind],
            durationSeconds,
          })
          const clipUrl = playableVideoUrl(ai.assets[0])
          if (clipUrl) {
            nextOutputs = nextOutputs.map((o) =>
              o.id === item.id
                ? {
                    ...o,
                    kind: 'video' as const,
                    videoUrl: clipUrl,
                    imageUrl: opts.productImage,
                    durationSeconds,
                    note: `AI video · ${durationSeconds}s`,
                  }
                : o,
            )
            setStageOutputs([...nextOutputs])
            setActiveOutputId(item.id)
          } else {
            throw new Error('No clip returned')
          }
        } catch (err) {
          failCount += 1
          console.warn('[Campaign] video failed', item.id, err)
          nextOutputs = nextOutputs.map((o) =>
            o.id === item.id
              ? {
                  ...o,
                  kind: 'video' as const,
                  videoUrl: videoUrlForAsset(item.assetType) || o.videoUrl,
                  imageUrl: opts.productImage,
                  note: 'AI video failed — demo format clip with your product as poster',
                }
              : o,
          )
        }
      }
      if (failCount) {
        warn = warn
          ? `${warn} Some videos also failed (${failCount}).`
          : `Some AI videos failed (${failCount}); demo format clips play with your product as poster.`
      }
    }

    setStagePhase('checking')
    setStageProgress(94)
    setStageMessage('Checking quality & packaging fidelity…')
    await new Promise((r) => setTimeout(r, 400))

    stashCampaignOutputs(opts.campaignId, nextOutputs)
    if (isLocalCampaignId(opts.campaignId)) {
      updateLocalCampaign(opts.campaignId, {
        status: 'ready',
        outputs: nextOutputs,
        imageUrl: opts.productImage.startsWith('data:')
          ? undefined
          : opts.productImage,
      })
    } else {
      try {
        await updateCampaignStatus(opts.campaignId, 'ready', {
          demoPack: true,
          outputsLocal: true,
          outputCount: nextOutputs.length,
        })
      } catch (err) {
        console.warn('[Campaign] status update failed', err)
      }
    }

    setStageOutputs(nextOutputs)
    setActiveOutputId(nextOutputs[0]?.id || null)
    setStagePhase('ready')
    setStageProgress(100)
    setStageMessage(
      nextOutputs.length === 1
        ? '1 creative ready'
        : `${nextOutputs.length} creatives ready`,
    )
    if (warn) setWarning(warn)
    setBusy(false)
  }

  async function createLocalDemoAndGenerate(imageDataUrl?: string) {
    const displayName =
      productName.trim() ||
      (imageFile ? imageFile.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') : '') ||
      (productUrl.trim() ? 'Product from URL' : 'Untitled product')
    const formats = effectiveFormats()
    const resolved = resolveCampaignFromFormats({
      photoStyles: formats.photoStyles,
      videoStyles: formats.videoStyles,
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
    let refDataUrl: string | undefined
    if (referenceFile) {
      try {
        refDataUrl = await stashCampaignRefImageSafe(
          id,
          await fileToDataUrl(referenceFile),
        )
      } catch {
        /* optional */
      }
    }
    let videoRefDataUrl: string | undefined
    if (videoReferenceFile) {
      try {
        videoRefDataUrl = await fileToDataUrl(videoReferenceFile)
      } catch {
        /* optional */
      }
    }
    if (!imageUrl) {
      throw new Error('Add a product photo before creating this campaign.')
    }
    await runCampaignGenerate({
      campaignId: id,
      productName: displayName,
      productImage: imageUrl,
      selectedAssets: resolved.selectedAssets,
      referenceDataUrl: refDataUrl,
      videoReferenceDataUrl: videoRefDataUrl,
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

    const formats = effectiveFormats()
    const displayName =
      productName.trim() ||
      (imageFile ? imageFile.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') : '') ||
      'Untitled product'

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
          photoStyles: formats.photoStyles,
          videoStyles: formats.videoStyles,
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
      let refDataUrl: string | undefined
      if (referenceFile) {
        try {
          refDataUrl = await stashCampaignRefImageSafe(
            result.campaignId,
            await fileToDataUrl(referenceFile),
          )
        } catch {
          /* optional */
        }
      }
      let videoRefDataUrl: string | undefined
      if (videoReferenceFile) {
        try {
          videoRefDataUrl = await fileToDataUrl(videoReferenceFile)
        } catch {
          /* optional */
        }
      }
      if (!productStill) {
        throw new Error('Add a product photo before creating this campaign.')
      }
      const resolved = resolveCampaignFromFormats({
        photoStyles: formats.photoStyles,
        videoStyles: formats.videoStyles,
        includeHooks,
        includeCaptions,
        includeCtas,
        includeHashtags,
        includeAdCreative,
        includeAdCopy,
        includeStrategy,
      })
      await runCampaignGenerate({
        campaignId: result.campaignId,
        productName: displayName,
        productImage: productStill,
        selectedAssets: resolved.selectedAssets,
        referenceDataUrl: refDataUrl,
        videoReferenceDataUrl: videoRefDataUrl,
      })
    } catch (err) {
      console.warn('[NewCampaign] falling back to local demo campaign', err)
      try {
        await createLocalDemoAndGenerate(imageDataUrl)
      } catch (localErr) {
        console.error(localErr)
        setError(
          friendlyFirestoreError(
            localErr,
            'Could not create campaign. Try again or use a smaller photo.',
          ),
        )
        setStagePhase('error')
        setStageMessage('Generation stopped')
        setBusy(false)
      }
    }
  }

  const formatsPreview = effectiveFormats()
  const photoCount =
    formatsPreview.photoStyles.length || DEFAULT_PHOTO_STYLES.length
  const videoCount =
    formatsPreview.videoStyles.length ||
    (limits.maxVideos > 0 ? DEFAULT_VIDEO_STYLES.length : 0)

  const formBody = (
    <form
      className="app-form campaign-form create-panel studio-panel"
      onSubmit={(e) => void onSubmit(e)}
    >
      <header className="studio-workbench-head">
        <div>
          <p className="studio-workbench-kicker">Full Campaign</p>
          <h1>Build a complete campaign pack</h1>
          <p>
            Same formats as Image &amp; Video Studio — or upload your own reference
            on the first card.
          </p>
        </div>
      </header>

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
                <p className="field-hint">
                  {urlImages.length === 1
                    ? '1 photo found — pick it, or paste the product page URL for the full gallery'
                    : `Pick the product photo to use (${urlImages.length} found)`}
                </p>
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

      <section className="form-section">
        <div className="form-section-head">
          <h2>2. Creative direction</h2>
          <p>
            {hasImageReference || hasVideoReference
              ? 'Your reference card(s) drive that look — formats stay off for those'
              : 'Optional prompt — formats or your reference come next'}
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
          compact
          embedded
          promptPlaceholder="e.g. Soft morning light, keep packaging exact, quiet premium mood…"
        />
      </section>

      <section className="form-section">
        <div className="form-section-head">
          <h2>3. Image formats or your reference</h2>
          <p>
            {hasImageReference
              ? 'Using your reference — pick a format card to switch back'
              : photoStyles.length === 0
                ? `First card = your reference · or pick formats · blank uses ${DEFAULT_PHOTO_STYLES.length} starters`
                : `${photoStyles.length} selected`}
          </p>
        </div>
        <p className="studio-formats-intro">
          Upload your own reference on the blank card, or pick the same formats as Image Studio.
          Choosing one clears the other.
        </p>
        <FormatPickGrid
          items={PHOTO_STYLES}
          selected={photoStyles}
          onChange={setPhotoStyles}
          defaultIds={hasImageReference ? [] : DEFAULT_PHOTO_STYLES}
          max={Math.max(limits.maxImages, PHOTO_STYLES.length)}
          disabled={busy}
          ariaLabel="Image formats"
          referenceSlot={{
            kind: 'image',
            previewUrl: referencePreviewUrl,
            error: referenceError,
            busy: referenceUrlBusy,
            onPickFile: pickReferenceFile,
            onPickUrl: applyReferenceUrl,
          }}
        />
      </section>

      <section className="form-section">
        <div className="form-section-head">
          <h2>4. Video formats or your reference</h2>
          <p>
            {limits.maxVideos === 0
              ? 'Upgrade to unlock video formats'
              : hasVideoReference
                ? 'Using your reference — pick a format card to switch back'
                : videoStyles.length === 0
                  ? `First card = your reference · or pick formats · blank uses ${DEFAULT_VIDEO_STYLES.length} starters`
                  : `${videoStyles.length} selected`}
          </p>
        </div>
        <p className="studio-formats-intro">
          Upload your own reference clip on the blank card, or pick the same formats as Video Studio.
          Choosing one clears the other.
        </p>
        <FormatPickGrid
          items={VIDEO_STYLES}
          selected={videoStyles}
          onChange={setVideoStyles}
          defaultIds={hasVideoReference ? [] : DEFAULT_VIDEO_STYLES}
          max={Math.max(limits.maxVideos, VIDEO_STYLES.length)}
          disabled={busy || limits.maxVideos === 0}
          videoAspect
          ariaLabel="Video formats"
          referenceSlot={{
            kind: 'video',
            previewUrl: videoReferencePreviewUrl,
            error: videoReferenceError,
            busy: videoReferenceUrlBusy,
            onPickFile: pickVideoReferenceFile,
            onPickUrl: applyVideoReferenceUrl,
          }}
        />
      </section>

      <section className="form-section">
        <div className="form-section-head">
          <h2>5. Ads &amp; copy extras</h2>
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

      <button type="submit" className="btn btn-grad campaign-submit studio-submit" disabled={busy}>
        {busy
          ? stagePhase !== 'idle' && stagePhase !== 'ready' && stagePhase !== 'error'
            ? 'Generating…'
            : 'Creating…'
          : hasImageReference || hasVideoReference
            ? 'Generate from reference'
            : 'Create campaign'}
        <span aria-hidden="true">→</span>
      </button>
    </form>
  )

  return (
    <AppLayout>
      <PaywallModal
        open={paywallOpen}
        title="Unlock full campaigns"
        reason={paywallReason}
        onClose={() => setPaywallOpen(false)}
      />
      <main className="app-main campaign-create studio-page studio-page-split studio-page-campaign">
        <div className="studio-split">
          <div className="studio-split-controls">{formBody}</div>
          <StudioStagePanel
            kind="photos"
            phase={stagePhase}
            progress={stageProgress}
            message={stageMessage}
            previewUrl={previewUrl}
            outputs={stageOutputs}
            campaignId={stageCampaignId}
            activeOutputId={activeOutputId}
            onSelectOutput={setActiveOutputId}
          />
        </div>
      </main>
    </AppLayout>
  )
}
