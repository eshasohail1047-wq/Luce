import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CreativeDirectionFields from '../components/CreativeDirectionFields'
import FormatPickGrid from '../components/FormatPickGrid'
import { useAuth } from '../auth/AuthProvider'
import { getPlanLimits } from '../lib/planLimits'
import {
  DEFAULT_VIDEO_DURATION,
  expandFormatQuantities,
  syncDurationsToQuantities,
  totalQuantity,
  type FormatDurations,
  type FormatQuantities,
} from '../lib/formatQuantities'
import {
  createStudioProject,
  friendlyFirestoreError,
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
} from '../lib/generateImages'
import {
  extractVideoFrameDataUrl,
  isVideoAssetKind,
  playableVideoUrl,
  requestGenerateVideos,
} from '../lib/generateVideos'
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
  const isRecreate = Boolean(recreate) || searchParams.get('recreate') === '1'
  const limits = getPlanLimits(plan)
  const photoTotalMax = Math.max(1, limits.maxImages)
  const videoTotalMax =
    limits.maxVideos > 0 ? limits.maxVideos : VIDEO_STUDIO_FORMAT_COUNT
  const photoOutputCount = totalQuantity(photoQuantities)
  const videoOutputCount = totalQuantity(videoQuantities)

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
        setError('Add a product photo — we turn it into the video formats you pick.')
        return
      }
      if (videoOutputCount === 0) {
        setError('Pick at least one video format (set how many variants you want on each card).')
        return
      }
    } else if (sourceType === 'upload' && !imageFile) {
      setError('Add a product photo to continue.')
      return
    }
    if (sourceType === 'url' && !productUrl.trim() && kind !== 'videos') {
      setError('Add a product URL to continue.')
      return
    }
    if (sourceType === 'url' && !productUrl.trim() && kind === 'videos' && !imageFile) {
      setError('Add a product photo (required for video) or a product URL with a photo.')
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
      }
    } catch {
      /* optional */
    }

    const clampedPhotos = resolvePhotoStyles(
      expandFormatQuantities(photoQuantities, photoTotalMax) as PhotoStyleId[],
    )
    const clampedVideos = resolveVideoStudioStyles(
      expandFormatQuantities(videoQuantities, videoTotalMax) as VideoStyleId[],
      videoTotalMax,
    )
    const selectedAssets =
      kind === 'photos'
        ? clampedPhotos
        : kind === 'videos'
          ? clampedVideos
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
      if (imageDataUrl) await stashCampaignImageSafe(result.campaignId, imageDataUrl)
      else if (cloudImage) await stashCampaignImageSafe(result.campaignId, cloudImage)
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
      // Reserve the free image try when the project is started
      if (isFreeTry) await markFreeImageUsed()
      navigate(`/app/campaigns/${result.campaignId}`, {
        replace: true,
        state: {
          ...(imageDataUrl || cloudImage
            ? { productImage: imageDataUrl || cloudImage }
            : {}),
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
        if (isFreeTry) await markFreeImageUsed()
        navigate(`/app/campaigns/${id}`, {
          replace: true,
          state: {
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
            ? 'Add your product, optional reference + prompt, then pick formats — set how many variants you want on each card.'
            : 'Product photo or URL → optional reference + prompt → pick formats and how many variants each. Results follow your reference when provided.',
          image: '/images/audience-beauty.jpg',
          accent: 'photos' as const,
          cta:
            photoOutputCount > 0
              ? `Generate ${photoOutputCount} image${photoOutputCount === 1 ? '' : 's'}`
              : tryFree
                ? 'Generate free images'
                : 'Generate images',
          stylesTitle: 'Pick formats & variants',
          stylesHint: `Tap a format, then use + / − for variants (e.g. 3 studio shoots). Plan max ${photoTotalMax}.`,
        }
      : kind === 'videos' && isUgcFocus
        ? {
            kicker: 'UGC Studio',
            title: 'Creator-style product videos',
            lead: 'Product photo → optional prompt/ref → pick formats and how many of each (e.g. 3 UGC clips).',
            image: '/images/video-poster-ugc.jpg',
            accent: 'videos' as const,
            cta:
              videoOutputCount > 0
                ? `Generate ${videoOutputCount} video${videoOutputCount === 1 ? '' : 's'}`
                : 'Generate videos',
            stylesTitle: 'Pick formats & variants',
            stylesHint: `Any formats · variants + length (5–15s) · up to ${videoTotalMax} on your plan.`,
          }
        : kind === 'videos'
          ? {
              kicker: 'Video Studio',
              title: 'Product photo → formats → videos',
              lead: 'Upload your product, optionally add a prompt or reference clip, then choose any formats and how many variants each.',
              image: '/images/video-poster-table-talk.jpg',
              accent: 'videos' as const,
              cta:
                videoOutputCount > 0
                  ? `Generate ${videoOutputCount} video${videoOutputCount === 1 ? '' : 's'}`
                  : 'Generate videos',
              stylesTitle: 'Pick formats & variants',
              stylesHint: `Pick formats, set variants + length (5–15s, presets or custom) · max ${videoTotalMax} total.`,
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
              {kind === 'videos' && !isRecreate ? (
                <>
                  <li>Upload product photo</li>
                  <li>Optional ref + prompt</li>
                  <li>Formats + variants</li>
                  <li>Generate videos</li>
                </>
              ) : kind === 'photos' && !isRecreate ? (
                <>
                  <li>Product photo or URL</li>
                  <li>Optional ref + prompt</li>
                  <li>Formats + variants</li>
                  <li>Generate images</li>
                </>
              ) : (
                <>
                  <li>
                    {isRecreate
                      ? 'Confirm product'
                      : sourceType === 'url'
                        ? 'Confirm product'
                        : 'Upload product'}
                  </li>
                  <li>{isRecreate ? 'Describe changes' : 'Set creative direction'}</li>
                  <li>{isRecreate ? 'Apply' : 'Generate'}</li>
                </>
              )}
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
              <h2>
                {kind === 'videos' ? '2. Creative direction' : '2. Creative direction'}
              </h2>
              <p>
                {isRecreate
                  ? 'Required — write what you want changed'
                  : kind === 'videos'
                    ? 'Optional — prompt and vibe clip refine your product videos'
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
              videoStudioMode={kind === 'videos' && !isRecreate}
              embedded={kind === 'videos' && !isRecreate}
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
                {kind === 'photos'
                  ? usingDefaults
                    ? `Tap formats · set variants with + / − · max ${photoTotalMax} images`
                    : `${photoOutputCount} / ${photoTotalMax} images`
                  : kind === 'videos'
                    ? usingDefaults
                      ? `Tap formats · set variants · max ${videoTotalMax} videos`
                      : `${videoOutputCount} / ${videoTotalMax} videos`
                    : usingDefaults
                      ? studioMeta.stylesHint
                      : `${selectionCount()} selected`}
              </p>
            </div>

            {kind === 'photos' && (
              <FormatPickGrid
                items={PHOTO_STYLES}
                quantities={photoQuantities}
                onQuantitiesChange={setPhotoQuantities}
                defaultIds={DEFAULT_PHOTO_STYLES}
                max={photoTotalMax}
                disabled={busy}
                ariaLabel="Photo formats"
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
                : 'Creating…'
              : studioMeta.cta}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </main>
    </AppLayout>
  )
}
