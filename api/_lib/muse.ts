/** Meta Muse Image — https://api.meta.ai/v1 ($0.01 / image). */

const MUSE_BASE = 'https://api.meta.ai/v1'
const DEFAULT_MODEL = 'muse-image-1.0'
const REQUEST_TIMEOUT_MS = 120_000

export type MuseGenerateInput = {
  prompt: string
  /** Product / style refs as data URLs or HTTPS URLs */
  inputImages?: string[]
  model?: string
  /** Aspect hint, e.g. 1024x1536 for vertical social */
  size?: string
}

export type MuseGenerateResult = {
  imageDataUrl: string
  model: string
  provider: 'muse'
}

export function getMuseApiKey(): string | undefined {
  return (
    process.env.MUSE_API_KEY?.trim() ||
    process.env.MODEL_API_KEY?.trim() ||
    undefined
  )
}

export function getMuseImageModel(): string {
  return process.env.MUSE_IMAGE_MODEL?.trim() || DEFAULT_MODEL
}

function parseError(body: unknown, status: number): string {
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
    if (typeof err.message === 'string' && err.message.trim()) {
      return err.message.trim()
    }
  }
  return `Muse image request failed (${status})`
}

function toDataUrl(b64: string, mediaType = 'image/png'): string {
  const cleaned = b64.replace(/\s/g, '')
  if (cleaned.startsWith('data:')) return cleaned
  const mime = mediaType.startsWith('image/') ? mediaType : 'image/png'
  return `data:${mime};base64,${cleaned}`
}

/**
 * Generate or edit with Muse Image.
 * With input images → POST /images/edits (product fidelity).
 * Otherwise → POST /images/generations.
 */
export async function generateMuseImage(
  input: MuseGenerateInput,
): Promise<MuseGenerateResult> {
  const apiKey = getMuseApiKey()
  if (!apiKey) {
    throw new Error('MUSE_API_KEY (or MODEL_API_KEY) is not configured')
  }

  const prompt = input.prompt.trim()
  if (!prompt) throw new Error('Image prompt is required')

  const model = (input.model || getMuseImageModel()).trim() || DEFAULT_MODEL
  const refs = (input.inputImages || []).map((r) => r.trim()).filter(Boolean)
  const useEdit = refs.length > 0

  const body: Record<string, unknown> = {
    model,
    prompt,
    n: 1,
    response_format: 'b64_json',
    output_format: 'png',
    size: input.size || '1024x1536',
    reasoning_strength: 'low',
    tool_enablement: {
      enable_image_search: false,
      enable_web_search: false,
      enable_shell: false,
    },
  }

  if (useEdit) {
    body.images = refs.map((image_url) => ({ image_url }))
  }

  const path = useEdit ? '/images/edits' : '/images/generations'
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(`${MUSE_BASE}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Muse image request timed out')
    }
    throw err
  } finally {
    clearTimeout(timer)
  }

  const json = (await res.json().catch(() => null)) as {
    data?: { b64_json?: string; url?: string }[]
    output_format?: string
    error?: unknown
  } | null

  if (!res.ok) {
    throw new Error(parseError(json, res.status))
  }

  const first = json?.data?.[0]
  const b64 = first?.b64_json
  if (b64) {
    const mime =
      json?.output_format === 'jpeg'
        ? 'image/jpeg'
        : json?.output_format === 'webp'
          ? 'image/webp'
          : 'image/png'
    return { imageDataUrl: toDataUrl(b64, mime), model, provider: 'muse' }
  }

  if (first?.url) {
    const imgRes = await fetch(first.url)
    if (!imgRes.ok) {
      throw new Error(`Could not download Muse image (${imgRes.status})`)
    }
    const buf = Buffer.from(await imgRes.arrayBuffer())
    const mime = imgRes.headers.get('content-type') || 'image/png'
    return {
      imageDataUrl: `data:${mime};base64,${buf.toString('base64')}`,
      model,
      provider: 'muse',
    }
  }

  throw new Error('Muse returned no image data')
}
