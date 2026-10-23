const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images'
const OPENROUTER_VIDEOS_URL = 'https://openrouter.ai/api/v1/videos'
const OPENROUTER_CHAT_URL = 'https://openrouter.ai/api/v1/chat/completions'
/** Nano Banana = Gemini 2.5 Flash Image — ~$0.03–0.04/image; strong product/ref edits. */
const DEFAULT_MODEL = 'google/gemini-2.5-flash-image'
const DEFAULT_VIDEO_MODEL = 'heygen/heygen-video-1'
/**
 * Free OpenRouter text for captions / hooks / CTAs / hashtags / ad copy.
 * `openrouter/free` auto-picks a free :free model; override with OPENROUTER_CHAT_MODEL
 * (e.g. google/gemma-4-31b-it:free, meta-llama/llama-3.2-3b-instruct:free).
 */
const DEFAULT_CHAT_MODEL = 'openrouter/free'
/** Free-only fallbacks if the primary free model is rate-limited / unavailable. */
const FREE_CHAT_FALLBACKS = [
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'nvidia/nemotron-3.5-lightning:free',
] as const
const REQUEST_TIMEOUT_MS = 120_000
const VIDEO_POLL_FIRST_MS = 5_000
const VIDEO_POLL_MS = 8_000
const VIDEO_POLL_MAX = 50
/** heygen/heygen-video-1 supported durations (see OpenRouter /videos/models). */
const HEYGEN_DURATIONS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] as const

