const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images'
const OPENROUTER_VIDEOS_URL = 'https://openrouter.ai/api/v1/videos'
/** Stronger product-ref fidelity than flash; OpenRouter image→image. */
const DEFAULT_MODEL = 'google/gemini-3-pro-image'
const DEFAULT_VIDEO_MODEL = 'heygen/heygen-video-1'
const REQUEST_TIMEOUT_MS = 120_000
const VIDEO_POLL_MS = 12_000
const VIDEO_POLL_MAX = 60

export type GenerateImageInput = {
  prompt: string
  /** Product photo as data URL or public HTTPS URL */
  inputReferences?: string[]
  model?: string
}

export type GenerateImageResult = {
  imageDataUrl: string
  model: string
}

export function getOpenRouterApiKey(): string | undefined {
  const key = process.env.OPENROUTER_API_KEY?.trim()
  return key || undefined
}

export function getOpenRouterImageModel(): string {
  return (
    process.env.OPENROUTER_IMAGE_MODEL?.trim() || DEFAULT_MODEL
  )
}

export function getOpenRouterVideoModel(): string {
  return (
    process.env.OPENROUTER_VIDEO_MODEL?.trim() || DEFAULT_VIDEO_MODEL
  )
}

function openRouterHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer':
      process.env.OPENROUTER_HTTP_REFERER ||
      process.env.APP_URL ||
      'https://luce-landing.vercel.app',
    'X-Title': process.env.OPENROUTER_APP_TITLE || 'LUCE',
  }
}

function parseOpenRouterError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const err = body as {
      error?: { message?: string; code?: string | number } | string
      message?: string
    }
    if (typeof err.error === 'string' && err.error.trim()) return err.error.trim()
    if (
      err.error &&
      typeof err.error === 'object' &&
      typeof err.error.message === 'string' &&
      err.error.message.trim()
    ) {
      return err.error.message.trim()
    }
    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message.trim()
    }
  }
  return `OpenRouter image request failed (${status})`
}

function toDataUrl(b64: string, mediaType?: string): string {
  const mime =
    mediaType && mediaType.startsWith('image/')
      ? mediaType
      : 'image/png'
  const cleaned = b64.replace(/\s/g, '')
  if (cleaned.startsWith('data:')) return cleaned
  return `data:${mime};base64,${cleaned}`
}

function normalizeReferences(refs: string[]): unknown[] {
  return refs
    .map((r) => r.trim())
    .filter(Boolean)
    .map((url) => ({
      type: 'image_url',
      image_url: { url },
    }))
}

/**
 * Call OpenRouter image generation. Throws on missing key, HTTP errors, or empty payload.
 */
export async function generateImage(
  input: GenerateImageInput,
): Promise<GenerateImageResult> {
  const apiKey = getOpenRouterApiKey()
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const prompt = input.prompt.trim()
  if (!prompt) {
    throw new Error('Image prompt is required')
  }

  const model = (input.model || getOpenRouterImageModel()).trim() || DEFAULT_MODEL
  const refs = (input.inputReferences || []).filter(Boolean)

  const body: Record<string, unknown> = {
    model,
    prompt,
    output_format: 'png',
  }
  if (refs.length > 0) {
    body.input_references = normalizeReferences(refs)
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(OPENROUTER_IMAGES_URL, {
      method: 'POST',
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('OpenRouter image request timed out')
    }
    throw err instanceof Error
      ? err
      : new Error('OpenRouter image request failed')
  } finally {
    clearTimeout(timer)
  }

  const json = (await res.json().catch(() => null)) as unknown

  if (!res.ok) {
    throw new Error(parseOpenRouterError(json, res.status))
  }

  const data = (json as { data?: Array<{ b64_json?: string; url?: string; media_type?: string }> })
    ?.data
  const first = Array.isArray(data) ? data[0] : undefined
  if (!first) {
    throw new Error('OpenRouter returned no image data')
  }

  if (typeof first.b64_json === 'string' && first.b64_json.trim()) {
    return {
      imageDataUrl: toDataUrl(first.b64_json, first.media_type),
      model,
    }
  }

  if (typeof first.url === 'string' && first.url.trim()) {
    const url = first.url.trim()
    if (url.startsWith('data:')) {
      return { imageDataUrl: url, model }
    }
    // Fetch remote URL and convert to data URL for durable UI storage
    const imgRes = await fetch(url)
    if (!imgRes.ok) {
      throw new Error(`Could not download generated image (${imgRes.status})`)
    }
    const buf = Buffer.from(await imgRes.arrayBuffer())
    const mime = imgRes.headers.get('content-type') || 'image/png'
    return {
      imageDataUrl: `data:${mime};base64,${buf.toString('base64')}`,
      model,
    }
  }

  throw new Error('OpenRouter returned no b64_json or url')
}

export type GenerateVideoInput = {
  prompt: string
  model?: string
  duration?: number
  aspectRatio?: string
  resolution?: string
  /** Product / first-frame stills (data URL or https) */
  frameImages?: { url: string; frameType?: 'first_frame' | 'last_frame' }[]
  /** Style reference images */
  inputReferences?: string[]
  generateAudio?: boolean
}

export type GenerateVideoResult = {
  videoDataUrl: string
  model: string
  jobId: string
}

function parseVideoError(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const err = body as {
      error?: { message?: string } | string
      message?: string
    }
    if (typeof err.error === 'string' && err.error.trim()) return err.error.trim()
    if (
      err.error &&
      typeof err.error === 'object' &&
      typeof err.error.message === 'string' &&
      err.error.message.trim()
    ) {
      return err.error.message.trim()
    }
    if (typeof err.message === 'string' && err.message.trim()) return err.message.trim()
  }
  return `OpenRouter video request failed (${status})`
}

