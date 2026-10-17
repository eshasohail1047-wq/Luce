const OPENROUTER_IMAGES_URL = 'https://openrouter.ai/api/v1/images'
const DEFAULT_MODEL = 'google/gemini-2.5-flash-image'
const REQUEST_TIMEOUT_MS = 120_000

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
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://luce.app',
        'X-Title': 'LUCE',
      },
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
