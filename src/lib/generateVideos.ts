import { requireIdToken } from './firebase'
import type { CreativeDirection } from './creativeDirection'
import type { VideoStyleId } from './deliverables'
import { VIDEO_STYLES } from './deliverables'
import { compressImageDataUrl } from './localDemoCampaign'

export type VideoAssetKind = VideoStyleId

export const VIDEO_ASSET_KINDS: VideoAssetKind[] = VIDEO_STYLES.map((s) => s.id)

export function isVideoAssetKind(value: string): value is VideoAssetKind {
  return (VIDEO_ASSET_KINDS as string[]).includes(value) || value.startsWith('video_')
}

export type GenerateVideosRequest = {
  productName: string
  productImage?: string
  /** Still frame from the user's reference video (preferred over sending the whole MP4) */
  referenceFrameImage?: string
  creativeDirection?: CreativeDirection
  assets: VideoAssetKind[]
  recreateNote?: string
  /** Clip length in seconds (5–15, HeyGen limit) */
  durationSeconds?: number
}

export type GeneratedVideoAsset = {
  type: VideoAssetKind
  label: string
  /** Playable HTTPS or data URL from the video model */
  videoUrl?: string
  /** Legacy alias — same as videoUrl when present */
  videoDataUrl?: string
  promptUsed?: string
}

/** Prefer HTTPS playable URL; fall back to data URL. */
export function playableVideoUrl(
  asset: GeneratedVideoAsset | undefined,
): string | undefined {
  if (!asset) return undefined
  const url = (asset.videoUrl || asset.videoDataUrl || '').trim()
  return url || undefined
}

export type GenerateVideosResponse = {
  ok: true
  assets: GeneratedVideoAsset[]
  partialErrors?: { type: VideoAssetKind; error: string }[]
}

const VIDEO_POLL_INTERVAL_MS = 6_000
const VIDEO_POLL_TIMEOUT_MS = 12 * 60_000

type VideoApiBody = {
  ok?: boolean
  error?: string
  needsPaywall?: boolean
  sync?: boolean
  pending?: boolean
  jobId?: string
  type?: VideoAssetKind
  label?: string
  promptUsed?: string
  assets?: GeneratedVideoAsset[]
  partialErrors?: { type: VideoAssetKind; error: string }[]
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function pollVideoJobUntilDone(jobId: string, token: string): Promise<string> {
  const deadline = Date.now() + VIDEO_POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    await sleep(VIDEO_POLL_INTERVAL_MS)
    const res = await fetch(`/api/video-status?jobId=${encodeURIComponent(jobId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = (await res.json().catch(() => ({}))) as {
      status?: string
      videoUrl?: string
      error?: string
    }
    if (res.status === 429) continue
    if (!res.ok) throw new Error(data.error || `Video status check failed (${res.status})`)
    if (data.status === 'completed' && data.videoUrl) return data.videoUrl
    if (data.status === 'failed') throw new Error(data.error || 'Video generation failed')
  }
  throw new Error('Video generation timed out. Try again.')
}

async function postGenerateVideos(
  token: string,
  payload: Record<string, unknown>,
): Promise<{ res: Response; data: VideoApiBody }> {
  const res = await fetch('/api/generate-videos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  })
  const data = (await res.json().catch(() => ({}))) as VideoApiBody
  return { res, data }
}

/**
 * Authenticated video generation. Each format is started as an async job
 * (/api/generate-videos with async:true) and polled via /api/video-status, so no
 * request has to survive the serverless time limit. Falls back to the old
 * synchronous call when the server uses direct HeyGen.
 */
export async function requestGenerateVideos(
  input: GenerateVideosRequest,
): Promise<GenerateVideosResponse> {
  const token = await requireIdToken()
  const productImage = input.productImage?.startsWith('data:image/')
    ? await compressImageDataUrl(input.productImage, 1024, 0.8)
    : input.productImage
  const referenceFrameImage = input.referenceFrameImage?.startsWith(
    'data:image/',
  )
    ? await compressImageDataUrl(input.referenceFrameImage, 1024, 0.8)
    : input.referenceFrameImage

  const base = {
    productName: input.productName,
    productImage,
    referenceFrameImage,
    creativeDirection: input.creativeDirection,
    recreateNote: input.recreateNote,
    durationSeconds: input.durationSeconds,
  }

  const assets: GeneratedVideoAsset[] = []
  const partialErrors: { type: VideoAssetKind; error: string }[] = []
  let lastError: Error | null = null

  for (let i = 0; i < input.assets.length; i++) {
    const type = input.assets[i]!
    const { res, data } = await postGenerateVideos(token, {
      ...base,
      assets: [type],
      async: true,
    })

    if (res.status === 409 && data.sync) {
      // Direct HeyGen: no resumable job — use the synchronous route for the rest.
      const sync = await postGenerateVideos(token, {
        ...base,
        assets: input.assets.slice(i),
      })
      if (!sync.res.ok || !sync.data.ok || !Array.isArray(sync.data.assets)) {
        throw new Error(
          sync.data.error || `Video generation failed (${sync.res.status})`,
        )
      }
      assets.push(...sync.data.assets)
      if (sync.data.partialErrors?.length) partialErrors.push(...sync.data.partialErrors)
      break
    }

    // Server answered synchronously (e.g. the Vite dev middleware ignores `async`).
    if (res.ok && data.ok && !data.pending && Array.isArray(data.assets)) {
      assets.push(...data.assets)
      if (data.partialErrors?.length) partialErrors.push(...data.partialErrors)
      continue
    }

    if (!res.ok || !data.ok || !data.pending || !data.jobId) {
      const message =
        res.status === 503
          ? data.error ||
            'Video AI is not configured. Set HEYGEN_API_KEY and/or OPENROUTER_API_KEY.'
          : data.error || `Video generation failed (${res.status})`
      // Auth / plan / quota / config errors apply to every format — stop now.
      if ([401, 402, 429, 503].includes(res.status)) throw new Error(message)
      lastError = new Error(message)
      partialErrors.push({ type, error: message })
      continue
    }

    try {
      const videoUrl = await pollVideoJobUntilDone(data.jobId, token)
      assets.push({
        type,
        label: data.label || String(type),
        videoUrl,
        videoDataUrl: videoUrl,
        promptUsed: data.promptUsed,
      })
    } catch (err) {
      lastError = err instanceof Error ? err : new Error('Video generation failed')
      partialErrors.push({ type, error: lastError.message })
    }
  }

  if (assets.length === 0) {
    throw lastError ?? new Error('Video generation failed')
  }
  return {
    ok: true,
    assets,
    ...(partialErrors.length ? { partialErrors } : {}),
  }
}

/** Grab a JPEG still from a video blob/data URL for OpenRouter frame_images. */
export async function extractVideoFrameDataUrl(
  videoSrc: string,
  atSeconds = 0.8,
): Promise<string | undefined> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'

    const cleanup = () => {
      video.removeAttribute('src')
      video.load()
    }

    const fail = () => {
      cleanup()
      resolve(undefined)
    }

    video.onerror = fail
    video.onloadeddata = () => {
      try {
        const t = Math.min(
          Math.max(0.1, atSeconds),
          Math.max(0.1, (video.duration || 1) * 0.35),
        )
        video.currentTime = t
      } catch {
        fail()
      }
    }
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        const w = video.videoWidth || 720
        const h = video.videoHeight || 1280
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          fail()
          return
        }
        ctx.drawImage(video, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.86)
        cleanup()
        resolve(dataUrl)
      } catch {
        fail()
      }
    }

    video.src = videoSrc
  })
}
