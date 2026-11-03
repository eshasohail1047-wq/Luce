/** Download a remote image/video into a data URL for client use (CORS-safe). */

import { safeFetch, SafeFetchError } from './safeFetch.js'

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

  try {
    // Fetch with the largest cap; per-kind limit is enforced once we know the type.
    const res = await safeFetch(trimmed, {
      maxBytes: MAX_VIDEO_BYTES,
      timeoutMs: FETCH_TIMEOUT_MS,
      headers: {
        Accept: 'image/*,video/*,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (compatible; LUCEBot/1.0; +https://luce-landing.vercel.app)',
      },
    })

    const contentType = (res.contentType || 'application/octet-stream')
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
    const buf = res.body
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
    if (err instanceof SafeFetchError) {
      switch (err.code) {
        case 'blocked':
          return { ok: false, error: 'That media URL is not allowed.', status: 400 }
        case 'too_large':
          return { ok: false, error: 'That media file is too large.', status: 413 }
        case 'timeout':
          return { ok: false, error: 'Timed out downloading that media URL.', status: 504 }
        case 'status':
          return {
            ok: false,
            error: `Could not download media (${err.status}).`,
            status: 502,
          }
      }
    }
    return { ok: false, error: 'Could not download that media URL.', status: 502 }
  }
}