/**
 * Submit + poll OpenRouter video generation, return an MP4 data URL.
 */
export async function generateVideo(
  input: GenerateVideoInput,
): Promise<GenerateVideoResult> {
  const apiKey = getOpenRouterApiKey()
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }

  const prompt = input.prompt.trim()
  if (!prompt) throw new Error('Video prompt is required')

  const model =
    (input.model || getOpenRouterVideoModel()).trim() || DEFAULT_VIDEO_MODEL
  const headers = openRouterHeaders(apiKey)

  const body: Record<string, unknown> = {
    model,
    prompt,
    duration: input.duration ?? 5,
    aspect_ratio: input.aspectRatio ?? '9:16',
    resolution: input.resolution ?? '768p',
    generate_audio: input.generateAudio !== false,
  }

  const frames = (input.frameImages || []).filter((f) => f.url?.trim())
  if (frames.length > 0) {
    body.frame_images = frames.map((f) => ({
      type: 'image_url',
      image_url: { url: f.url.trim() },
      frame_type: f.frameType || 'first_frame',
    }))
  }

  const refs = (input.inputReferences || []).map((r) => r.trim()).filter(Boolean)
  if (refs.length > 0 && frames.length === 0) {
    body.input_references = refs.map((url) => ({
      type: 'image_url',
      image_url: { url },
    }))
  }

  const submitRes = await fetch(OPENROUTER_VIDEOS_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const submitJson = (await submitRes.json().catch(() => null)) as {
    id?: string
    polling_url?: string
    status?: string
    error?: unknown
  } | null

  if (!submitRes.ok || !submitJson?.id) {
    throw new Error(parseVideoError(submitJson, submitRes.status))
  }

  const jobId = submitJson.id
  const pollUrl =
    submitJson.polling_url || `${OPENROUTER_VIDEOS_URL}/${jobId}`

  let completed: {
    status?: string
    unsigned_urls?: string[]
    error?: string
  } | null = null

  for (let i = 0; i < VIDEO_POLL_MAX; i++) {
    await new Promise((r) => setTimeout(r, VIDEO_POLL_MS))
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const pollJson = (await pollRes.json().catch(() => null)) as {
      status?: string
      unsigned_urls?: string[]
      error?: string
    } | null
    const status = pollJson?.status || ''
    if (status === 'completed') {
      completed = pollJson
      break
    }
    if (
      status === 'failed' ||
      status === 'cancelled' ||
      status === 'expired'
    ) {
      throw new Error(
        pollJson?.error || `Video generation ${status || 'failed'}`,
      )
    }
  }

  if (!completed) {
    throw new Error('Video generation timed out while waiting for OpenRouter')
  }

  const contentUrl =
    completed.unsigned_urls?.[0] ||
    `${OPENROUTER_VIDEOS_URL}/${jobId}/content?index=0`

  const videoRes = await fetch(contentUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!videoRes.ok) {
    throw new Error(`Could not download generated video (${videoRes.status})`)
  }

  const buf = Buffer.from(await videoRes.arrayBuffer())
  const mime = videoRes.headers.get('content-type') || 'video/mp4'
  return {
    videoDataUrl: `data:${mime};base64,${buf.toString('base64')}`,
    model,
    jobId,
  }
}
