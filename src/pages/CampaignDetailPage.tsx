import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import {
  asFlatStringArray,
  deleteUserCampaign,
  firestoreOutputSummary,
  friendlyFirestoreError,
  purgeCorruptCampaignOutputs,
  updateCampaignStatus,
} from '../lib/campaigns'
import { requireDb } from '../lib/firebase'
import { canGenerate, type GenerateAction } from '../lib/planAccess'
import { sendTransactionalEmail } from '../lib/transactionalEmail'
import PaywallModal from '../components/PaywallModal'
import {
  CAMPAIGN_DELIVERABLES,
  formatLabel,
  videoUrlForAsset,
  type DeliverableId,
  type StudioKind,
} from '../lib/deliverables'
import {
  fileToDataUrl,
  isLocalCampaignId,
  loadLocalCampaign,
  loadStashedCampaignImage,
  loadStashedCampaignOutputs,
  loadStashedCampaignRefImage,
  loadStashedCampaignVideoDurations,
  resolveCampaignImage,
  resolveCampaignRefImage,
  stashCampaignImage,
  stashCampaignImageSafe,
  stashCampaignRefImageSafe,
  stashCampaignCoverSafe,
  stashCampaignOutputs,
  stashProductImageSafe,
  updateLocalCampaign,
} from '../lib/localDemoCampaign'
import {
  DEFAULT_VIDEO_DURATION,
  clampVideoDuration,
} from '../lib/formatQuantities'
import type { CreativeDirection } from '../lib/creativeDirection'
import { sanitizeCreativeDirection } from '../lib/creativeDirection'
import {
  isImageAssetKind,
  requestGenerateImages,
  type ImageAssetKind,
} from '../lib/generateImages'
import {
  isCopyAssetKind,
  requestGenerateCopy,
  type CopyAssetKind,
} from '../lib/generateCopy'
import {
  extractVideoFrameDataUrl,
  isVideoAssetKind,
  playableVideoUrl,
  requestGenerateVideos,
  type VideoAssetKind,
} from '../lib/generateVideos'
import {
  buildMockOutputs,
  downloadMockOutput,
  downloadMockPack,
  ensurePlayableVideoOutputs,
  type MockOutput,
} from '../lib/mockCampaign'
import {
  saveRecreateSession,
  studioKindForAsset,
} from '../lib/recreateSession'
import {
  isAssetSaved,
  saveAssetToLibrary,
  unsaveAsset,
} from '../lib/savedAssets'
import { statusLabel, studioPathFor } from '../lib/workspaceUi'

type CampaignView = {
  title: string
  status: string
  productName: string
  productId: string
  productUrl?: string
  mode: 'campaign' | 'studio'
  studioKind?: StudioKind
  deliverables: DeliverableId[]
  selectedAssets: string[]
  includeStrategy: boolean
  tryFree: boolean
  imageUrl?: string
  /** Per video format id → seconds */
  videoDurations?: Record<string, number>
  outputs?: MockOutput[]
  creativeDirection?: CreativeDirection
}

function applyAiImageToOutput(
  item: MockOutput,
  imageDataUrl: string,
): MockOutput {
  return {
    ...item,
    imageUrl: imageDataUrl,
    note:
      (item.version || 1) > 1
        ? `AI-generated · ${item.label} format · v${item.version} · product identity kept`
        : `AI-generated · ${item.label} format · product identity from your photo`,
  }
}

function applyAiVideoToOutput(
  item: MockOutput,
  videoUrl: string,
): MockOutput {
  const secs = item.durationSeconds
    ? clampVideoDuration(item.durationSeconds)
    : undefined
  return {
    ...item,
    videoUrl,
    kind: 'video' as const,
    ...(secs ? { durationSeconds: secs } : {}),
    note:
      (item.version || 1) > 1
        ? `AI-generated video · ${secs || DEFAULT_VIDEO_DURATION}s · variant ${item.version}`
        : `AI-generated video · ${secs || DEFAULT_VIDEO_DURATION}s · your product as first frame`,
  }
}

function parseVideoDurations(raw: unknown): Record<string, number> | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = Number(v)
    if (Number.isFinite(n) && n > 0) out[k] = clampVideoDuration(n)
  }
  return Object.keys(out).length ? out : undefined
}

function assetLabel(id: string) {
  return formatLabel(id) || id.replaceAll('_', ' ')
}

const STEPS = [
  { id: 'product', label: 'Product' },
  { id: 'generate', label: 'Generate' },
  { id: 'review', label: 'Review' },
  { id: 'export', label: 'Export' },
] as const

function activeStep(status: string) {
  if (status === 'exported') return 3
  if (status === 'ready') return 2
  if (status === 'generating' || status === 'researching' || status === 'strategy_ready') return 1
  return 0
}

