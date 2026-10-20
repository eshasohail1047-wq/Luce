/** HeyGen Video API — https://api.heygen.com/v3/models/videos */

const HEYGEN_VIDEOS_URL = 'https://api.heygen.com/v3/models/videos'
const DEFAULT_MODEL = 'heygen-video-1'
const POLL_MS = 12_000
const POLL_MAX = 60

export type HeyGenGenerateInput = {
  prompt: string
  /** First-frame / product still (data URL or HTTPS) */
  imageUrl?: string
  /** Extra reference stills */
  referenceImages?: string[]
  duration?: number
  aspectRatio?: '9:16' | '16:9' | '1:1' | '3:4' | '4:3'
  resolution?: '480p' | '768p' | '1080p' | '2k'
}

export type HeyGenGenerateResult = {
  videoDataUrl: string
  model: string
  provider: 'heygen'
  jobId: string
}

export function getHeyGenApiKey(): string | undefined {
  return process.env.HEYGEN_API_KEY?.trim() || undefined
}

type HeyGenAsset =
  | { type: 'url'; url: string }
  | { type: 'base64'; media_type: string; data: string }

function toAsset(src: string): HeyGenAsset {
  const trimmed = src.trim()
  if (trimmed.startsWith('data:')) {
    const match = /^data:([^;]+);base64,(.+)$/s.exec(trimmed)
    if (!match) throw new Error('Invalid data URL for HeyGen asset')
    return {
      type: 'base64',
      media_type: match[1] || 'image/jpeg',
      data: match[2]!.replace(/\s/g, ''),
    }
  }
  return { type: 'url', url: trimmed }
}

function parseError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const root = body as {
      error?: { message?: string; code?: string } | string
      message?: string
    }
    if (typeof root.error === 'string' && root.error.trim()) return root.error.trim()
    if (
      root.error &&
      typeof root.error === 'object' &&
      typeof root.error.message === 'string' &&
      root.error.message.trim()
    ) {
      return root.error.message.trim()
    }
    if (typeof root.message === 'string' && root.message.trim()) {
      return root.message.trim()
    }
  }
  return `HeyGen video request failed (${status})`
}

/**
 * Submit + poll HeyGen heygen-video-1, return an MP4 data URL.
 * Prefers image_to_video when a first frame is present; otherwise text_to_video.
 * Extra stills use reference_to_video.
 */
export async function generateHeyGenVideo(
  input: HeyGenGenerateInput,
): Promise<HeyGenGenerateResult> {
  const apiKey = getHeyGenApiKey()
  if (!apiKey) {
    throw new Error('HEYGEN_API_KEY is not configured')
  }

  const prompt = input.prompt.trim()
  if (!prompt) throw new Error('Video prompt is required')

  const model = DEFAULT_MODEL
  const duration = input.duration ?? 5
  const resolution = input.resolution ?? '768p'
  const aspectRatio = input.aspectRatio ?? '9:16'

  const primary = input.imageUrl?.trim()
  const extraRefs = (input.referenceImages || [])
    .map((r) => r.trim())
    .filter((r) => r && r !== primary)

  let body: Record<string, unknown>

  if (primary && extraRefs.length > 0) {
    body = {
      model,
      prompt,
      mode: 'reference_to_video',
      prompt_enhancement: 'quality',
      duration,
      resolution,
      aspect_ratio: aspectRatio,
      reference_images: [primary, ...extraRefs].slice(0, 9).map(toAsset),
    }
  } else if (primary) {
    body = {
      model,
      prompt,
      mode: 'image_to_video',
      prompt_enhancement: 'quality',
      duration,
      resolution,
      image: toAsset(primary),
    }
  } else {
    body = {
      model,
      prompt,
      mode: 'text_to_video',
      prompt_enhancement: 'quality',
      duration,
      resolution,
      aspect_ratio: aspectRatio,
    }
  }

  const headers = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  }

  const submitRes = await fetch(HEYGEN_VIDEOS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const submitJson = (await submitRes.json().catch(() => null)) as {
    data?: { video_id?: string; status?: string }
    video_id?: string
    error?: unknown
  } | null

  const videoId = submitJson?.data?.video_id || submitJson?.video_id
  if (!submitRes.ok || !videoId) {
    throw new Error(parseError(submitJson, submitRes.status))
  }

  let videoUrl: string | undefined

  for (let i = 0; i < POLL_MAX; i++) {
    await new Promise((r) => setTimeout(r, POLL_MS))
    const pollRes = await fetch(`${HEYGEN_VIDEOS_URL}/${videoId}`, {
      headers: { 'x-api-key': apiKey },
    })
    const pollJson = (await pollRes.json().catch(() => null)) as {
      data?: {
        status?: string
        video_url?: string
        failure_message?: string
        failure_code?: string
      }
      status?: string
      video_url?: string
      error?: unknown
    } | null

    const data = pollJson?.data || pollJson
    const status = (data && 'status' in data ? data.status : '') || ''

    if (status === 'completed') {
      videoUrl =
        (data && 'video_url' in data ? data.video_url : undefined) || undefined
      break
    }
    if (status === 'failed' || status === 'cancelled') {
      const msg =
        (data && 'failure_message' in data && data.failure_message) ||
        `HeyGen video ${status}`
      throw new Error(String(msg))
    }
  }

  if (!videoUrl) {
    throw new Error('HeyGen video generation timed out while waiting')
  }

  const videoRes = await fetch(videoUrl)
  if (!videoRes.ok) {
    throw new Error(`Could not download HeyGen video (${videoRes.status})`)
  }

  const buf = Buffer.from(await videoRes.arrayBuffer())
  const mime = videoRes.headers.get('content-type') || 'video/mp4'
  return {
    videoDataUrl: `data:${mime};base64,${buf.toString('base64')}`,
    model,
    provider: 'heygen',
    jobId: videoId,
  }
}
