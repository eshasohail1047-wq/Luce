import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CreativeDirectionFields from '../components/CreativeDirectionFields'
import FormatPickGrid from '../components/FormatPickGrid'
import StudioStagePanel, {
  type StudioStagePhase,
} from '../components/StudioStagePanel'
import { useAuth } from '../auth/AuthProvider'
import { getPlanLimits } from '../lib/planLimits'
import {
  DEFAULT_VIDEO_DURATION,
  clampVideoDuration,
  expandFormatQuantities,
  syncDurationsToQuantities,
  totalQuantity,
  type FormatDurations,
  type FormatQuantities,
} from '../lib/formatQuantities'
import {
  createStudioProject,
  friendlyFirestoreError,
  getProductById,
  type ProductSourceType,
} from '../lib/campaigns'
import type {
  BackgroundId,
  LightingId,
  MoodId,
  StyleThemeId,
} from '../lib/creativeDirection'
import {
  AD_STYLES,
  DEFAULT_PHOTO_STYLES,
  PHOTO_STYLES,
  VIDEO_STUDIO_FORMAT_COUNT,
  VIDEO_STYLES,
  normalizePhotoStyleId,
  normalizeVideoStyleId,
  resolveAdStyles,
  resolvePhotoStyles,
  resolveVideoStudioStyles,
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
  loadLocalCampaign,
  stashCampaignImageSafe,
  stashProductImageSafe,
  resolveProductImage,
  loadStashedCampaignImage,
  stashCampaignOutputs,
  stashCampaignRefImageSafe,
  stashCampaignVideoDurations,
  compressImageDataUrl,
  updateLocalCampaign,
  withTimeout,
} from '../lib/localDemoCampaign'
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
import {
  isCopyAssetKind,
  requestGenerateCopy,
} from '../lib/generateCopy'
import {
  buildMockOutputs,
  recreateMockOutput,
  type MockOutput,
} from '../lib/mockCampaign'
import { consumePendingProduct } from '../lib/pendingProduct'
import { canGenerate, type GenerateAction } from '../lib/planAccess'
import {
  remoteMediaToFile,
  requestFetchProductPage,
  requestFetchRemoteMedia,
} from '../lib/fetchProduct'
import {
  clearRecreateSession,
  dataUrlToFile,
  imageUrlToFile,
  loadRecreateSession,
  type RecreateSession,
} from '../lib/recreateSession'
import PaywallModal from '../components/PaywallModal'

const VALID_KINDS: StudioKind[] = ['photos', 'videos', 'ads']

function isStudioKind(value: string | undefined): value is StudioKind {
  return Boolean(value && VALID_KINDS.includes(value as StudioKind))
}

