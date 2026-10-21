import { requireAuth } from './firebase'
import type { CreativeDirection } from './creativeDirection'
import type { VideoStyleId } from './deliverables'
import { VIDEO_STYLES } from './deliverables'

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
  videoDataUrl: string
  promptUsed?: string
}

export type GenerateVideosResponse = {
  ok: true
  assets: GeneratedVideoAsset[]
  partialErrors?: { type: VideoAssetKind; error: string }[]
}

/**
 * Authenticated POST to /api/generate-videos (OpenRouter async video).
 * Prefer calling with 1 asset at a time so the UI can show progress.
 */
export async function requestGenerateVideos(
  input: GenerateVideosRequest,
): Promise<GenerateVideosResponse> {
  const user = requireAuth().currentUser
  if (!user) {
    throw new Error('Sign in required to generate videos.')
  }

  const token = await user.getIdToken()
  const res = await fetch('/api/generate-videos', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      productName: input.productName,
      productImage: input.productImage,
      referenceFrameImage: input.referenceFrameImage,
      creativeDirection: input.creativeDirection,
      assets: input.assets,
      recreateNote: input.recreateNote,
      durationSeconds: input.durationSeconds,
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    assets?: GeneratedVideoAsset[]
    partialErrors?: { type: VideoAssetKind; error: string }[]
  }

  if (!res.ok || !data.ok || !Array.isArray(data.assets)) {
    if (res.status === 503) {
      throw new Error(
        data.error ||
          'Video AI is not configured. Set HEYGEN_API_KEY and/or OPENROUTER_API_KEY.',
      )
    }
    throw new Error(data.error || `Video generation failed (${res.status})`)
  }

  return {
    ok: true,
    assets: data.assets,
    ...(data.partialErrors?.length ? { partialErrors: data.partialErrors } : {}),
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
