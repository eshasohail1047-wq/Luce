/** Fetch a product page and extract usable image URLs + basic metadata. */

const MAX_HTML_BYTES = 1_800_000
const MAX_IMAGES = 12
const FETCH_TIMEOUT_MS = 12_000

export type FetchedProductPage = {
  url: string
  title?: string
  description?: string
  images: string[]
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

function absolutize(base: string, maybeRelative: string): string | null {
  try {
    const u = new URL(maybeRelative, base)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function metaContent(html: string, propertyOrName: string): string | undefined {
  const escaped = propertyOrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
    'i',
  )
  const m = re.exec(html)
  const raw = (m?.[1] || m?.[2] || '').trim()
  return raw ? decodeHtmlEntities(raw) : undefined
}

function titleFromHtml(html: string): string | undefined {
  const m = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)
  const raw = m?.[1]?.replace(/\s+/g, ' ').trim()
  return raw || undefined
}

function collectJsonLdImages(html: string, base: string, out: string[]) {
  const scriptRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = scriptRe.exec(html))) {
    const raw = match[1]?.trim()
    if (!raw) continue
    try {
      const parsed = JSON.parse(raw) as unknown
      walkJsonLd(parsed, base, out)
    } catch {
      /* ignore bad JSON-LD */
    }
  }
}

function walkJsonLd(node: unknown, base: string, out: string[]) {
  if (!node) return
  if (typeof node === 'string') {
    if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(node) || node.includes('cdn')) {
      const abs = absolutize(base, node)
      if (abs) out.push(abs)
    }
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, base, out)
    return
  }
  if (typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  for (const key of ['image', 'thumbnailUrl', 'contentUrl', 'logo']) {
    if (key in obj) walkJsonLd(obj[key], base, out)
  }
  if (Array.isArray(obj['@graph'])) walkJsonLd(obj['@graph'], base, out)
}

function collectImgTags(html: string, base: string, out: string[]) {
  const imgRe = /<img\b[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = imgRe.exec(html))) {
    const tag = match[0]
    const srcMatch =
      /\b(?:src|data-src|data-original|data-lazy-src)=["']([^"']+)["']/i.exec(
        tag,
      ) ||
      /\b(?:srcset|data-srcset)=["']([^"']+)["']/i.exec(tag)
    if (!srcMatch?.[1]) continue
    const candidate = srcMatch[1].split(',')[0]?.trim().split(/\s+/)[0]
    if (!candidate) continue
    if (
      candidate.startsWith('data:') ||
      candidate.includes('sprite') ||
      candidate.includes('icon') ||
      candidate.includes('logo') ||
      candidate.includes('1x1') ||
      candidate.includes('pixel')
    ) {
      continue
    }
    const abs = absolutize(base, decodeHtmlEntities(candidate))
    if (abs) out.push(abs)
  }
}

function uniqueKeepOrder(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of urls) {
    const key = url.split('?')[0]!.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(url)
    if (out.length >= MAX_IMAGES) break
  }
  return out
}

export async function fetchProductPage(
  rawUrl: string,
): Promise<{ ok: true; data: FetchedProductPage } | { ok: false; error: string; status: number }> {
  const trimmed = rawUrl.trim()
  if (!isHttpUrl(trimmed)) {
    return { ok: false, error: 'Enter a valid http(s) product URL.', status: 400 }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await fetch(trimmed, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (compatible; LUCEBot/1.0; +https://luce-landing.vercel.app)',
      },
    })
    if (!res.ok) {
      return {
        ok: false,
        error: `Could not open that page (${res.status}).`,
        status: 502,
      }
    }
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (
      contentType &&
      !contentType.includes('text/html') &&
      !contentType.includes('application/xhtml') &&
      !contentType.includes('text/plain')
    ) {
      // Direct image link — treat as the product photo.
      if (contentType.startsWith('image/')) {
        return {
          ok: true,
          data: { url: res.url || trimmed, images: [res.url || trimmed] },
        }
      }
      return {
        ok: false,
        error: 'That URL is not a product page we can read.',
        status: 400,
      }
    }

    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_HTML_BYTES) {
      return {
        ok: false,
        error: 'Product page is too large to scan.',
        status: 413,
      }
    }
    const html = buf.toString('utf8')
    const finalUrl = res.url || trimmed
    const images: string[] = []

    for (const key of [
      'og:image',
      'og:image:url',
      'og:image:secure_url',
      'twitter:image',
      'twitter:image:src',
    ]) {
      const v = metaContent(html, key)
      if (v) {
        const abs = absolutize(finalUrl, v)
        if (abs) images.push(abs)
      }
    }

    collectJsonLdImages(html, finalUrl, images)
    collectImgTags(html, finalUrl, images)

    const title =
      metaContent(html, 'og:title') ||
      metaContent(html, 'twitter:title') ||
      titleFromHtml(html)
    const description =
      metaContent(html, 'og:description') ||
      metaContent(html, 'description') ||
      metaContent(html, 'twitter:description')

    const unique = uniqueKeepOrder(images)
    if (!unique.length) {
      return {
        ok: false,
        error: 'No product photos found on that page. Try uploading a photo instead.',
        status: 404,
      }
    }

    return {
      ok: true,
      data: {
        url: finalUrl,
        title: title?.slice(0, 160),
        description: description?.slice(0, 500),
        images: unique,
      },
    }
  } catch (err) {
    const aborted =
      err instanceof Error &&
      (err.name === 'AbortError' || /aborted/i.test(err.message))
    return {
      ok: false,
      error: aborted
        ? 'Timed out loading that product page.'
        : 'Could not fetch that product page.',
      status: aborted ? 504 : 502,
    }
  } finally {
    clearTimeout(timer)
  }
}
