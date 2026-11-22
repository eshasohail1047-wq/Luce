import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
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
import { canGenerate, isCreditsExhaustedMessage } from '../lib/planAccess'
import { getPlanLimits } from '../lib/planLimits'
import PaywallModal from '../components/PaywallModal'
import type {
  BackgroundId,
  CreativeDirection,
  LightingId,
  MoodId,
  StyleThemeId,
} from '../lib/creativeDirection'
import { withBrandKit } from '../lib/creativeDirection'
import {
  DEFAULT_VIDEO_LANGUAGE,
  VIDEO_LANGUAGES,
  type VideoLanguageId,
  videoLanguageLabel,
} from '../lib/videoLanguages'
import {
  PHOTO_STYLES,
  VIDEO_STYLES,
  resolveCampaignFromFormats,
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
  expandFormatQuantities,
  type FormatDurations,
  type FormatQuantities,
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
  const { user, plan, freeImageUsed, loading, workspace } = useAuth()
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
  const [previewOrient, setPreviewOrient] = useState<'portrait' | 'landscape'>(
    'portrait',
  )
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
  const [photoQuantities, setPhotoQuantities] = useState<FormatQuantities>({})
  const [videoQuantities, setVideoQuantities] = useState<FormatQuantities>({})
  const [videoDurations, setVideoDurations] = useState<FormatDurations>({})
  const [prompt, setPrompt] = useState('')
  const [videoLanguage, setVideoLanguage] = useState<VideoLanguageId>(
    DEFAULT_VIDEO_LANGUAGE,
  )
  const lighting = '' as LightingId | ''
  const background = '' as BackgroundId | ''
  const mood = '' as MoodId | ''
  const styleTheme = '' as StyleThemeId | ''
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

  function campaignDirection(
    partial: CreativeDirection,
  ): CreativeDirection | undefined {
    return withBrandKit(partial, workspace)
  }

  function campaignSpokenLanguage(): string {
    return (
      VIDEO_LANGUAGES.find((l) => l.id === videoLanguage)?.promptName ||
      videoLanguageLabel(videoLanguage)
    )
  }
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
    if (!previewUrl) {
      setPreviewOrient('portrait')
      return
    }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      setPreviewOrient(
        img.naturalWidth >= img.naturalHeight ? 'landscape' : 'portrait',
      )
    }
    img.onerror = () => {
      if (!cancelled) setPreviewOrient('portrait')
    }
    img.src = previewUrl
    return () => {
      cancelled = true
    }
  }, [previewUrl])

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
    setPhotoQuantities({})
  }

  async function applyReferenceUrl(rawUrl: string) {
    setReferenceError(null)
    setReferenceUrlBusy(true)
    try {
      let url = rawUrl.trim()
      if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
      if (!url) {
        const msg = 'Paste a link first.'
        setReferenceError(msg)
        throw new Error(msg)
      }

      try {
        const media = await requestFetchRemoteMedia(url, 'image')
        const file = await remoteMediaToFile(media, 'reference.jpg')
        setReferenceFile(file)
        setReferencePreviewUrl(media.dataUrl)
        setPhotoQuantities({})
        return
      } catch (directErr) {
        const page = await requestFetchProductPage(url)
        const imageUrl =
          page.images?.find((u) => typeof u === 'string' && u.trim()) || ''
        if (!imageUrl) {
          throw new Error(
            directErr instanceof Error
              ? directErr.message
              : 'No image found at that link.',
          )
        }
        const media = await requestFetchRemoteMedia(imageUrl, 'image')
        const file = await remoteMediaToFile(media, 'reference.jpg')
        setReferenceFile(file)
        setReferencePreviewUrl(media.dataUrl)
        setPhotoQuantities({})
      }
    } catch (err) {
      setReferenceError(
        err instanceof Error ? err.message : 'Could not load that reference link.',
      )
      throw err
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
    setVideoQuantities({})
    setVideoDurations({})
  }

  async function applyVideoReferenceUrl(rawUrl: string) {
    setVideoReferenceError(null)
    setVideoReferenceUrlBusy(true)
    try {
      let url = rawUrl.trim()
      if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
      if (!url) {
        const msg = 'Paste a link first.'
        setVideoReferenceError(msg)
        throw new Error(msg)
      }
      const media = await requestFetchRemoteMedia(url, 'video')
      const file = await remoteMediaToFile(media, 'reference.mp4')
      setVideoReferenceFile(file)
      setVideoReferencePreviewUrl(media.dataUrl)
      setVideoQuantities({})
      setVideoDurations({})
    } catch (err) {
      setVideoReferenceError(
        err instanceof Error ? err.message : 'Could not load that reference link.',
      )
      throw err
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
    const url = searchParams.get('url')?.trim()
    if (url) {
      setSourceType('url')
      setProductUrl(url)
    }
    const name = searchParams.get('name')?.trim()
    if (name) setProductName(name)
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
    let photos = (
      hasImageReference
        ? (['photo_studio_packshot'] as PhotoStyleId[])
        : (expandFormatQuantities(
            photoQuantities,
            limits.maxImages,
          ) as PhotoStyleId[])
    )
    let videos = (
      hasVideoReference
        ? limits.maxVideos > 0
          ? (['video_ugc_selfie'] as VideoStyleId[])
          : ([] as VideoStyleId[])
        : (expandFormatQuantities(
            videoQuantities,
            limits.maxVideos,
          ) as VideoStyleId[])
    )
    return { photoStyles: photos, videoStyles: videos }
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

    setStagePhase('analyzing')
    setStageProgress(22)
    setStageMessage(
      opts.referenceDataUrl || opts.videoReferenceDataUrl
        ? 'Reading packaging + reference…'
        : 'Reading packaging…',
    )

    setStagePhase('generating')
    setStageProgress(38)
    setStageMessage('Generating all campaign creatives…')

    let nextOutputs = buildMockOutputs({
      productName: opts.productName,
      productImageUrl: opts.productImage,
      selectedAssets: opts.selectedAssets,
      mode: 'campaign',
      videoDurations,
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
            creativeDirection: campaignDirection({
              prompt: prompt || undefined,
              lighting: lighting || undefined,
              background: background || undefined,
              mood: mood || undefined,
              styleTheme: styleTheme || undefined,
            }),
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
          const failReason =
            err instanceof Error ? err.message : 'generation failed'
          console.warn('[Campaign] image failed', item.id, err)
          if (isCreditsExhaustedMessage(failReason)) {
            setStageOutputs([])
            setActiveOutputId(null)
            setStagePhase('error')
            setStageProgress(0)
            setStageMessage('Free image trial finished')
            setError(failReason)
            setPaywallReason(failReason)
            setPaywallOpen(true)
            setBusy(false)
            return
          }
          nextOutputs = nextOutputs.map((o) =>
            o.id === item.id
              ? {
                  ...o,
                  imageUrl: undefined,
                  note: `AI failed — ${failReason}`,
                }
              : o,
          )
        }
      }
      if (failCount) {
        warn =
          failCount === imageOutputs.length
            ? `AI did not return new images (${failCount}). No fake results were shown.`
            : `Some AI images failed (${failCount}). Failed formats were not replaced with your upload.`
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
            creativeDirection: campaignDirection({
              prompt: prompt || undefined,
              lighting: lighting || undefined,
              background: background || undefined,
              mood: mood || undefined,
              styleTheme: styleTheme || undefined,
              language: campaignSpokenLanguage(),
            }),
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
          const failReason =
            err instanceof Error ? err.message : 'Video generation failed'
          console.warn('[Campaign] video failed', item.id, err)
          if (isCreditsExhaustedMessage(failReason) || /paid plan/i.test(failReason)) {
            setStageOutputs([])
            setActiveOutputId(null)
            setStagePhase('error')
            setStageProgress(0)
            setStageMessage('Paid plan required')
            setError(failReason)
            setPaywallReason(failReason)
            setPaywallOpen(true)
            setBusy(false)
            return
          }
          nextOutputs = nextOutputs.map((o) =>
            o.id === item.id
              ? {
                  ...o,
                  kind: 'video' as const,
                  videoUrl: undefined,
                  imageUrl: undefined,
                  note: `AI video failed — ${failReason}`,
                }
              : o,
          )
        }
      }
      if (failCount) {
        warn = warn
          ? `${warn} Some videos also failed (${failCount}).`
          : `Some AI videos failed (${failCount}). No demo clips were substituted.`
      }
    }

    const aiOk = nextOutputs.some(
      (o) =>
        (o.imageUrl && o.imageUrl !== opts.productImage) ||
        (o.videoUrl && !String(o.note || '').includes('failed')),
    )
    if (!aiOk) {
      setStageOutputs([])
      setActiveOutputId(null)
      setStagePhase('error')
      setStageProgress(0)
      setStageMessage('Generation did not finish')
      setError(
        warn ||
          'No new creatives were generated. Nothing was saved as a result.',
      )
      setBusy(false)
      return
    }

    setStagePhase('checking')
    setStageProgress(96)
    setStageMessage('Final polish…')

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
      includeSocial: false,
      includeAds: false,
      includeStrategy: false,
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
      userId: user?.uid,
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

    const precheck = effectiveFormats()
    if (precheck.photoStyles.length === 0) {
      setError('Pick at least one image format.')
      return
    }
    if (limits.maxVideos > 0 && precheck.videoStyles.length === 0) {
      setError('Pick at least one video format — campaigns generate images and videos together.')
      return
    }

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
          includeSocial: false,
          includeAds: false,
          includeStrategy: false,
          creativeDirection: campaignDirection({
            prompt,
            lighting: lighting || undefined,
            background: background || undefined,
            mood: mood || undefined,
            styleTheme: styleTheme || undefined,
            language: campaignSpokenLanguage(),
          }),
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
        includeSocial: false,
        includeAds: false,
        includeStrategy: false,
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

  const productColumn = (
    <aside className="studio-bench-product">
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
        className={`product-stage${dragOver ? ' is-over' : ''}${previewUrl ? ' has-preview' : ''}${sourceType === 'url' ? ' is-url' : ''} is-${previewUrl ? previewOrient : 'portrait'}`}
        onDragOver={(e) => {
          e.preventDefault()
          if (sourceType === 'upload') setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (sourceType === 'upload') onDrop(e)
        }}
      >
        {previewUrl ? (
          <div className="product-stage-filled">
            <img src={previewUrl} alt="Product preview" referrerPolicy="no-referrer" />
            <div className="product-stage-actions">
              <button
                type="button"
                className="product-stage-action"
                onClick={() => {
                  setSourceType('upload')
                  fileInputRef.current?.click()
                }}
                disabled={busy}
              >
                Replace
              </button>
              <button
                type="button"
                className="product-stage-action"
                onClick={() => {
                  setSourceType('url')
                  setImageFile(null)
                  setPreviewUrl(null)
                  setShowDetails(true)
                  setError(null)
                }}
                disabled={busy}
              >
                Use URL
              </button>
              <button
                type="button"
                className="product-stage-action is-danger"
                onClick={() => {
                  setImageFile(null)
                  setPreviewUrl(null)
                  setSelectedUrlImage(null)
                }}
                disabled={busy}
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <div className="product-stage-blank">
            <span className="product-stage-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M4.5 17.5l4.2-5.2 3.1 3.4 3.4-4.6 4.3 6.4H4.5ZM9 9.2a1.7 1.7 0 100-3.4 1.7 1.7 0 000 3.4Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <div className="product-stage-blank-copy">
              <p className="product-stage-kicker">Product</p>
              <h3>Add your product</h3>
              <p>Drop a photo onto this stage, or paste a product URL</p>
            </div>

            <div className="product-stage-modes" role="tablist" aria-label="Product source">
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
                Photo
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
                Product URL
              </button>
            </div>

            {sourceType === 'upload' ? (
              <div className="product-stage-upload">
                <button
                  type="button"
                  className="product-stage-cta"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={busy}
                >
                  Choose photo
                </button>
                <span className="product-stage-hint">JPG, PNG, or WebP · up to 12MB</span>
              </div>
            ) : (
              <div className="product-stage-url">
                <label htmlFor="product-url" className="sr-only">
                  Product page URL
                </label>
                <input
                  id="product-url"
                  type="url"
                  required
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://yourstore.com/products/…"
                  disabled={busy}
                />
                {urlFetchBusy ? <p className="product-stage-hint">Fetching photos…</p> : null}
                {urlFetchError ? (
                  <p className="auth-error" role="alert">
                    {urlFetchError}
                  </p>
                ) : null}
              </div>
            )}

            {sourceType === 'url' && urlImages.length > 0 ? (
              <div className="product-stage-thumbs" role="listbox" aria-label="Product photos from URL">
                <p className="product-stage-hint">
                  {urlImages.length === 1
                    ? '1 photo found — select it'
                    : `Select a photo (${urlImages.length})`}
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
              </div>
            ) : null}
          </div>
        )}
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

      {showDetails ? (
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
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes, benefits, who it’s for…"
              disabled={busy}
            />
          </div>
        </div>
      ) : null}
    </aside>
  )

  const stepsColumn = (
    <div className="studio-bench-steps studio-bench-steps-campaign">
      <section className="form-section studio-bench-step studio-bench-formats">
        <header className="studio-bench-heading campaign-formats-hero">
          <p className="campaign-formats-kicker">Campaign</p>
          <h1>Formats</h1>
          <p>
            {hasImageReference || hasVideoReference
              ? 'Using your reference — pick a format to switch back'
              : 'Choose image and video formats. One create generates both.'}
          </p>
        </header>
        <div className="campaign-format-block campaign-format-block-images">
          <header className="campaign-format-head">
            <h2>Images</h2>
            <p>
              {hasImageReference
                ? 'Using your reference — pick a format to switch back'
                : 'Choose the looks you want, or add your own reference'}
            </p>
          </header>
          <FormatPickGrid
            items={PHOTO_STYLES}
            quantities={photoQuantities}
            onQuantitiesChange={setPhotoQuantities}
            defaultIds={[]}
            max={limits.maxImages}
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
            onLimitHit={() =>
              setWarning(
                `Your plan allows up to ${limits.maxImages} images in a campaign.`,
              )
            }
          />
        </div>
        <div className="campaign-format-block campaign-format-block-videos">
          <header className="campaign-format-head">
            <h2>Videos</h2>
            <p>
              {hasVideoReference
                ? 'Using your reference — pick a format to switch back'
                : 'Choose clip styles and length, or add your own reference'}
            </p>
          </header>
          <FormatPickGrid
            items={VIDEO_STYLES}
            quantities={videoQuantities}
            onQuantitiesChange={setVideoQuantities}
            durations={videoDurations}
            onDurationsChange={setVideoDurations}
            showDuration
            defaultIds={[]}
            max={Math.max(1, limits.maxVideos || VIDEO_STYLES.length)}
            disabled={busy}
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
            onLimitHit={() =>
              setWarning(
                limits.maxVideos > 0
                  ? `Your plan allows up to ${limits.maxVideos} videos in a campaign.`
                  : 'Upgrade to generate campaign videos.',
              )
            }
          />
        </div>
      </section>

      <div className="studio-bench-footer">
        <section className="form-section studio-bench-step studio-bench-prompt">
          <div className="auth-field studio-video-language">
            <label htmlFor="campaign-video-language">Spoken language</label>
            <select
              id="campaign-video-language"
              value={videoLanguage}
              onChange={(e) =>
                setVideoLanguage(e.target.value as VideoLanguageId)
              }
              disabled={busy}
            >
              {VIDEO_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}
                </option>
              ))}
            </select>
            <p className="studio-video-language-hint">
              Dialogue in campaign video clips uses this language.
            </p>
          </div>
          <div className="auth-field">
            <label htmlFor="campaign-prompt">Prompt · optional</label>
            <textarea
              id="campaign-prompt"
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. Soft morning light, keep packaging exact…"
              disabled={busy}
            />
          </div>
        </section>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}
        {warning ? (
          <p className="auth-notice" role="status">
            {warning}
          </p>
        ) : null}

        <button type="submit" className="btn btn-grad campaign-submit studio-submit" disabled={busy}>
          {busy
            ? stagePhase !== 'idle' && stagePhase !== 'ready' && stagePhase !== 'error'
              ? 'Generating…'
              : 'Creating…'
            : hasImageReference || hasVideoReference
              ? 'Generate images + videos'
              : 'Create campaign · images + videos'}
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  )

  const formBody = (
    <form
      className="app-form campaign-form create-panel studio-panel studio-bench-form"
      onSubmit={(e) => void onSubmit(e)}
    >
      <div className="studio-bench">
        {stepsColumn}
        {productColumn}
      </div>
    </form>
  )

  const isGenerating =
    busy ||
    (stagePhase !== 'idle' && stagePhase !== 'ready' && stagePhase !== 'error') ||
    stageOutputs.length > 0

  return (
    <AppLayout>
      <PaywallModal
        open={paywallOpen}
        title="Unlock full campaigns"
        reason={paywallReason}
        onClose={() => setPaywallOpen(false)}
      />
      <main
        className={`app-main campaign-create studio-page studio-page-bench studio-page-campaign${isGenerating ? ' is-generating' : ''}`}
      >
        {formBody}
        {isGenerating ? (
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
        ) : null}
      </main>
    </AppLayout>
  )
}