export type GenerateImageInput = {
  prompt: string
  /** Product photo as data URL or public HTTPS URL */
  inputReferences?: string[]
  model?: string
  /** Explicit aspect ratio for the image model (LUCE format hard requirement) */
  aspectRatio?: string
  /** Optional resolution tier when the model supports it (e.g. FLUX). */
  resolution?: string
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

export function getOpenRouterChatModel(): string {
  const configured = process.env.OPENROUTER_CHAT_MODEL?.trim()
  if (!configured) return DEFAULT_CHAT_MODEL
  // Prefer free tier for copy — if someone sets a paid id without :free, keep it
  // but default path stays on openrouter/free.
  return configured
}

function chatModelsPreferFree(primary: string): string[] {
  const first = primary.trim() || DEFAULT_CHAT_MODEL
  const extras = FREE_CHAT_FALLBACKS.filter((id) => id !== first)
  // Only free models so OpenRouter never bills a paid hop.
  // OpenRouter allows at most 3 entries in the `models` fallback array
  // → keep primary + up to 3 free backups (4 ids total in our chain).
  const freeOnly = [first, ...extras].filter(
    (id) => id === 'openrouter/free' || id.endsWith(':free'),
  )
  const chain =
    freeOnly.length > 0
      ? freeOnly
      : [DEFAULT_CHAT_MODEL, ...FREE_CHAT_FALLBACKS]
  return chain.slice(0, 4)
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
  }
  if (input.aspectRatio?.trim()) {
    body.aspect_ratio = input.aspectRatio.trim()
  }
  // Only send params each family supports — unknown fields → 400.
  const isFlux = /flux/i.test(model)
  const isGeminiImage = /gemini|nano.?banana/i.test(model)
  if (isFlux) {
    const resolution = (input.resolution || '1K').trim()
    if (resolution) body.resolution = resolution
  } else if (!isGeminiImage) {
    body.output_format = 'png'
  }
  // Gemini Flash Image accepts up to 3 refs; keep product first.
  const refsForModel = isGeminiImage ? refs.slice(0, 3) : refs
  if (refsForModel.length > 0) {
    body.input_references = normalizeReferences(refsForModel)
    console.info(
      `[openrouter] ${model} · input_references=${refsForModel.length}` +
        (input.aspectRatio ? ` · ${input.aspectRatio}` : ''),
    )
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
  /** Prefer HTTPS playable URL from OpenRouter (avoids multi‑MB JSON). */
  videoUrl: string
  /** @deprecated Alias of videoUrl for older callers */
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

function clampHeyGenDuration(raw: number | undefined): number {
  const n = Math.round(Number(raw ?? 5))
  if (!Number.isFinite(n)) return 5
  let best: (typeof HEYGEN_DURATIONS)[number] = 5
  let bestDist = Infinity
  for (const d of HEYGEN_DURATIONS) {
    const dist = Math.abs(d - n)
    if (dist < bestDist) {
      best = d
      bestDist = dist
    }
  }
  return best
}

/**
 * Submit + poll OpenRouter video generation.
 * Returns a playable HTTPS URL when OpenRouter provides one (preferred),
 * otherwise downloads and returns a data URL.
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
  const isHeyGen = model.includes('heygen')

  const body: Record<string, unknown> = {
    model,
    prompt,
    duration: isHeyGen
      ? clampHeyGenDuration(input.duration)
      : input.duration ?? 5,
    aspect_ratio: input.aspectRatio ?? '9:16',
    // heygen-video-1: 480p | 768p | 2K (not 720p/1080p)
    resolution: input.resolution ?? '768p',
  }

  // CRITICAL: heygen-video-1 always renders audio. Sending generate_audio:false
  // returns 400 ("cannot be set to false"). Omit the field entirely for HeyGen.
  // Only pass generate_audio for other models when explicitly requested true.
  if (!isHeyGen && input.generateAudio === true) {
    body.generate_audio = true
  }

  const frames = (input.frameImages || []).filter((f) => f.url?.trim())
  if (frames.length > 0) {
    body.frame_images = frames.map((f) => ({
      type: 'image_url',
      image_url: { url: f.url.trim() },
      // heygen only supports first_frame
      frame_type: 'first_frame' as const,
    }))
  }

  const refs = (input.inputReferences || []).map((r) => r.trim()).filter(Boolean)
  if (refs.length > 0 && frames.length === 0) {
    body.input_references = refs.map((url) => ({
      type: 'image_url',
      image_url: { url },
    }))
  }

  const payload = JSON.stringify(body)
  console.info(
    `[openrouter-video] submit ${model} · ${Math.round(payload.length / 1024)}KB` +
      (frames.length ? ` · ${frames.length} frame(s)` : '') +
      ` · ${body.duration}s`,
  )

  const submitRes = await fetch(OPENROUTER_VIDEOS_URL, {
    method: 'POST',
    headers,
    body: payload,
  })
  const submitJson = (await submitRes.json().catch(() => null)) as {
    id?: string
    polling_url?: string
    status?: string
    error?: unknown
  } | null

  if (!submitRes.ok || !submitJson?.id) {
    const detail = parseVideoError(submitJson, submitRes.status)
    console.error('[openrouter-video] submit failed', detail)
    throw new Error(detail)
  }

  const jobId = submitJson.id
  const pollUrl =
    submitJson.polling_url || `${OPENROUTER_VIDEOS_URL}/${jobId}`
  console.info(`[openrouter-video] job ${jobId} polling…`)

  let completed: {
    status?: string
    unsigned_urls?: string[]
    error?: string | { message?: string }
  } | null = null

  for (let i = 0; i < VIDEO_POLL_MAX; i++) {
    await new Promise((r) =>
      setTimeout(r, i === 0 ? VIDEO_POLL_FIRST_MS : VIDEO_POLL_MS),
    )
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const pollJson = (await pollRes.json().catch(() => null)) as {
      status?: string
      unsigned_urls?: string[]
      error?: string | { message?: string }
    } | null
    const status = pollJson?.status || ''
    if (i === 0 || i % 3 === 0) {
      console.info(`[openrouter-video] job ${jobId} status=${status || pollRes.status}`)
    }
    if (status === 'completed') {
      completed = pollJson
      break
    }
    if (
      status === 'failed' ||
      status === 'cancelled' ||
      status === 'expired'
    ) {
      const errMsg =
        typeof pollJson?.error === 'string'
          ? pollJson.error
          : pollJson?.error &&
              typeof pollJson.error === 'object' &&
              typeof pollJson.error.message === 'string'
            ? pollJson.error.message
            : `Video generation ${status || 'failed'}`
      throw new Error(errMsg)
    }
  }

  if (!completed) {
    throw new Error('Video generation timed out while waiting for OpenRouter')
  }

  // OpenRouter content URLs require Authorization — browsers can't send that on
  // <video src>, so return a same-origin proxy path instead of unsigned_urls.
  const playable = `/api/openrouter-video/${encodeURIComponent(jobId)}`
  console.info(
    `[openrouter-video] job ${jobId} ready → proxy ${playable}` +
      (completed.unsigned_urls?.[0] ? ' (upstream needs auth)' : ''),
  )
  return {
    videoUrl: playable,
    videoDataUrl: playable,
    model,
    jobId,
  }
}

export type ChatCompletionInput = {
  system: string
  user: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export type ChatCompletionResult = {
  text: string
  model: string
}

/**
 * OpenRouter chat completions — used for captions, hooks, CTAs, hashtags, ad copy.
 */
export async function generateChatCompletion(
  input: ChatCompletionInput,
): Promise<ChatCompletionResult> {
  const apiKey = getOpenRouterApiKey()
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }
  const system = input.system.trim()
  const user = input.user.trim()
  if (!system || !user) {
    throw new Error('Chat system and user messages are required')
  }
  const model =
    (input.model || getOpenRouterChatModel()).trim() || DEFAULT_CHAT_MODEL
  const models = chatModelsPreferFree(model)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const res = await fetch(OPENROUTER_CHAT_URL, {
      method: 'POST',
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify({
        model: models[0],
        // Free-only fallbacks — OpenRouter max 3 items in `models`
        models: models.slice(1, 4),
        temperature: input.temperature ?? 0.75,
        max_tokens: input.maxTokens ?? 600,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
      signal: controller.signal,
    })
    const raw = await res.json().catch(() => null)
    if (!res.ok) {
      throw new Error(parseOpenRouterError(raw, res.status))
    }
    const choice = (raw as {
      choices?: { message?: { content?: string | null } }[]
      model?: string
    })?.choices?.[0]
    const text = choice?.message?.content?.trim()
    if (!text) {
      throw new Error('OpenRouter free chat returned empty text')
    }
    const usedModel =
      typeof (raw as { model?: string })?.model === 'string'
        ? (raw as { model: string }).model
        : models[0]!
    return { text, model: usedModel }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Stream a completed OpenRouter video with the server API key.
 * Used by /api/openrouter-video/:jobId so the browser can play without a Bearer token.
 */
export async function fetchOpenRouterVideoContent(
  jobId: string,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const apiKey = getOpenRouterApiKey()
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured')
  }
  const id = jobId.trim()
  if (!id || !/^gen-vid-[\w-]+$/i.test(id)) {
    throw new Error('Invalid OpenRouter video job id')
  }
  const contentUrl = `${OPENROUTER_VIDEOS_URL}/${id}/content?index=0`
  const videoRes = await fetch(contentUrl, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!videoRes.ok) {
    throw new Error(`Could not download generated video (${videoRes.status})`)
  }
  const buf = await videoRes.arrayBuffer()
  if (buf.byteLength < 1000) {
    throw new Error('OpenRouter returned an empty or invalid video file')
  }
  const contentType = videoRes.headers.get('content-type') || 'video/mp4'
  return { body: buf, contentType }
}