export default function StudioPage({
  forcedKind,
}: {
  /** Used when mounted from /app/studio/ads recreate without :kind param */
  forcedKind?: StudioKind
} = {}) {
  const { kind: kindParam } = useParams()
  const kind = forcedKind ?? (isStudioKind(kindParam) ? kindParam : null)
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
  const [referenceUrlBusy, setReferenceUrlBusy] = useState(false)
  const [urlImages, setUrlImages] = useState<string[]>([])
  const [urlFetchBusy, setUrlFetchBusy] = useState(false)
  const [urlFetchError, setUrlFetchError] = useState<string | null>(null)
  const [selectedUrlImage, setSelectedUrlImage] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showDetails, setShowDetails] = useState(true)
  const [photoQuantities, setPhotoQuantities] = useState<FormatQuantities>({})
  const [videoQuantities, setVideoQuantities] = useState<FormatQuantities>({})
  const [videoDurations, setVideoDurations] = useState<FormatDurations>({})
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
  const [stagePhase, setStagePhase] = useState<StudioStagePhase>('idle')
  const [stageProgress, setStageProgress] = useState(0)
  const [stageMessage, setStageMessage] = useState<string | null>(null)
  const [stageOutputs, setStageOutputs] = useState<MockOutput[]>([])
  const [stageCampaignId, setStageCampaignId] = useState<string | null>(null)
  const [activeOutputId, setActiveOutputId] = useState<string | null>(null)
  const isRecreate = Boolean(recreate) || searchParams.get('recreate') === '1'
  const isSplitStudio = kind === 'photos' || kind === 'videos'
  const limits = getPlanLimits(plan)
  const photoTotalMax = Math.max(1, limits.maxImages)
  const videoTotalMax =
    limits.maxVideos > 0 ? limits.maxVideos : VIDEO_STUDIO_FORMAT_COUNT
  const photoOutputCount = totalQuantity(photoQuantities)
  const videoOutputCount = totalQuantity(videoQuantities)
  /** Reference look drives the shoot — skip format picker to avoid fighting the ref. */
  const hasReference = Boolean(referenceFile || referencePreviewUrl)

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
    // Don't clear on null — productId / recreate may hydrate a remote preview without a File yet.
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
    // Intentionally only re-fetch when the URL / source tab changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceType, productUrl])

  async function applyProductUrlImage(imageUrl: string) {
    setSelectedUrlImage(imageUrl)
    setPreviewUrl(imageUrl)
    setError(null)
    // Changing product clears previous results so we never show another SKU.
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
      // Keep HTTPS preview even if download fails — generation can still use the URL.
      console.warn('[Studio] product URL image download failed', err)
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

  async function applyReferenceUrl(rawUrl: string) {
    setReferenceError(null)
    setReferenceUrlBusy(true)
    try {
      let url = rawUrl.trim()
      if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
      const prefer = kind === 'videos' ? 'video' : 'image'
      const media = await requestFetchRemoteMedia(url, prefer)
      const file = await remoteMediaToFile(
        media,
        kind === 'videos' ? 'reference.mp4' : 'reference.jpg',
      )
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
          setPhotoQuantities({ [photoId]: 1 })
        } else if (session.studioKind === 'videos' && videoId) {
          setVideoQuantities({ [videoId]: 1 })
          setVideoDurations({ [videoId]: DEFAULT_VIDEO_DURATION })
        } else if (session.studioKind === 'ads' && AD_STYLES.some((s) => s.id === asset)) {
          setAdStyles([asset as AdStyleId])
        }
        setPrompt(
          `Recreate “${session.label}”.\nWhat I want changed: `,
        )
        return
      }

      const fromProductId = searchParams.get('productId')?.trim()
      if (fromProductId) {
        const product = await getProductById(fromProductId, user.uid)
        if (cancelled) return
        if (product) {
          setProductName(product.name)
          setShowDetails(true)
          if (product.brand) setBrand(product.brand)
          if (product.description) setDescription(product.description)
          if (product.sourceType === 'url' && product.sourceUrl) {
            setSourceType('url')
            setProductUrl(product.sourceUrl)
          }
          const imageUrl = await resolveProductImage(product.id, product.imageUrl)
          if (cancelled) return
          if (imageUrl) {
            setSourceType('upload')
            setPreviewUrl(imageUrl)
            const file = await imageUrlToFile(
              imageUrl,
              `${product.name || 'product'}.jpg`,
            )
            if (!cancelled && file) setImageFile(file)
            void stashProductImageSafe(product.id, imageUrl)
          }
          return
        }
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
    setPhotoQuantities({})
    setVideoQuantities({})
    setVideoDurations({})
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
      const qty = { video_ugc_selfie: 3 }
      setVideoQuantities(qty)
      setVideoDurations({ video_ugc_selfie: DEFAULT_VIDEO_DURATION })
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
    if (kind === 'photos') return photoOutputCount
    if (kind === 'videos') return videoOutputCount
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
    const productPhoto = previewUrl || session.imageUrl
    let next = recreateMockOutput(
      current,
      index,
      productName.trim() || session.productName,
      productPhoto,
    )
    const directionNote = prompt.trim()
    next = {
      ...next,
      // Always keep the user's product as the frame until AI succeeds —
      // never show stock demo perfume for another format.
      imageUrl:
        next.kind === 'image'
          ? productPhoto || next.imageUrl
          : next.imageUrl,
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
        if (!productImage) {
          throw new Error(
            'Upload your product photo first — formats must be based on your packaging.',
          )
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
        } else {
          throw new Error('Image model returned no image for this format.')
        }
      } catch (err) {
        console.warn('[Studio] AI recreate failed — keeping your product photo', err)
        next = {
          ...next,
          imageUrl: productPhoto || next.imageUrl,
          note: 'Kept your product photo — AI format restyle failed',
        }
        setWarning(
          err instanceof Error
            ? `${err.message} Your product photo was kept (no demo swap).`
            : 'AI recreate unavailable — your product photo was kept.',
        )
      }
    }

    if (isVideoAssetKind(current.assetType) && next.kind === 'video') {
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
        if (!productImage) {
          throw new Error(
            'Upload your product photo first — videos must start from your packaging.',
          )
        }

        let referenceFrameImage: string | undefined
        if (referenceFile) {
          try {
            const refData = await fileToDataUrl(referenceFile)
            if (refData.startsWith('data:image/')) {
              referenceFrameImage = refData
            } else if (refData.startsWith('data:video/')) {
              referenceFrameImage = await extractVideoFrameDataUrl(refData)
            }
          } catch {
            /* optional */
          }
        }

        const durationSeconds =
          videoDurations[current.assetType] ||
          current.durationSeconds ||
          DEFAULT_VIDEO_DURATION
        const ai = await requestGenerateVideos({
          productName: productName.trim() || session.productName,
          productImage,
          referenceFrameImage,
          creativeDirection: {
            prompt: directionNote || undefined,
            lighting: lighting || undefined,
            background: background || undefined,
            mood: mood || undefined,
            styleTheme: styleTheme || undefined,
          },
          assets: [current.assetType],
          recreateNote: directionNote || undefined,
          durationSeconds,
        })
        const clipUrl = playableVideoUrl(ai.assets[0])
        if (clipUrl) {
          next = {
            ...next,
            kind: 'video',
            videoUrl: clipUrl,
            imageUrl: productPhoto || next.imageUrl,
            durationSeconds,
            note: directionNote
              ? `AI video recreate · ${durationSeconds}s · ${directionNote.slice(0, 100)}`
              : `AI video · ${durationSeconds}s · packaging from your product photo`,
          }
        } else {
          throw new Error('Video model returned no clip for this format.')
        }
      } catch (err) {
        const failReason =
          err instanceof Error ? err.message : 'AI video unavailable'
        console.warn('[Studio] AI video recreate failed — keeping product still', err)
        next = {
          ...next,
          kind: 'video',
          videoUrl: undefined,
          imageUrl: productPhoto || next.imageUrl,
          note: `AI video failed — ${failReason}`,
        }
        setWarning(`${failReason} Your product still was kept (no demo clip).`)
      }
    }

    if (isCopyAssetKind(current.assetType) && next.kind === 'copy') {
      try {
        const ai = await requestGenerateCopy({
          productName: productName.trim() || session.productName,
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
        if (generated?.text) {
          next = {
            ...next,
            text: generated.text,
            note: directionNote
              ? `AI copy recreate · ${directionNote.slice(0, 120)}`
              : 'AI-generated by LUCE Copy Agent',
          }
        } else {
          throw new Error('Copy agent returned no text.')
        }
      } catch (err) {
        console.warn('[Studio] AI copy recreate failed', err)
        setWarning(
          err instanceof Error
            ? `${err.message} Demo copy was kept.`
            : 'Copy AI unavailable — demo text was kept.',
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
        await updateCampaignStatus(
          session.campaignId,
          nextStatus as 'ready' | 'generating' | 'exported',
          {
            demoPack: true,
            outputsLocal: true,
            outputCount: nextOutputs.length,
          },
        )
      } catch (err) {
        console.warn('[Studio] Firestore recreate save failed — using local stash', err)
      }
    }

    clearRecreateSession()
    navigate(`/app/campaigns/${session.campaignId}`, { replace: true })
  }

  async function runStudioGenerate(opts: {
    campaignId: string
    productName: string
    productImage: string
    selectedAssets: Array<PhotoStyleId | VideoStyleId | AdStyleId>
    videoDurations?: Record<string, number>
    referenceDataUrl?: string
    /** Only mark free try after at least one AI asset succeeds */
    chargeFreeTry?: boolean
  }) {
    if (!kind || (kind !== 'photos' && kind !== 'videos')) return
    setStageCampaignId(opts.campaignId)
    setStagePhase('preparing')
    setStageProgress(8)
    setStageMessage('Preparing your project…')
    setStageOutputs([])
    setActiveOutputId(null)
    let aiSuccessCount = 0

    await new Promise((r) => setTimeout(r, 350))
    setStagePhase('analyzing')
    setStageProgress(22)
    setStageMessage(
      opts.referenceDataUrl
        ? 'Analyzing product + reference look…'
        : 'Analyzing product packaging…',
    )
    await new Promise((r) => setTimeout(r, 450))

    setStagePhase('generating')
    setStageProgress(40)
    setStageMessage(
      kind === 'videos' ? 'Generating videos…' : 'Generating images…',
    )

    let nextOutputs = buildMockOutputs({
      productName: opts.productName,
      productImageUrl: opts.productImage,
      selectedAssets: opts.selectedAssets,
      studioKind: kind,
      mode: 'studio',
      videoDurations: opts.videoDurations,
    })

    const imageOutputs = nextOutputs.filter((o) => isImageAssetKind(o.assetType))
    const videoOutputs = nextOutputs.filter((o) => isVideoAssetKind(o.assetType))
    let warn: string | null = null

    if (imageOutputs.length > 0) {
      let failCount = 0
      for (let i = 0; i < imageOutputs.length; i++) {
        const item = imageOutputs[i]!
        setStageProgress(42 + Math.round(((i + 1) / imageOutputs.length) * 35))
        setStageMessage(
          `Generating image ${i + 1} of ${imageOutputs.length}: ${item.label}…`,
        )
        try {
          const ai = await requestGenerateImages({
            productName: opts.productName,
            productImage: opts.productImage,
            referenceImage:
              opts.referenceDataUrl?.startsWith('data:image/')
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
            aiSuccessCount += 1
            nextOutputs = nextOutputs.map((o) =>
              o.id === item.id
                ? {
                    ...o,
                    imageUrl: generated.imageDataUrl,
                    note: 'AI generated in Studio',
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
          console.warn('[Studio] image failed', item.id, err)
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
      if (opts.referenceDataUrl?.startsWith('data:image/')) {
        referenceFrameImage = opts.referenceDataUrl
      } else if (opts.referenceDataUrl?.startsWith('data:video/')) {
        try {
          referenceFrameImage = await extractVideoFrameDataUrl(opts.referenceDataUrl)
        } catch {
          /* optional */
        }
      }

      let failCount = 0
      for (let i = 0; i < videoOutputs.length; i++) {
        const item = videoOutputs[i]!
        setStageProgress(48 + Math.round(((i + 1) / videoOutputs.length) * 40))
        setStageMessage(
          `Generating video ${i + 1} of ${videoOutputs.length}: ${item.label}…`,
        )
        try {
          const durationSeconds = clampVideoDuration(
            item.durationSeconds ??
              opts.videoDurations?.[item.assetType] ??
              DEFAULT_VIDEO_DURATION,
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
            aiSuccessCount += 1
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
          console.warn('[Studio] video failed', item.id, err)
          nextOutputs = nextOutputs.map((o) =>
            o.id === item.id
              ? {
                  ...o,
                  kind: 'video' as const,
                  videoUrl: undefined,
                  imageUrl: opts.productImage,
                  note: 'AI video failed — product still kept',
                }
              : o,
          )
        }
      }
      if (failCount) {
        warn = warn
          ? `${warn} Some videos also failed (${failCount}).`
          : `Some AI videos failed (${failCount}); product stills were kept.`
      }
    }

    setStagePhase('checking')
    setStageProgress(94)
    setStageMessage('Checking quality & packaging fidelity…')
    await new Promise((r) => setTimeout(r, 500))

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
        console.warn('[Studio] status update failed', err)
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
    // Only spend the free try when AI actually returned at least one asset.
    if (opts.chargeFreeTry && aiSuccessCount > 0) {
      await markFreeImageUsed()
    } else if (opts.chargeFreeTry && aiSuccessCount === 0) {
      setWarning(
        (warn ? `${warn} ` : '') +
          'Free credit was not used because generation did not return new creatives.',
      )
    }
    setBusy(false)
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
        setError(
          friendlyFirestoreError(err, 'Could not recreate this asset. Try again.'),
        )
        setBusy(false)
      }
      return
    }

    if (kind === 'videos') {
      if (!imageFile && !previewUrl) {
        setError(
          hasReference
            ? 'Add a product photo — we animate it using your reference.'
            : 'Add a product photo — we turn it into the video formats you pick.',
        )
        return
      }
      if (!hasReference && videoOutputCount === 0) {
        setError('Pick at least one video format (set how many variants you want on each card).')
        return
      }
    } else if (sourceType === 'upload' && !imageFile) {
      setError('Add a product photo to continue.')
      return
    }
    if (sourceType === 'url' && !productUrl.trim()) {
      setError('Add a product URL to continue.')
      return
    }
    if (sourceType === 'url' && !imageFile && !selectedUrlImage && !previewUrl) {
      setError('Pick a product photo from the URL, or upload one.')
      return
    }
    if (!assertCanGenerate()) return
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
      /* optional */
    }

    // With a reference, follow the ref look only — one default output, no format mix.
    const clampedPhotos = hasReference
      ? (['photo_studio_packshot'] as PhotoStyleId[])
      : resolvePhotoStyles(
          expandFormatQuantities(photoQuantities, photoTotalMax) as PhotoStyleId[],
        )
    const clampedVideos = hasReference
      ? (['video_ugc_selfie'] as VideoStyleId[])
      : resolveVideoStudioStyles(
          expandFormatQuantities(videoQuantities, videoTotalMax) as VideoStyleId[],
          videoTotalMax,
        )
    const selectedAssets =
      kind === 'photos'
        ? clampedPhotos
        : kind === 'videos'
          ? clampedVideos
          : hasReference
            ? resolveAdStyles([])
            : resolveAdStyles(adStyles)
    const displayName =
      productName.trim() ||
      (imageFile ? imageFile.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') : '') ||
      'Untitled product'

    const isFreeTry = kind === 'photos' && plan === 'free' && !freeImageUsed

    let fileForCreate = imageFile
    if (!fileForCreate && imageDataUrl?.startsWith('data:image/')) {
      fileForCreate = await dataUrlToFile(imageDataUrl, 'product.jpg')
    }

    try {
      const result = await withTimeout(
        createStudioProject({
          userId: user.uid,
          kind,
          // Prefer upload when we resolved a photo from the product page so Storage gets a durable image.
          sourceType: fileForCreate || imageDataUrl ? 'upload' : sourceType,
          productUrl: productUrl.trim() || undefined,
          productName: productName.trim() || undefined,
          description: description.trim() || undefined,
          brand: brand.trim() || undefined,
          imageFile: fileForCreate,
          photoStyles: clampedPhotos,
          videoStyles: clampedVideos,
          adStyles,
          tryFree: isFreeTry,
          videoDurations:
            kind === 'videos'
              ? (syncDurationsToQuantities(
                  videoQuantities,
                  videoDurations,
                ) as Record<string, number>)
              : undefined,
          creativeDirection: {
            prompt,
            lighting: lighting || undefined,
            background: background || undefined,
            mood: mood || undefined,
            styleTheme: styleTheme || undefined,
          },
        }),
        45_000,
        'create-studio',
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
      if (kind === 'videos') {
        stashCampaignVideoDurations(
          result.campaignId,
          syncDurationsToQuantities(videoQuantities, videoDurations) as Record<
            string,
            number
          >,
        )
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
      const productImage = imageDataUrl || cloudImage
      if (isSplitStudio && productImage) {
        try {
          await runStudioGenerate({
            campaignId: result.campaignId,
            productName: displayName,
            productImage,
            selectedAssets,
            videoDurations:
              kind === 'videos'
                ? (syncDurationsToQuantities(
                    videoQuantities,
                    videoDurations,
                  ) as Record<string, number>)
                : undefined,
            referenceDataUrl: refDataUrl,
            chargeFreeTry: isFreeTry,
          })
        } catch (genErr) {
          console.error(genErr)
          setStagePhase('error')
          setStageMessage('Generation stopped')
          setError(
            genErr instanceof Error
              ? genErr.message
              : 'Generation failed. Try again.',
          )
          setBusy(false)
        }
        return
      }
      if (isFreeTry) await markFreeImageUsed()
      navigate(`/app/campaigns/${result.campaignId}`, {
        replace: true,
        state: {
          autoGenerate: true,
          ...(productImage ? { productImage } : {}),
          ...(refDataUrl ? { referenceImage: refDataUrl } : {}),
        },
      })
    } catch (err) {
      console.warn('[Studio] falling back to local demo project', err)
      try {
        const id = newLocalId('studio')
        const titleSuffix =
          kind === 'photos' ? 'Photos' : kind === 'videos' ? 'Videos' : 'Ads'
        // Compress first; never put the full data URL into the campaign JSON
        // Do not use blob: previewUrl — it dies after navigation
        let imageUrl = imageDataUrl || undefined
        if (!imageUrl && imageFile) {
          imageUrl = await compressImageDataUrl(await fileToDataUrl(imageFile))
        }
        if (imageUrl?.startsWith('data:image/')) {
          imageUrl = await compressImageDataUrl(imageUrl)
        }
        const syncedDurations =
          kind === 'videos'
            ? (syncDurationsToQuantities(videoQuantities, videoDurations) as Record<
                string,
                number
              >)
            : undefined
        // Never stash blob: preview URLs — they die after navigation
        if (imageUrl?.startsWith('blob:')) {
          throw new Error(
            'Product photo did not finish loading. Re-select the image and try again.',
          )
        }
        if (imageUrl) {
          await stashCampaignImageSafe(id, imageUrl)
          if (!loadStashedCampaignImage(id)) {
            throw new Error(
              'Could not keep your product photo in the browser. Try a smaller JPG, then create again.',
            )
          }
        } else if (kind === 'photos' || kind === 'videos' || kind === 'ads') {
          throw new Error('Add a product photo before creating this project.')
        }
        const saved = saveLocalCampaign({
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
          // HTTPS only inline; data URLs live in image stash
          imageUrl: imageUrl?.startsWith('data:') ? undefined : imageUrl,
          ...(syncedDurations ? { videoDurations: syncedDurations } : {}),
          createdAt: Date.now(),
        })
        if (!saved || !loadLocalCampaign(id)) {
          throw new Error(
            'Could not save this project in the browser. Try a smaller photo, or check that cloud create is working.',
          )
        }
        if (syncedDurations) stashCampaignVideoDurations(id, syncedDurations)
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
        if (isSplitStudio && imageUrl) {
          try {
            await runStudioGenerate({
              campaignId: id,
              productName: displayName,
              productImage: imageUrl,
              selectedAssets,
              videoDurations: syncedDurations,
              referenceDataUrl: refDataUrl,
              chargeFreeTry: isFreeTry,
            })
          } catch (genErr) {
            console.error(genErr)
            setStagePhase('error')
            setStageMessage('Generation stopped')
            setError(
              genErr instanceof Error
                ? genErr.message
                : 'Generation failed. Try again.',
            )
            setBusy(false)
          }
          return
        }
        if (isFreeTry) await markFreeImageUsed()
        navigate(`/app/campaigns/${id}`, {
          replace: true,
          state: {
            autoGenerate: true,
            ...(imageUrl ? { productImage: imageUrl } : {}),
            ...(refDataUrl ? { referenceImage: refDataUrl } : {}),
          },
        })
      } catch (localErr) {
        console.error(localErr)
        const cloudHint =
          err instanceof Error && err.message
            ? ` Cloud error: ${err.message}`
            : ''
        setError(
          friendlyFirestoreError(
            localErr,
            `Could not start this project.${cloudHint} Try again with a smaller photo.`,
          ),
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
            ? 'Add your product, optional prompt, then pick formats — or upload your own reference on the first card.'
            : 'Product photo or URL → optional prompt → pick formats, or upload your own reference as the first card.',
          image: '/images/audience-beauty.jpg',
          accent: 'photos' as const,
          cta: hasReference
            ? 'Generate from reference'
            : photoOutputCount > 0
              ? `Generate ${photoOutputCount} image${photoOutputCount === 1 ? '' : 's'}`
              : tryFree
                ? 'Generate free images'
                : 'Generate images',
          stylesTitle: 'Formats or your reference',
          stylesHint: `First card = your reference. Or tap formats and set variants · max ${photoTotalMax}.`,
        }
      : kind === 'videos' && isUgcFocus
        ? {
            kicker: 'UGC Studio',
            title: 'Creator-style product videos',
            lead: 'Product photo → optional prompt → pick formats, or upload your own reference clip on the first card.',
            image: '/images/video-poster-ugc.jpg',
            accent: 'videos' as const,
            cta: hasReference
              ? 'Generate from reference'
              : videoOutputCount > 0
                ? `Generate ${videoOutputCount} video${videoOutputCount === 1 ? '' : 's'}`
                : 'Generate videos',
            stylesTitle: 'Formats or your reference',
            stylesHint: `First card = your vibe clip. Or pick formats · up to ${videoTotalMax}.`,
          }
        : kind === 'videos'
          ? {
              kicker: 'Video Studio',
              title: 'Product photo → formats → videos',
              lead: 'Upload your product, optional prompt, then pick formats — or upload your own reference on the first card.',
              image: '/images/video-poster-table-talk.jpg',
              accent: 'videos' as const,
              cta: hasReference
                ? 'Generate from reference'
                : videoOutputCount > 0
                  ? `Generate ${videoOutputCount} video${videoOutputCount === 1 ? '' : 's'}`
                  : 'Generate videos',
              stylesTitle: 'Formats or your reference',
              stylesHint: `First card = your reference. Or pick formats + length · max ${videoTotalMax}.`,
            }
          : {
              kicker: 'Ads & Social',
              title: 'Build ad-ready creatives',
              lead: 'Upload your product, then generate paid visuals and conversion-focused copy.',
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

  const formBody = (
        <form className="app-form campaign-form create-panel studio-panel" onSubmit={onSubmit}>
          <header className="studio-workbench-head">
            <div>
              <p className="studio-workbench-kicker">{studioMeta.kicker}</p>
              <h1>{studioMeta.title}</h1>
              <p>{studioMeta.lead}</p>
            </div>
            {isRecreate && recreate ? (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  clearRecreateSession()
                  navigate(`/app/campaigns/${recreate.campaignId}`)
                }}
              >
                ← Back to campaign
              </button>
            ) : null}
          </header>
          <section className="form-section">
            <div className="form-section-head">
              <h2>1. Product</h2>
              <p>
                {isRecreate
                  ? 'Your campaign product — change only if needed'
                  : kind === 'videos'
                    ? 'Product photo required — we generate videos from this image'
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
              compact={!isRecreate}
              videoStudioMode={kind === 'videos' && !isRecreate}
              embedded
              promptPlaceholder={
                isRecreate
                  ? 'e.g. Brighter lighting, white background, less glitter, keep packaging sharp…'
                  : kind === 'photos'
                    ? 'e.g. Soft morning light on marble, keep bottle label sharp…'
                    : kind === 'videos'
                      ? 'e.g. Soft talking pace, keep bottle true, warm vanity light, short hook…'
                      : 'e.g. Bold offer creative for Meta ads, clean white space for CTA…'
              }
            />
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>3. {studioMeta.stylesTitle}</h2>
              <p>
                {kind === 'photos' || kind === 'videos'
                  ? hasReference
                    ? 'Using your reference — pick a format card to switch back'
                    : kind === 'photos'
                      ? usingDefaults
                        ? `First card = your reference · or tap formats · max ${photoTotalMax}`
                        : `${photoOutputCount} / ${photoTotalMax} images`
                      : usingDefaults
                        ? `First card = your reference · or tap formats · max ${videoTotalMax}`
                        : `${videoOutputCount} / ${videoTotalMax} videos`
                  : usingDefaults
                    ? studioMeta.stylesHint
                    : `${selectionCount()} selected`}
              </p>
            </div>

            {(kind === 'photos' || kind === 'videos') && (
              <p className="studio-formats-intro">
                Upload your own reference on the blank card, or pick preset formats.
                Choosing one clears the other.
              </p>
            )}

            {kind === 'photos' && (
              <FormatPickGrid
                items={PHOTO_STYLES}
                quantities={photoQuantities}
                onQuantitiesChange={setPhotoQuantities}
                defaultIds={hasReference ? [] : DEFAULT_PHOTO_STYLES}
                max={photoTotalMax}
                disabled={busy}
                ariaLabel="Photo formats"
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
                    `Your plan allows up to ${photoTotalMax} images total (all formats combined).`,
                  )
                }
              />
            )}

            {kind === 'videos' && (
              <FormatPickGrid
                items={VIDEO_STYLES}
                quantities={videoQuantities}
                onQuantitiesChange={setVideoQuantities}
                durations={videoDurations}
                onDurationsChange={setVideoDurations}
                showDuration
                defaultIds={[]}
                max={videoTotalMax}
                disabled={busy}
                videoAspect
                ariaLabel="Video formats"
                referenceSlot={{
                  kind: 'video',
                  previewUrl: referencePreviewUrl,
                  error: referenceError,
                  busy: referenceUrlBusy,
                  onPickFile: pickReferenceFile,
                  onPickUrl: applyReferenceUrl,
                }}
                onLimitHit={() =>
                  setWarning(
                    `Your plan allows up to ${videoTotalMax} videos total (all formats combined).`,
                  )
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
                : stagePhase !== 'idle' && stagePhase !== 'ready' && stagePhase !== 'error'
                  ? 'Generating…'
                  : 'Creating…'
              : studioMeta.cta}
            <span aria-hidden="true">→</span>
          </button>
        </form>
  )

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
      <main
        className={`app-main campaign-create studio-page studio-page-${studioMeta.accent}${isSplitStudio ? ' studio-page-split' : ''}`}
      >
        {isSplitStudio ? (
          <div className="studio-split">
            <div className="studio-split-controls">{formBody}</div>
            <StudioStagePanel
              kind={kind}
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
        ) : (
          formBody
        )}
      </main>
    </AppLayout>
  )
}
