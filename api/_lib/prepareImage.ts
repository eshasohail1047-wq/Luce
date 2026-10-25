const MAX_EDGE = 1280
const JPEG_QUALITY = 82
/** FLUX / BFL reject reference images smaller than 256×256 */
const MIN_EDGE = 256
/** ~1.2MB base64 payload — OpenRouter frame_images choke on multi‑MB data URLs */
const MAX_DATA_URL_CHARS = 1_600_000

type SharpFactory = typeof import('sharp').default

async function loadSharp(): Promise<SharpFactory | null> {
  try {
    const mod = await import('sharp')
    return mod.default
  } catch (err) {
    console.warn(
      '[prepare-image] sharp unavailable — passing images through unchanged',
      err instanceof Error ? err.message : err,
    )
    return null
  }
}

function publicAppOrigin(): string | undefined {
  const fromEnv =
    process.env.APP_URL?.trim() ||
    process.env.OPENROUTER_HTTP_REFERER?.trim() ||
    (process.env.VERCEL_URL?.trim()
      ? `https://${process.env.VERCEL_URL.trim()}`
      : undefined)
  if (!fromEnv) return undefined
  try {
    return new URL(fromEnv).origin
  } catch {
    return undefined
  }
}

/** Resolve site-relative paths (e.g. /images/foo.jpg) to an absolute URL the server can fetch. */
function absoluteImageUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed.startsWith('/')) return trimmed
  const origin = publicAppOrigin()
  if (!origin) return trimmed
  return `${origin}${trimmed}`
}

async function bufferFromImageUrl(url: string): Promise<Buffer | null> {
  const trimmed = url.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('data:image/')) {
    const comma = trimmed.indexOf(',')
    if (comma < 0) return null
    const b64 = trimmed.slice(comma + 1)
    if (!b64) return null
    return Buffer.from(b64, 'base64')
  }
  const fetchUrl = absoluteImageUrl(trimmed)
  if (/^https?:\/\//i.test(fetchUrl)) {
    const res = await fetch(fetchUrl)
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  }
  // Relative path with no APP_URL / VERCEL_URL — cannot fetch on the server
  console.warn(
    '[prepare-image] relative productImage ignored (set APP_URL). Client should send a data URL.',
    trimmed.slice(0, 80),
  )
  return null
}

/**
 * Ensure reference stills meet FLUX min size (256×256) and stay under max edge.
 * Upscales tiny product/refs; shrinks huge ones. Returns JPEG data URL.
 */
export async function prepareReferenceImage(url: string): Promise<string> {
  const trimmed = url.trim()
  if (!trimmed) return trimmed

  // Reject relative paths before any provider call — OpenRouter cannot fetch /images/…
  if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
    const abs = absoluteImageUrl(trimmed)
    if (abs === trimmed || !/^https?:\/\//i.test(abs)) {
      throw new Error(
        'productImage must be a data URL or public https URL. Relative paths like /images/… are not fetchable by the AI API — convert on the client first.',
      )
    }
  }

  const sharp = await loadSharp()
  if (!sharp) {
    // Without sharp, still resolve relative→absolute when APP_URL is set
    return absoluteImageUrl(trimmed)
  }

  try {
    const input = await bufferFromImageUrl(trimmed)
    if (!input) {
      if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
        throw new Error(
          'productImage must be a data URL or public https URL. Relative paths like /images/… are not fetchable by the AI API — convert on the client first.',
        )
      }
      return trimmed
    }

    const metaInfo = await sharp(input, { failOn: 'none' }).rotate().metadata()
    const w = metaInfo.width || 0
    const h = metaInfo.height || 0
    const tooSmall = w > 0 && h > 0 && (w < MIN_EDGE || h < MIN_EDGE)
    const tooLarge = w > MAX_EDGE || h > MAX_EDGE

    if (!tooSmall && !tooLarge && trimmed.startsWith('data:image/')) {
      if (trimmed.length <= MAX_DATA_URL_CHARS * 0.55) return trimmed
    }

    let pipeline = sharp(input, { failOn: 'none' }).rotate()
    if (tooSmall) {
      pipeline = pipeline.resize({
        width: MIN_EDGE,
        height: MIN_EDGE,
        fit: 'outside',
        withoutEnlargement: false,
      })
    } else if (tooLarge) {
      pipeline = pipeline.resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: 'inside',
        withoutEnlargement: true,
      })
    }

    const out = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()
    const next = `data:image/jpeg;base64,${out.toString('base64')}`
    const outMeta = await sharp(out).metadata()
    console.info(
      `[prepare-ref] ${w}x${h} → ${outMeta.width}x${outMeta.height}` +
        ` (${Math.round(trimmed.length / 1024)}KB → ${Math.round(next.length / 1024)}KB)` +
        (tooSmall ? ' upscaled' : ''),
    )
    return next
  } catch (err) {
    console.warn(
      '[prepare-ref] failed, using original',
      err instanceof Error ? err.message : err,
    )
    return trimmed
  }
}

/**
 * Shrink / re-encode data-URL stills before sending to video providers.
 * HTTPS URLs are left alone (providers fetch them).
 */
export async function prepareFrameImage(url: string): Promise<string> {
  const trimmed = url.trim()
  if (!trimmed) return trimmed
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (!trimmed.startsWith('data:image/')) return trimmed

  if (trimmed.length <= MAX_DATA_URL_CHARS * 0.55) return trimmed

  const sharp = await loadSharp()
  if (!sharp) return trimmed

  const comma = trimmed.indexOf(',')
  if (comma < 0) return trimmed
  const meta = trimmed.slice(0, comma)
  const b64 = trimmed.slice(comma + 1)
  if (!b64) return trimmed

  try {
    const input = Buffer.from(b64, 'base64')
    let pipeline = sharp(input, { failOn: 'none' }).rotate()
    const metaInfo = await pipeline.metadata()
    const w = metaInfo.width || 0
    const h = metaInfo.height || 0
    if (w > MAX_EDGE || h > MAX_EDGE) {
      pipeline = sharp(input, { failOn: 'none' })
        .rotate()
        .resize({
          width: MAX_EDGE,
          height: MAX_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
    } else {
      pipeline = sharp(input, { failOn: 'none' }).rotate()
    }

    const out = await pipeline.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()
    const next = `data:image/jpeg;base64,${out.toString('base64')}`
    console.info(
      `[prepare-image] ${Math.round(trimmed.length / 1024)}KB → ${Math.round(next.length / 1024)}KB` +
        (w && h ? ` (${w}x${h})` : '') +
        (meta.includes('png') ? ' png→jpeg' : ''),
    )
    return next
  } catch (err) {
    console.warn(
      '[prepare-image] resize failed, using original',
      err instanceof Error ? err.message : err,
    )
    return trimmed
  }
}