export default function CampaignDetailPage() {
  const { campaignId } = useParams()
  const location = useLocation()
  const { user, plan, freeImageUsed, markFreeImageUsed, workspace, loading } =
    useAuth()
  const navigate = useNavigate()
  const navProductImage = (() => {
    const s = location.state as {
      productImage?: string
      referenceImage?: string
      autoGenerate?: boolean
    } | null
    const img = s?.productImage?.trim()
    return img && (img.startsWith('data:image/') || img.startsWith('http'))
      ? img
      : undefined
  })()
  const navReferenceImage = (() => {
    const s = location.state as { referenceImage?: string } | null
    const img = s?.referenceImage?.trim()
    return img && (img.startsWith('data:image/') || img.startsWith('http'))
      ? img
      : undefined
  })()
  /** Captured once on mount — location.state is cleared after product stash. */
  const [fromGenerateFlow] = useState(() =>
    Boolean(
      (location.state as { autoGenerate?: boolean } | null)?.autoGenerate,
    ),
  )
  const [kickoffPending, setKickoffPending] = useState(() =>
    Boolean(
      (location.state as { autoGenerate?: boolean } | null)?.autoGenerate,
    ),
  )
  const autoGenerateStartedRef = useRef(false)
  const [campaign, setCampaign] = useState<CampaignView | null>(null)
  /** Load failures only — blank empty-state when campaign is missing. */
  const [loadError, setLoadError] = useState<string | null>(null)
  /** Inline action failures (generate/export) — never blank the campaign UI. */
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionMsg, setActionMsg] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [replacingPhoto, setReplacingPhoto] = useState(false)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [paywallReason, setPaywallReason] = useState<string | undefined>()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [previewSaved, setPreviewSaved] = useState(false)
  const [savingAsset, setSavingAsset] = useState(false)
  const productFileRef = useRef<HTMLInputElement>(null)
  const resultsTopRef = useRef<HTMLElement | null>(null)

  function generateActionForCampaign(): GenerateAction {
    if (!campaign) return 'campaign'
    if (campaign.mode === 'studio') {
      if (campaign.studioKind === 'videos') return 'videos'
      if (campaign.studioKind === 'ads') return 'ads'
      return 'photos'
    }
    return 'campaign'
  }

  function assertCanGenerate(): boolean {
    if (!campaign) return false
    const action = generateActionForCampaign()
    const check = canGenerate({ plan, action, freeImageUsed })
    if (check.allowed) return true
    // Finish the one free image pack started before the try was consumed
    if (action === 'photos' && campaign.tryFree && !campaign.outputs?.length) {
      return true
    }
    setPaywallReason(check.reason)
    setPaywallOpen(true)
    return false
  }

  useEffect(() => {
    if (!campaignId) {
      setFetching(false)
      setLoadError('Campaign not found.')
      return
    }
    if (!user) {
      // Auth still resolving, or signed out — don't leave the page stuck on Loading
      if (!loading) setFetching(false)
      return
    }
    let cancelled = false
    setFetching(true)
    setLoadError(null)
    setError(null)

    ;(async () => {
      try {
        // Studio handoff: product + optional style reference → durable stash
        if (navProductImage) {
          try {
            await stashCampaignImageSafe(campaignId, navProductImage)
          } catch {
            stashCampaignImage(campaignId, navProductImage)
          }
        }
        if (navReferenceImage) {
          try {
            await stashCampaignRefImageSafe(campaignId, navReferenceImage)
          } catch {
            /* optional */
          }
        }
        if (navProductImage || navReferenceImage || fromGenerateFlow) {
          navigate(location.pathname, { replace: true, state: null })
        }

        const stashed =
          (await resolveCampaignImage(campaignId)) ||
          loadStashedCampaignImage(campaignId) ||
          navProductImage
        // Warm ref cache for generate
        await resolveCampaignRefImage(campaignId)

        if (isLocalCampaignId(campaignId)) {
          const local = loadLocalCampaign(campaignId)
          if (!local) {
            if (!cancelled) {
              setCampaign(null)
              setLoadError('Demo campaign not found. Create a new one.')
            }
            return
          }
          if (!cancelled) {
            setLoadError(null)
            const resolvedImage = local.imageUrl || stashed
            setCampaign({
              title: local.title,
              status: local.status,
              productName: local.productName,
              productId: local.productId,
              productUrl: local.productUrl,
              mode: local.mode,
              studioKind: local.studioKind,
              deliverables: local.deliverables,
              selectedAssets: asFlatStringArray(local.selectedAssets),
              includeStrategy: local.includeStrategy,
              tryFree: local.tryFree,
              imageUrl: resolvedImage,
              videoDurations:
                local.videoDurations ||
                loadStashedCampaignVideoDurations(campaignId),
              outputs:
                loadStashedCampaignOutputs<MockOutput[]>(campaignId) ||
                local.outputs,
              creativeDirection: undefined,
            })
          }
          return
        }

        const snap = await getDoc(doc(requireDb(), 'campaigns', campaignId))
        if (!snap.exists()) {
          if (!cancelled) {
            setCampaign(null)
            setLoadError('Campaign not found.')
          }
          return
        }
        const data = snap.data()
        if (data.userId !== user.uid) {
          if (!cancelled) {
            setCampaign(null)
            setLoadError('You do not have access to this campaign.')
          }
          return
        }

        let imageUrl: string | undefined = stashed
        const productId = String(data.productId ?? '')
        if (productId) {
          try {
            const productSnap = await getDoc(doc(requireDb(), 'products', productId))
            if (productSnap.exists()) {
              const urls = asFlatStringArray(productSnap.data().imageUrls)
              if (urls[0]) imageUrl = urls[0]
            }
          } catch {
            /* optional */
          }
        }
        if (!imageUrl) imageUrl = stashed

        // Never trust legacy Firestore `outputs` arrays — they caused nested-entity
        // write failures and may still be corrupt on old docs. Prefer session stash.
        const stashedOutputs = loadStashedCampaignOutputs<MockOutput[]>(campaignId)

        if (!cancelled) {
          setLoadError(null)
          setCampaign({
            title: String(data.title ?? 'Campaign'),
            status: String(data.status ?? 'draft'),
            productName: String(data.productName ?? 'Product'),
            productId,
            productUrl: data.productUrl ? String(data.productUrl) : undefined,
            mode: data.mode === 'studio' ? 'studio' : 'campaign',
            studioKind: data.studioKind as StudioKind | undefined,
            deliverables: asFlatStringArray(data.deliverables) as DeliverableId[],
            selectedAssets: asFlatStringArray(data.selectedAssets),
            includeStrategy: Boolean(data.includeStrategy),
            tryFree: Boolean(data.tryFree),
            imageUrl,
            videoDurations:
              parseVideoDurations(data.videoDurations) ||
              loadStashedCampaignVideoDurations(campaignId),
            outputs: stashedOutputs?.length ? stashedOutputs : undefined,
            creativeDirection: data.creativeDirection
              ? sanitizeCreativeDirection(
                  data.creativeDirection as CreativeDirection,
                )
              : undefined,
          })
          // Seed list/grid covers from this pack or product still
          if (stashedOutputs?.length) {
            stashCampaignOutputs(campaignId, stashedOutputs)
          } else if (imageUrl) {
            void stashCampaignCoverSafe(campaignId, imageUrl)
          }
          if (imageUrl && productId) {
            void stashProductImageSafe(productId, imageUrl)
          }
        }

        // Best-effort: remove legacy corrupt outputs fields so future status syncs succeed.
        if (data.outputs !== undefined || data.outputLabels !== undefined) {
          void purgeCorruptCampaignOutputs(campaignId)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) {
          setCampaign(null)
          setLoadError(
            friendlyFirestoreError(err, 'Could not load this campaign.'),
          )
        }
      } finally {
        if (!cancelled) setFetching(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [
    user,
    campaignId,
    loading,
    navProductImage,
    navReferenceImage,
    fromGenerateFlow,
    location.pathname,
    navigate,
  ])

  const outputs = useMemo(() => {
    if (!campaign) return []
    if (campaign.outputs && campaign.outputs.length > 0) {
      return ensurePlayableVideoOutputs(campaign.outputs)
    }
    if (campaign.status === 'ready' || campaign.status === 'exported') {
      return ensurePlayableVideoOutputs(
        buildMockOutputs({
          productName: campaign.productName,
          productImageUrl: campaign.imageUrl,
          selectedAssets: campaign.selectedAssets,
          studioKind: campaign.studioKind,
          mode: campaign.mode,
          videoDurations: campaign.videoDurations,
        }),
      )
    }
    return []
  }, [campaign])

  const preview =
    outputs.find((o) => o.id === previewId) || outputs[0] || null

  useEffect(() => {
    if (!previewId && outputs[0]) setPreviewId(outputs[0].id)
  }, [outputs, previewId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!user || !campaignId || !preview?.id) {
        setPreviewSaved(false)
        return
      }
      try {
        const saved = await isAssetSaved(user.uid, campaignId, preview.id)
        if (!cancelled) setPreviewSaved(saved)
      } catch {
        if (!cancelled) setPreviewSaved(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, campaignId, preview?.id])

  async function persistStatus(
    status: string,
    extra: { outputs?: MockOutput[] } = {},
  ) {
    if (!campaignId) return
    if (extra.outputs) {
      stashCampaignOutputs(campaignId, extra.outputs)
    }
    if (isLocalCampaignId(campaignId)) {
      updateLocalCampaign(campaignId, { status, ...extra })
      return
    }
    // Generate must never depend on Firestore. Pack lives in sessionStorage;
    // cloud status sync is optional and must not surface errors to the UI.
    try {
      await updateCampaignStatus(
        campaignId,
        status as 'generating' | 'ready' | 'exported',
        extra.outputs ? firestoreOutputSummary(extra.outputs) : {},
      )
    } catch (err) {
      console.warn('[campaign] Firestore status sync skipped', err)
    }
  }

  /** Prefer live product Storage URL, then stash — never generate blind. */
  async function resolveProductImage(): Promise<string | undefined> {
    if (!campaignId || !campaign) return undefined
    let url =
      campaign.imageUrl ||
      loadStashedCampaignImage(campaignId) ||
      undefined

    if ((!url || url.startsWith('/images/')) && campaign.productId) {
      for (let i = 0; i < 10; i++) {
        try {
          const productSnap = await getDoc(
            doc(requireDb(), 'products', campaign.productId),
          )
          if (productSnap.exists()) {
            const urls = asFlatStringArray(productSnap.data().imageUrls)
            if (urls[0]) {
              url = urls[0]
              break
            }
          }
        } catch {
          /* retry */
        }
        await new Promise((r) => setTimeout(r, 400))
      }
    }

    if (url && !url.startsWith('/images/')) {
      if (url.startsWith('data:image/')) {
        url = await stashCampaignImageSafe(campaignId, url)
      } else {
        stashCampaignImage(campaignId, url)
      }
      setCampaign((prev) => (prev ? { ...prev, imageUrl: url } : prev))
      return url
    }
    return undefined
  }

  async function runMockGenerate() {
    if (!campaignId || !campaign) return
    if (!assertCanGenerate()) return
    setActionBusy(true)
    setError(null)
    setActionMsg(null)
    setProgress(8)
    try {
      await persistStatus('generating')
      setCampaign((prev) => (prev ? { ...prev, status: 'generating' } : prev))

      setActionMsg('Confirming your product photo…')
      const productImageUrl = await resolveProductImage()
      if (!productImageUrl) {
        throw new Error(
          'Your product photo is missing. Use “Upload photo” / “Replace photo” on this page, then Generate again.',
        )
      }

      // Warm auth + show which AI path will run (OpenRouter until Muse/HeyGen keys are set)
      try {
        const statusRes = await fetch('/api/ai-status')
        const statusJson = (await statusRes.json().catch(() => null)) as {
          summary?: string
        } | null
        if (statusJson?.summary) {
          setActionMsg(`AI ready · ${statusJson.summary}`)
          await new Promise((r) => setTimeout(r, 400))
        }
      } catch {
        /* optional */
      }

      for (const value of [28, 52, 74]) {
        await new Promise((r) => setTimeout(r, 420))
        setProgress(value)
      }

      let nextOutputs = buildMockOutputs({
        productName: campaign.productName,
        productImageUrl,
        selectedAssets: campaign.selectedAssets,
        studioKind: campaign.studioKind,
        mode: campaign.mode,
        videoDurations: campaign.videoDurations,
      })

      const imageOutputs = nextOutputs.filter((o) =>
        isImageAssetKind(o.assetType),
      )
      const videoOutputs = nextOutputs.filter((o) =>
        isVideoAssetKind(o.assetType),
      )

      let aiWarning: string | null = null
      const stashedRef =
        (campaignId
          ? (await resolveCampaignRefImage(campaignId)) ||
            loadStashedCampaignRefImage(campaignId)
          : undefined) || undefined

      if (imageOutputs.length > 0) {
        setProgress(78)
        setActionMsg(
          stashedRef
            ? 'Generating AI images (product + your style reference)…'
            : 'Generating AI product images…',
        )
        const referenceImage =
          stashedRef && stashedRef.startsWith('data:image/')
            ? stashedRef
            : undefined
        if (!referenceImage) {
          console.warn(
            '[generate] no style reference attached — formats will use product look only',
          )
        }
        let imageFailCount = 0
        for (let i = 0; i < imageOutputs.length; i++) {
          const item = imageOutputs[i]!
          setProgress(78 + Math.round(((i + 1) / imageOutputs.length) * 8))
          setActionMsg(
            `Generating image ${i + 1} of ${imageOutputs.length}: ${item.label}${(item.version || 1) > 1 ? ` · v${item.version}` : ''}…`,
          )
          try {
            if (!productImageUrl) {
              throw new Error('Product photo missing — cannot generate formats.')
            }
            const ai = await requestGenerateImages({
              productName: campaign.productName,
              productImage: productImageUrl,
              referenceImage,
              creativeDirection: campaign.creativeDirection,
              assets: [item.assetType as ImageAssetKind],
              recreateNote:
                (item.version || 1) > 1
                  ? `Create variation ${item.version} of this format — different angle, lighting, or composition while keeping packaging true. Prefer the reference look when provided.`
                  : referenceImage
                    ? 'Match the reference photo mood/style; keep product packaging exact.'
                    : undefined,
            })
            const generated = ai.assets[0]
            if (generated) {
              nextOutputs = nextOutputs.map((o) =>
                o.id === item.id
                  ? applyAiImageToOutput(o, generated.imageDataUrl)
                  : o,
              )
            } else {
              throw new Error('No image returned')
            }
          } catch (err) {
            imageFailCount += 1
            const failReason =
              err instanceof Error ? err.message : 'Image generation failed'
            console.warn('[generate] image variant failed', item.id, err)
            // Keep the user's product — never leave a stock demo perfume in the pack.
            if (productImageUrl) {
              nextOutputs = nextOutputs.map((o) =>
                o.id === item.id
                  ? {
                      ...o,
                      imageUrl: productImageUrl,
                      note: `AI failed for this format — ${failReason}`,
                    }
                  : o,
              )
            }
          }
        }
        if (imageFailCount) {
          aiWarning = `Some AI images failed (${imageFailCount}); your product photo was kept for those.`
        }
      }

      if (videoOutputs.length > 0) {
        setProgress(86)
        setActionMsg('Generating AI videos from your product photo…')
        try {
          if (!productImageUrl) {
            throw new Error(
              'Product photo missing — Video Studio needs your packaging still.',
            )
          }
          let referenceFrameImage: string | undefined
          if (stashedRef?.startsWith('data:image/')) {
            referenceFrameImage = stashedRef
          } else if (stashedRef?.startsWith('data:video/')) {
            referenceFrameImage = await extractVideoFrameDataUrl(stashedRef)
          }

          let videoFailCount = 0
          for (let i = 0; i < videoOutputs.length; i++) {
            const item = videoOutputs[i]!
            const kind = item.assetType as VideoAssetKind
            setProgress(86 + Math.round(((i + 1) / videoOutputs.length) * 10))
            setActionMsg(
              `Generating video ${i + 1} of ${videoOutputs.length}: ${item.label}${(item.version || 1) > 1 ? ` · v${item.version}` : ''}…`,
            )
            try {
              const durationSeconds = clampVideoDuration(
                item.durationSeconds ??
                  campaign.videoDurations?.[item.assetType] ??
                  DEFAULT_VIDEO_DURATION,
              )
              const ai = await requestGenerateVideos({
                productName: campaign.productName,
                productImage: productImageUrl,
                referenceFrameImage,
                creativeDirection: {
                  ...campaign.creativeDirection,
                  prompt: [
                    campaign.creativeDirection?.prompt?.trim(),
                    (item.version || 1) > 1
                      ? `Variation ${item.version} of this format — distinct shot while keeping product true.`
                      : '',
                  ]
                    .filter(Boolean)
                    .join(' '),
                },
                assets: [kind],
                durationSeconds,
              })
              const clipUrl = playableVideoUrl(ai.assets[0])
              if (clipUrl) {
                nextOutputs = nextOutputs.map((o) =>
                  o.id === item.id
                    ? applyAiVideoToOutput(
                        { ...o, durationSeconds },
                        clipUrl,
                      )
                    : o,
                )
              } else {
                throw new Error('No video returned')
              }
            } catch (err) {
              videoFailCount += 1
              const failReason =
                err instanceof Error ? err.message : 'Video generation failed'
              console.warn('[generate] video variant failed', item.id, err)
              // Keep a playable demo format clip; product photo stays as poster.
              const demoClip = videoUrlForAsset(item.assetType)
              nextOutputs = nextOutputs.map((o) =>
                o.id === item.id
                  ? {
                      ...o,
                      kind: 'video' as const,
                      videoUrl: demoClip || o.videoUrl,
                      imageUrl: productImageUrl,
                      note: `AI video failed — ${failReason}. Playing demo format clip with your product as poster.`,
                    }
                  : o,
              )
            }
          }
          if (videoFailCount) {
            const videoMsg = `Some AI videos failed (${videoFailCount}); demo format clips play with your product as poster.`
            aiWarning = aiWarning ? `${aiWarning} ${videoMsg}` : videoMsg
          }
        } catch (err) {
          console.warn('[generate] video batch failed', err)
          const failReason =
            err instanceof Error ? err.message : 'AI videos unavailable'
          nextOutputs = nextOutputs.map((o) =>
            isVideoAssetKind(o.assetType)
              ? {
                  ...o,
                  kind: 'video' as const,
                  videoUrl: videoUrlForAsset(o.assetType) || o.videoUrl,
                  imageUrl: productImageUrl || o.imageUrl,
                  note: `AI video unavailable — ${failReason}. Demo format clip with your product as poster.`,
                }
              : o,
          )
          const videoMsg = `${failReason} — demo format clips kept.`
          aiWarning = aiWarning ? `${aiWarning} ${videoMsg}` : videoMsg
        }
      }

      const copyOutputs = nextOutputs.filter((o) => isCopyAssetKind(o.assetType))
      if (copyOutputs.length > 0) {
        setProgress(92)
        setActionMsg('Copy agent writing captions, hooks, and ads…')
        try {
          const kinds = [
            ...new Set(
              copyOutputs
                .map((o) => o.assetType)
                .filter((t): t is CopyAssetKind => isCopyAssetKind(t)),
            ),
          ]
          const ai = await requestGenerateCopy({
            productName: campaign.productName,
            creativeDirection: campaign.creativeDirection,
            assets: kinds,
          })
          for (const generated of ai.assets) {
            nextOutputs = nextOutputs.map((o) =>
              o.assetType === generated.type && o.kind === 'copy'
                ? {
                    ...o,
                    text: generated.text,
                    note: 'AI-generated by LUCE Copy Agent',
                  }
                : o,
            )
          }
          if (ai.partialErrors?.length) {
            const copyMsg = `Some copy pieces failed (${ai.partialErrors.length}); demo text kept for those.`
            aiWarning = aiWarning ? `${aiWarning} ${copyMsg}` : copyMsg
          }
        } catch (err) {
          console.warn('[generate] copy agent failed', err)
          const failReason =
            err instanceof Error ? err.message : 'Copy AI unavailable'
          const copyMsg = `${failReason} — demo captions kept.`
          aiWarning = aiWarning ? `${aiWarning} ${copyMsg}` : copyMsg
        }
      }

      if (
        imageOutputs.length === 0 &&
        videoOutputs.length === 0 &&
        copyOutputs.length === 0
      ) {
        setProgress(90)
        await new Promise((r) => setTimeout(r, 200))
      }

      // Apply results locally first so a Firestore sync error cannot wipe the pack.
      stashCampaignOutputs(campaignId, nextOutputs)
      setProgress(100)
      setCampaign((prev) =>
        prev ? { ...prev, status: 'ready', outputs: nextOutputs } : prev,
      )
      await persistStatus('ready', { outputs: nextOutputs })
      if (
        generateActionForCampaign() === 'photos' &&
        plan === 'free' &&
        (campaign.tryFree || !freeImageUsed)
      ) {
        try {
          await markFreeImageUsed()
        } catch (err) {
          console.warn('[generate] markFreeImageUsed failed', err)
        }
      }
      if (workspace.notifyExports) {
        void sendTransactionalEmail({
          type: 'pack_ready',
          productName: campaign.productName,
          campaignUrl: `${window.location.origin}/app/campaigns/${campaignId}`,
        }).catch((err) => console.warn('[generate] notify email failed', err))
      }
      const usedAiImages = nextOutputs.some(
        (o) =>
          isImageAssetKind(o.assetType) &&
          Boolean(o.imageUrl) &&
          o.note?.includes('AI-generated'),
      )
      const usedAiVideos = nextOutputs.some(
        (o) =>
          isVideoAssetKind(o.assetType) &&
          Boolean(o.videoUrl) &&
          o.note?.includes('AI-generated'),
      )
      const usedAiCopy = nextOutputs.some(
        (o) =>
          isCopyAssetKind(o.assetType) &&
          Boolean(o.text) &&
          o.note?.includes('AI-generated'),
      )
      const usedAnyAi = usedAiImages || usedAiVideos || usedAiCopy
      setActionMsg(
        usedAnyAi
          ? aiWarning
            ? `Pack ready with AI. ${aiWarning}`
            : [
                usedAiImages ? 'images' : null,
                usedAiVideos ? 'videos' : null,
                usedAiCopy ? 'captions & ads copy' : null,
              ]
                .filter(Boolean)
                .join(', ')
                .replace(/^/, 'Pack ready — AI ')
                .concat(' generated.')
          : aiWarning
            ? `Demo pack ready. ${aiWarning}`
            : 'Demo campaign pack ready — preview below.',
      )
      if (nextOutputs[0]) setPreviewId(nextOutputs[0].id)
    } catch (err) {
      console.error(err)
      const failMsg =
        err instanceof Error ? err.message : 'Could not generate pack.'
      // Prefer stashed product photo — local campaigns often omit imageUrl in meta.
      const fallbackPhoto =
        campaign.imageUrl ||
        (campaignId ? loadStashedCampaignImage(campaignId) : undefined) ||
        undefined

      if (!fallbackPhoto || fallbackPhoto.startsWith('/images/')) {
        setError(
          friendlyFirestoreError(
            err,
            `${failMsg} Upload your product photo on this page, then Generate again.`,
          ),
        )
        setCampaign((prev) =>
          prev
            ? {
                ...prev,
                status:
                  prev.status === 'generating'
                    ? 'product_confirmed'
                    : prev.status,
              }
            : prev,
        )
        setActionMsg(null)
      } else {
        try {
          const fallback = buildMockOutputs({
            productName: campaign.productName,
            productImageUrl: fallbackPhoto,
            selectedAssets: campaign.selectedAssets,
            studioKind: campaign.studioKind,
            mode: campaign.mode,
            videoDurations: campaign.videoDurations,
          })
          stashCampaignOutputs(campaignId, fallback)
          setCampaign((prev) =>
            prev
              ? {
                  ...prev,
                  status: 'ready',
                  imageUrl: fallbackPhoto,
                  outputs: fallback,
                }
              : prev,
          )
          if (fallback[0]) setPreviewId(fallback[0].id)
          setError(failMsg)
          setActionMsg(
            'Showing your product photo for each format. AI did not finish — use Recreate or Generate again.',
          )
          void persistStatus('ready', { outputs: fallback })
        } catch (fallbackErr) {
          console.error(fallbackErr)
          setError(
            friendlyFirestoreError(err, 'Could not generate pack. Try again.'),
          )
          setCampaign((prev) =>
            prev
              ? {
                  ...prev,
                  status:
                    prev.status === 'generating'
                      ? 'product_confirmed'
                      : prev.status,
                }
              : prev,
          )
        }
      }
    } finally {
      setActionBusy(false)
      setTimeout(() => setProgress(0), 600)
    }
  }

  // Studio / New campaign "Generate" lands here with autoGenerate — run once, no second click.
  useEffect(() => {
    if (!fromGenerateFlow || !campaign || fetching || actionBusy) return
    if (autoGenerateStartedRef.current) return
    const ready =
      campaign.status === 'product_confirmed' ||
      campaign.status === 'draft' ||
      campaign.status === 'product_pending'
    if (!ready) return
    const photo =
      (campaign.imageUrl && !campaign.imageUrl.startsWith('/images/')
        ? campaign.imageUrl
        : undefined) ||
      (campaignId ? loadStashedCampaignImage(campaignId) : undefined)
    if (!photo) return
    autoGenerateStartedRef.current = true
    setKickoffPending(false)
    void runMockGenerate()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot kickoff after create
  }, [fromGenerateFlow, campaign, fetching, actionBusy, campaignId])

  useEffect(() => {
    if (
      !campaign ||
      (campaign.status !== 'ready' && campaign.status !== 'exported')
    ) {
      return
    }
    if (!outputs.length) return
    const t = window.setTimeout(() => {
      resultsTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
    return () => window.clearTimeout(t)
  }, [campaign?.status, outputs.length])

  async function runExport() {
    if (!campaignId || !campaign || outputs.length === 0) return
    setActionBusy(true)
    setError(null)
    setActionMsg(null)
    try {
      await downloadMockPack(outputs, campaign.productName)
      await persistStatus('exported')
      setCampaign((prev) => (prev ? { ...prev, status: 'exported' } : prev))
      if (workspace.notifyExports) {
        void sendTransactionalEmail({
          type: 'pack_exported',
          productName: campaign.productName,
          campaignUrl: `${window.location.origin}/app/campaigns/${campaignId}`,
        })
      }
      setActionMsg('Pack ZIP downloaded to your device.')
    } catch (err) {
      console.error(err)
      setError(friendlyFirestoreError(err, 'Could not export pack.'))
    } finally {
      setActionBusy(false)
    }
  }

  async function runExportOne(item: MockOutput) {
    if (!campaign) return
    setError(null)
    setActionMsg(null)
    try {
      await downloadMockOutput(item, campaign.productName)
      setActionMsg(`Exported ${item.label}.`)
    } catch (err) {
      console.error(err)
      setError(friendlyFirestoreError(err, 'Could not export asset.'))
    }
  }

  async function runSaveOne(item: MockOutput) {
    if (!user || !campaignId || !campaign) return
    setSavingAsset(true)
    setError(null)
    setActionMsg(null)
    try {
      if (previewSaved) {
        await unsaveAsset(user.uid, campaignId, item.id)
        setPreviewSaved(false)
        setActionMsg(`Removed ${item.label} from Saved.`)
      } else {
        await saveAssetToLibrary({
          userId: user.uid,
          campaignId,
          productName: campaign.productName,
          output: item,
        })
        setPreviewSaved(true)
        setActionMsg(`Saved ${item.label}. Find it under Saved.`)
      }
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not update Saved.')
    } finally {
      setSavingAsset(false)
    }
  }

  async function runSaveAll() {
    if (!user || !campaignId || !campaign || outputs.length === 0) return
    setActionBusy(true)
    setError(null)
    setActionMsg(null)
    try {
      let n = 0
      for (const item of outputs) {
        if (!item.imageUrl && !item.videoUrl && !item.text) continue
        await saveAssetToLibrary({
          userId: user.uid,
          campaignId,
          productName: campaign.productName,
          output: item,
        })
        n += 1
      }
      if (previewId) setPreviewSaved(true)
      setActionMsg(
        n
          ? `Saved ${n} creative${n === 1 ? '' : 's'} to Saved.`
          : 'Nothing to save in this pack.',
      )
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not save pack.')
    } finally {
      setActionBusy(false)
    }
  }

  async function replaceProductPhoto(file: File | null | undefined) {
    if (!file || !campaign || !campaignId) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image (JPG, PNG, or WebP).')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('Image must be under 12MB.')
      return
    }
    setReplacingPhoto(true)
    setError(null)
    setActionMsg(null)
    try {
      const dataUrl = await stashCampaignImageSafe(
        campaignId,
        await fileToDataUrl(file),
      )
      const guess = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
      const nextName =
        campaign.productName && campaign.productName !== 'Untitled product'
          ? campaign.productName
          : guess || campaign.productName

      let nextOutputs = campaign.outputs
      if (nextOutputs && nextOutputs.length > 0) {
        nextOutputs = nextOutputs.map((item) =>
          item.assetType === 'photo_studio_packshot' ||
          item.assetType === 'product_image' ||
          item.assetType === 'ad_creative'
            ? {
                ...item,
                imageUrl: dataUrl,
                note: 'Updated with your new product photo',
                version: (item.version || 1) + 1,
                id: `${item.assetType}-updated-${Date.now()}`,
              }
            : item,
        )
      }

      if (isLocalCampaignId(campaignId)) {
        updateLocalCampaign(campaignId, {
          imageUrl: dataUrl,
          productName: nextName,
          ...(nextOutputs ? { outputs: nextOutputs } : {}),
        })
      } else if (
        nextOutputs &&
        (campaign.status === 'ready' ||
          campaign.status === 'exported' ||
          campaign.status === 'generating')
      ) {
        await persistStatus(
          campaign.status === 'exported' ? 'ready' : campaign.status,
          { outputs: nextOutputs },
        )
      }

      setCampaign((prev) =>
        prev
          ? {
              ...prev,
              imageUrl: dataUrl,
              productName: nextName,
              outputs: nextOutputs,
            }
          : prev,
      )
      setActionMsg('Product photo updated — banner and product shots use your new image.')
    } catch (err) {
      console.error(err)
      setError(friendlyFirestoreError(err, 'Could not update product photo.'))
    } finally {
      setReplacingPhoto(false)
      if (productFileRef.current) productFileRef.current.value = ''
    }
  }

  function openRecreateInStudio(item: MockOutput) {
    if (!campaign || !campaignId) return
    const studioKind = studioKindForAsset(item.assetType)
    saveRecreateSession({
      campaignId,
      assetId: item.id,
      assetType: item.assetType,
      label: item.label,
      kind: item.kind,
      productName: campaign.productName,
      productUrl: campaign.productUrl,
      imageUrl: campaign.imageUrl,
      studioKind,
      note: item.note,
      outputs,
      campaignStatus: campaign.status,
    })
    navigate(
      `/app/studio/${studioKind}?recreate=1&asset=${encodeURIComponent(item.assetType)}`,
    )
  }

  async function handleDeleteCampaign() {
    if (!user || !campaignId) return
    setDeleting(true)
    setError(null)
    setActionMsg(null)
    try {
      await deleteUserCampaign(user.uid, campaignId)
      navigate('/app/campaigns', { replace: true })
    } catch (err) {
      console.error(err)
      setError(friendlyFirestoreError(err, 'Could not delete campaign.'))
      setConfirmDelete(false)
      setDeleting(false)
    }
  }

  if (loading || fetching) {
    return (
      <div className="studio-shell studio-shell-alone">
        <p className="app-loading">Loading…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const packLabels = (() => {
    if (!campaign) return []
    if (campaign.mode === 'studio') {
      return campaign.selectedAssets.map(assetLabel)
    }
    if (campaign.deliverables.length > 0) {
      return CAMPAIGN_DELIVERABLES.filter((d) => campaign.deliverables.includes(d.id)).map(
        (d) => d.label,
      )
    }
    if (campaign.selectedAssets.length > 0) {
      return campaign.selectedAssets.map(assetLabel)
    }
    return []
  })()

  const step = campaign ? activeStep(campaign.status) : 0
  const createMorePath = campaign
    ? studioPathFor({ mode: campaign.mode, studioKind: campaign.studioKind })
    : '/app/studio/photos'
  // Local demos keep the photo in stash (meta omits huge data URLs)
  const productDisplayUrl = (() => {
    const fromCampaign =
      campaign?.imageUrl && !campaign.imageUrl.startsWith('/images/')
        ? campaign.imageUrl
        : undefined
    if (fromCampaign) return fromCampaign
    return campaignId ? loadStashedCampaignImage(campaignId) : undefined
  })()
  const hasProductPhoto = Boolean(productDisplayUrl)
  const readyToGenerate =
    campaign &&
    (campaign.status === 'product_confirmed' ||
      campaign.status === 'draft' ||
      campaign.status === 'product_pending')
  const showResults =
    campaign &&
    (campaign.status === 'ready' ||
      campaign.status === 'exported' ||
      (campaign.status === 'generating' && outputs.length > 0))
  const isGenerating = Boolean(
    campaign &&
      (campaign.status === 'generating' ||
        (kickoffPending && readyToGenerate) ||
        (fromGenerateFlow && actionBusy && readyToGenerate)),
  )
  const resultsFocus =
    fromGenerateFlow ||
    Boolean(
      campaign &&
        (campaign.status === 'generating' ||
          campaign.status === 'ready' ||
          campaign.status === 'exported'),
    )

  const resultsActions = campaign ? (
    <div className="results-toolbar-actions">
      {(campaign.status === 'ready' || campaign.status === 'exported') &&
      outputs.length > 0 ? (
        <>
          <button
            type="button"
            className="btn btn-grad"
            disabled={actionBusy}
            onClick={() => void runExport()}
          >
            {actionBusy ? 'Exporting…' : 'Export pack'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={actionBusy}
            onClick={() => void runSaveAll()}
          >
            Save all
          </button>
        </>
      ) : null}
      {(campaign.status === 'ready' || campaign.status === 'exported') &&
      hasProductPhoto ? (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={actionBusy}
          onClick={() => void runMockGenerate()}
        >
          {actionBusy ? 'Generating…' : 'Generate again'}
        </button>
      ) : null}
      {campaign.status === 'generating' && !actionBusy ? (
        <button
          type="button"
          className="btn btn-grad"
          disabled={actionBusy}
          onClick={() => void runMockGenerate()}
        >
          Resume
        </button>
      ) : null}
      <Link className="btn btn-ghost" to={createMorePath}>
        Create another
      </Link>
      <Link className="btn btn-ghost" to="/app/library">
        Saved
      </Link>
      {confirmDelete ? (
        <span className="campaign-delete-inline">
          <span className="dash-campaign-confirm-label">Delete this project?</span>
          <button
            type="button"
            className="settings-logout-btn"
            disabled={deleting || actionBusy}
            onClick={() => void handleDeleteCampaign()}
          >
            {deleting ? 'Deleting…' : 'Confirm delete'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={deleting}
            onClick={() => setConfirmDelete(false)}
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="btn btn-ghost campaign-delete-trigger"
          disabled={actionBusy || deleting}
          onClick={() => setConfirmDelete(true)}
        >
          Delete
        </button>
      )}
    </div>
  ) : null

  return (
    <AppLayout>
      <PaywallModal
        open={paywallOpen}
        title={
          generateActionForCampaign() === 'photos'
            ? 'Upgrade for more images'
            : generateActionForCampaign() === 'videos'
              ? 'Unlock video generation'
              : generateActionForCampaign() === 'ads'
                ? 'Unlock ads generation'
                : 'Unlock campaign generation'
        }
        reason={paywallReason}
        onClose={() => setPaywallOpen(false)}
      />
      <main
        className={`app-main campaign-create studio-page campaign-detail${resultsFocus ? ' campaign-results-focus' : ''}`}
      >
        {!campaign ? (
          <div className="dash-empty">
            <p className="auth-error">
              {loadError || 'Campaign not found.'}
            </p>
            <Link className="dash-create-btn dash-create-btn-sm" to="/app/campaigns">
              Back to campaigns
            </Link>
          </div>
        ) : resultsFocus ? (
          <>
            <header className="results-hero" ref={resultsTopRef}>
              <div className="results-hero-copy">
                <p className="results-hero-kicker">
                  {campaign.mode === 'studio' ? 'Studio results' : 'Campaign results'}
                  {campaign.tryFree ? ' · Free trial' : ''}
                </p>
                <h1 id="results-title">
                  {isGenerating
                    ? 'Creating your pack…'
                    : campaign.status === 'exported'
                      ? 'Pack exported'
                      : 'Your pack is ready'}
                </h1>
                <p className="results-hero-lead">
                  {isGenerating
                    ? actionMsg ||
                      (campaign.studioKind === 'videos'
                        ? 'Building AI videos from your product — stay on this page.'
                        : 'Building each format from your product photo — stay on this page.')
                    : (
                      <>
                        Review every asset for <strong>{campaign.productName}</strong>. Export
                        singles, save favorites, or recreate any look in studio.
                      </>
                    )}
                </p>
                <div className="results-hero-meta">
                  <span className={`dash-status status-${campaign.status}`}>
                    {statusLabel(campaign.status)}
                  </span>
                  {outputs.length > 0 ? (
                    <span className="results-hero-count">
                      {outputs.length} asset{outputs.length === 1 ? '' : 's'}
                    </span>
                  ) : packLabels.length > 0 ? (
                    <span className="results-hero-count">
                      {packLabels.length} format{packLabels.length === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="results-hero-product">
                {productDisplayUrl ? (
                  <img src={productDisplayUrl} alt={campaign.productName} />
                ) : (
                  <div className="results-hero-product-empty">Product</div>
                )}
                <span>Source product</span>
              </div>
            </header>

            {isGenerating ? (
              <section className="results-generating" aria-live="polite">
                <div className="results-generating-orb" aria-hidden="true" />
                <div className="results-generating-copy">
                  <h2>
                    {campaign.studioKind === 'videos'
                      ? 'Generating videos'
                      : campaign.studioKind === 'photos'
                        ? 'Generating images'
                        : 'Generating pack'}
                  </h2>
                  <p>{actionMsg || 'Preparing your formats…'}</p>
                  <div className="campaign-gen-progress">
                    <div className="campaign-gen-bar">
                      <span style={{ width: `${Math.max(progress, 8)}%` }} />
                    </div>
                    <p>
                      {progress < 100
                        ? `${Math.max(progress, 8)}% complete`
                        : 'Finishing…'}
                    </p>
                  </div>
                  {packLabels.length > 0 ? (
                    <ul className="results-generating-formats">
                      {packLabels.slice(0, 8).map((label) => (
                        <li key={label}>{label}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                {error ? (
                  <p className="auth-error" role="alert">
                    {error}
                  </p>
                ) : null}
                {campaign.status === 'generating' && !actionBusy ? (
                  <button
                    type="button"
                    className="btn btn-grad"
                    onClick={() => void runMockGenerate()}
                  >
                    Resume generate
                  </button>
                ) : null}
              </section>
            ) : null}

            {!isGenerating && error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}
            {!isGenerating && actionMsg ? (
              <p className="settings-success" role="status">
                {actionMsg}
              </p>
            ) : null}

            {!isGenerating ? (
              <div className="results-toolbar">{resultsActions}</div>
            ) : null}

            {showResults && outputs.length > 0 && !isGenerating ? (
              <section className="results-section results-section-stage" aria-labelledby="results-title">
                <div className="results-layout results-layout-stage">
                  <aside className="results-preview results-preview-stage">
                    {preview ? (
                      <>
                        <p className="results-preview-kicker">
                          {preview.label}
                          {(preview.version || 1) > 1 ? ` · v${preview.version}` : ''}
                        </p>
                        {preview.kind === 'video' && preview.videoUrl ? (
                          <div className="results-preview-media results-preview-video">
                            <video
                              key={preview.videoUrl}
                              src={preview.videoUrl}
                              poster={preview.imageUrl}
                              controls
                              autoPlay
                              loop
                              playsInline
                              preload="auto"
                            />
                          </div>
                        ) : preview.imageUrl ? (
                          <div className="results-preview-media">
                            <img src={preview.imageUrl} alt={preview.label} />
                          </div>
                        ) : null}
                        {preview.text ? (
                          <blockquote className="results-preview-copy">{preview.text}</blockquote>
                        ) : (
                          <p className="dash-muted">
                            {preview.kind === 'video'
                              ? preview.videoUrl
                                ? 'Playing your selected video format — recreate for another look.'
                                : 'Video still only — generate again for a playable clip.'
                              : 'Full preview — export, save, or recreate this look.'}
                          </p>
                        )}
                        <p className="results-preview-note">{preview.note}</p>
                        <div className="results-preview-actions">
                          <button
                            type="button"
                            className="btn btn-ghost results-preview-recreate"
                            disabled={actionBusy || savingAsset}
                            onClick={() => void runExportOne(preview)}
                          >
                            Export
                          </button>
                          <button
                            type="button"
                            className="btn btn-grad results-preview-recreate"
                            disabled={actionBusy || savingAsset}
                            onClick={() => void runSaveOne(preview)}
                          >
                            {savingAsset
                              ? 'Saving…'
                              : previewSaved
                                ? 'Unsave'
                                : 'Save'}
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost results-preview-recreate"
                            disabled={actionBusy}
                            onClick={() => openRecreateInStudio(preview)}
                          >
                            {preview.kind === 'copy'
                              ? 'Recreate copy'
                              : preview.kind === 'video'
                                ? 'Recreate video'
                                : 'Recreate image'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <p className="dash-muted">Select an asset to preview.</p>
                    )}
                  </aside>

                  <div className="results-grid results-grid-stage">
                    {outputs.map((item) => (
                      <div
                        key={item.id}
                        className={`results-card${previewId === item.id ? ' is-active' : ''}`}
                      >
                        <button
                          type="button"
                          className="results-card-hit"
                          onClick={() => setPreviewId(item.id)}
                        >
                          <span className="results-card-media">
                            {item.kind === 'video' && item.videoUrl ? (
                              <video
                                src={item.videoUrl}
                                poster={item.imageUrl}
                                muted
                                loop
                                playsInline
                                autoPlay={previewId === item.id}
                                preload={previewId === item.id ? 'auto' : 'metadata'}
                              />
                            ) : item.imageUrl ? (
                              <img src={item.imageUrl} alt="" />
                            ) : (
                              <span className="results-card-fallback">
                                {item.label.slice(0, 1)}
                              </span>
                            )}
                            {item.kind === 'video' ? (
                              <span className="results-card-play" aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </span>
                            ) : null}
                            {item.kind === 'video' ? (
                              <span className="results-card-badge">Video</span>
                            ) : null}
                            {item.kind === 'copy' ? (
                              <span className="results-card-badge">Copy</span>
                            ) : null}
                            {(item.version || 1) > 1 ? (
                              <span className="results-card-badge results-card-badge-version">
                                v{item.version}
                              </span>
                            ) : null}
                          </span>
                          <span className="results-card-body">
                            <strong>{item.label}</strong>
                            <span>{item.note}</span>
                          </span>
                        </button>
                        <div className="results-card-actions">
                          <button
                            type="button"
                            className="results-recreate-btn"
                            disabled={actionBusy}
                            onClick={(e) => {
                              e.stopPropagation()
                              void runExportOne(item)
                            }}
                          >
                            Export
                          </button>
                          <button
                            type="button"
                            className="results-recreate-btn"
                            disabled={actionBusy}
                            onClick={(e) => {
                              e.stopPropagation()
                              openRecreateInStudio(item)
                            }}
                          >
                            Recreate
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {!isGenerating &&
            outputs.length === 0 &&
            (campaign.status === 'ready' ||
              campaign.status === 'exported' ||
              Boolean(readyToGenerate)) ? (
              <div className="results-empty-pack">
                <p>
                  {error
                    ? 'Generation didn’t finish. Try again when you’re ready.'
                    : 'No assets in this pack yet.'}
                </p>
                <button
                  type="button"
                  className="btn btn-grad"
                  disabled={actionBusy || !hasProductPhoto}
                  onClick={() => void runMockGenerate()}
                >
                  {readyToGenerate ? 'Generate pack' : 'Build pack'}
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <header
              className={`create-banner tone-${campaign.mode === 'studio' ? campaign.studioKind || 'campaign' : 'campaign'}`}
            >
              <div className="create-banner-copy">
                <p className="dash-kicker">
                  {campaign.mode === 'studio' ? 'Studio project' : 'Campaign'}
                  {campaign.tryFree ? ' · Free trial' : ''}
                  {' · '}Demo preview
                </p>
                <div className="dash-card-top" style={{ marginBottom: 8 }}>
                  <span className={`dash-status status-${campaign.status}`}>
                    {statusLabel(campaign.status)}
                  </span>
                </div>
                <h1>{campaign.title}</h1>
                <p className="app-lead">{campaign.productName}</p>
              </div>
              <div className="create-banner-media">
                {productDisplayUrl ? (
                  <img src={productDisplayUrl} alt={campaign.productName} />
                ) : (
                  <div className="create-banner-placeholder">
                    <span>Add your product photo</span>
                  </div>
                )}
                {productDisplayUrl ? (
                  <span className="create-banner-product-tag">Your product</span>
                ) : null}
              </div>
            </header>

            <ol className="campaign-progress" aria-label="Project progress">
              {STEPS.map((s, i) => (
                <li
                  key={s.id}
                  className={
                    i < step ? 'is-done' : i === step ? 'is-current' : undefined
                  }
                >
                  <span className="campaign-progress-index">{i + 1}</span>
                  <span>{s.label}</span>
                </li>
              ))}
            </ol>

            <section className="app-panel create-panel product-source-panel" aria-labelledby="product-source-title">
              <div className="product-source-head">
                <div>
                  <h2 id="product-source-title">Product</h2>
                  <p className="product-source-sub">
                    This is the photo used on your banner and for product fidelity in the pack.
                  </p>
                </div>
                <input
                  ref={productFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={(e) => void replaceProductPhoto(e.target.files?.[0])}
                />
                <button
                  type="button"
                  className="btn btn-ghost product-source-replace"
                  disabled={replacingPhoto || actionBusy}
                  onClick={() => productFileRef.current?.click()}
                >
                  {replacingPhoto
                    ? 'Updating…'
                    : productDisplayUrl
                      ? 'Replace photo'
                      : 'Upload photo'}
                </button>
              </div>

              <div className="product-source-body">
                <div className="product-source-media">
                  {productDisplayUrl ? (
                    <img src={productDisplayUrl} alt={campaign.productName} />
                  ) : (
                    <button
                      type="button"
                      className="product-source-empty"
                      onClick={() => productFileRef.current?.click()}
                      disabled={replacingPhoto}
                    >
                      <strong>Add your product photo</strong>
                      <span>JPG, PNG, or WebP</span>
                    </button>
                  )}
                  {productDisplayUrl ? (
                    <span className="product-source-badge">Uploaded photo</span>
                  ) : null}
                </div>
                <div className="product-source-meta">
                  <p className="product-source-name">{campaign.productName}</p>
                  {campaign.productUrl ? (
                    <p>
                      <a href={campaign.productUrl} target="_blank" rel="noreferrer">
                        View product page
                      </a>
                    </p>
                  ) : (
                    <p className="dash-muted">Source: your uploaded product photo</p>
                  )}
                  <p className="product-source-hint">
                    Change this photo anytime — the review banner updates immediately.
                  </p>
                </div>
              </div>
            </section>

            <div className="campaign-detail-grid">
              <div className="app-panel create-panel">
                <h2>Included</h2>
                {packLabels.length > 0 ? (
                  <ul className="detail-pack-list">
                    {packLabels.map((label) => (
                      <li key={label}>{label}</li>
                    ))}
                    {campaign.mode === 'campaign' &&
                      campaign.includeStrategy &&
                      !campaign.deliverables.includes('strategy') && <li>Strategy & research</li>}
                  </ul>
                ) : (
                  <p>Full default pack</p>
                )}
              </div>
              <div className="app-panel create-panel product-source-note">
                <h2>How it’s used</h2>
                <ul className="detail-pack-list">
                  <li>Hero banner on this page</li>
                  <li>Product / studio shots in results</li>
                  <li>Reference when you recreate assets</li>
                </ul>
              </div>
            </div>

            <div className="app-panel create-panel campaign-next-panel">
              <h2>
                {readyToGenerate
                  ? campaign.studioKind === 'videos'
                    ? 'Generate videos'
                    : campaign.studioKind === 'photos'
                      ? 'Generate images'
                      : 'Generate pack'
                  : 'Next'}
              </h2>
              <p>
                {readyToGenerate
                  ? !hasProductPhoto
                    ? 'Upload your product photo above first — AI formats need it as the source of truth.'
                    : 'Generates your pack from your product photo into each format you picked.'
                  : 'Open studio to create another pack.'}
              </p>

              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="detail-actions">
                {readyToGenerate ? (
                  <button
                    type="button"
                    className="btn btn-grad"
                    disabled={actionBusy || !hasProductPhoto}
                    onClick={() => void runMockGenerate()}
                  >
                    {actionBusy
                      ? 'Generating…'
                      : !hasProductPhoto
                        ? 'Upload photo first'
                        : campaign.studioKind === 'videos'
                          ? 'Generate videos'
                          : campaign.studioKind === 'photos'
                            ? 'Generate images'
                            : 'Generate pack'}
                    <span aria-hidden="true">→</span>
                  </button>
                ) : null}
                <Link className="btn btn-ghost" to={createMorePath}>
                  Create another
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </AppLayout>
  )
}
