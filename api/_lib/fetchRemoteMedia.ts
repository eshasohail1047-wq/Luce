/** Download a remote image/video into a data URL for client use (CORS-safe). */

const FETCH_TIMEOUT_MS = 20_000
const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const MAX_VIDEO_BYTES = 40 * 1024 * 1024

export type FetchedRemoteMedia = {
  dataUrl: string
  contentType: string
  kind: 'image' | 'video'
  byteLength: number
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function sniffKind(
  contentType: string,
  url: string,
): 'image' | 'video' | null {
  const ct = contentType.toLowerCase()
  if (ct.startsWith('image/')) return 'image'
  if (ct.startsWith('video/')) return 'video'
  if (/\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url)) return 'image'
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(url)) return 'video'
  return null
}

export async function fetchRemoteMedia(
  rawUrl: string,
  prefer: 'image' | 'video' | 'any' = 'any',
): Promise<
  { ok: true; data: FetchedRemoteMedia } | { ok: false; error: string; status: number }
> {
  const trimmed = rawUrl.trim()
  if (!isHttpUrl(trimmed)) {
    return { ok: false, error: 'Enter a valid http(s) media URL.', status: 400 }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(trimmed, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'image/*,video/*,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (compatible; LUCEBot/1.0; +https://luce-landing.vercel.app)',
      },
    })
    if (!res.ok) {
      return {
        ok: false,
        error: `Could not download media (${res.status}).`,
        status: 502,
      }
    }

    const contentType = (res.headers.get('content-type') || 'application/octet-stream')
      .split(';')[0]!
      .trim()
    const kind = sniffKind(contentType, res.url || trimmed)
    if (!kind) {
      return {
        ok: false,
        error: 'URL must point to an image or video file.',
        status: 400,
      }
    }
    if (prefer === 'image' && kind !== 'image') {
      return { ok: false, error: 'That URL is not an image.', status: 400 }
    }
    if (prefer === 'video' && kind !== 'video') {
      return { ok: false, error: 'That URL is not a video.', status: 400 }
    }

    const max = kind === 'video' ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES
    const lenHeader = Number(res.headers.get('content-length') || 0)
    if (lenHeader > max) {
      return {
        ok: false,
        error:
          kind === 'video'
            ? 'Reference video must be under 40MB.'
            : 'Reference image must be under 12MB.',
        status: 413,
      }
    }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > max) {
      return {
        ok: false,
        error:
          kind === 'video'
            ? 'Reference video must be under 40MB.'
            : 'Reference image must be under 12MB.',
        status: 413,
      }
    }
    if (buf.byteLength < 64) {
      return { ok: false, error: 'Media file looks empty.', status: 400 }
    }

    const mime =
      contentType.startsWith('image/') || contentType.startsWith('video/')
        ? contentType
        : kind === 'video'
          ? 'video/mp4'
          : 'image/jpeg'
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`
    return {
      ok: true,
      data: {
        dataUrl,
        contentType: mime,
        kind,
        byteLength: buf.byteLength,
      },
    }
  } catch (err) {
    const aborted =
      err instanceof Error &&
      (err.name === 'AbortError' || /aborted/i.test(err.message))
    return {
      ok: false,
      error: aborted
        ? 'Timed out downloading that media URL.'
        : 'Could not download that media URL.',
      status: aborted ? 504 : 502,
    }
  } finally {
    clearTimeout(timer)
  }
}
