/** Fetch a product page and extract usable image URLs + basic metadata. */

const MAX_HTML_BYTES = 1_800_000
const MAX_IMAGES = 16
const FETCH_TIMEOUT_MS = 14_000

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

function isLikelyJunkImage(url: string): boolean {
  const u = url.toLowerCase()
  return (
    u.startsWith('data:') ||
    u.includes('sprite') ||
    u.includes('/icon') ||
    u.includes('favicon') ||
    u.includes('logo') ||
    u.includes('1x1') ||
    u.includes('pixel') ||
    u.includes('placeholder') ||
    u.includes('blank.') ||
    u.includes('spacer') ||
    u.includes('payment') ||
    u.includes('badge') ||
    u.includes('avatar')
  )
}

/** Normalize Shopify size variants so the same photo isn't listed 6 times. */
function imageDedupeKey(url: string): string {
  try {
    const u = new URL(url)
    let path = u.pathname.toLowerCase()
    path = path.replace(
      /_(?:pico|icon|thumb|small|compact|medium|large|grande|original|\d+x\d*|\d*x\d+)(?=\.[a-z]+$)/i,
      '',
    )
    return `${u.hostname}${path}`
  } catch {
    return url.split('?')[0]!.toLowerCase()
  }
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
    if (
      /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(node) ||
      /cdn\.|\/files\/|\/products\//i.test(node)
    ) {
      const abs = absolutize(base, node)
      if (abs && !isLikelyJunkImage(abs)) out.push(abs)
    }
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, base, out)
    return
  }
  if (typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  for (const key of ['image', 'thumbnailUrl', 'contentUrl', 'logo', 'photo']) {
    if (key in obj) walkJsonLd(obj[key], base, out)
  }
  if (Array.isArray(obj['@graph'])) walkJsonLd(obj['@graph'], base, out)
}

function collectImgTags(html: string, base: string, out: string[]) {
  const imgRe = /<img\b[^>]*>/gi
  let match: RegExpExecArray | null
  while ((match = imgRe.exec(html))) {
    const tag = match[0]
    const attrs = [
      ...tag.matchAll(
        /\b(?:src|data-src|data-original|data-lazy-src|data-zoom-image|data-image|data-featured-product-image)=["']([^"']+)["']/gi,
      ),
    ]
    const srcset = /\b(?:srcset|data-srcset)=["']([^"']+)["']/i.exec(tag)?.[1]
    if (srcset) {
      for (const part of srcset.split(',')) {
        const candidate = part.trim().split(/\s+/)[0]
        if (candidate) attrs.push(['', candidate] as unknown as RegExpMatchArray)
      }
    }
    for (const m of attrs) {
      const candidate = decodeHtmlEntities((m[1] || '').trim())
      if (!candidate || isLikelyJunkImage(candidate)) continue
      const abs = absolutize(base, candidate)
      if (abs) out.push(abs)
    }
  }
}

/** Pull Shopify CDN URLs embedded in page scripts / JSON blobs. */
function collectShopifyCdnUrls(html: string, out: string[]) {
  const re =
    /https?:\/\/(?:cdn\.shopify\.com|[^"'\\\s]+\/cdn\/shop)\/[^"'\\\s>]+\.(?:jpe?g|png|webp|gif)(?:\?[^"'\\\s>]*)?/gi
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    const url = match[0]
    if (!isLikelyJunkImage(url)) out.push(url)
  }
}

function collectJsonScriptImages(html: string, base: string, out: string[]) {
  const scriptRe =
    /<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = scriptRe.exec(html))) {
    const raw = match[1]?.trim()
    if (!raw || raw.length > 400_000) continue
    try {
      walkProductJson(JSON.parse(raw), base, out)
    } catch {
      /* ignore */
    }
  }
}

function walkProductJson(node: unknown, base: string, out: string[], depth = 0) {
  if (!node || depth > 8) return
  if (typeof node === 'string') {
    if (/\.(jpe?g|png|webp|gif)(\?|$)/i.test(node) || /\/files\/|cdn\.shopify/i.test(node)) {
      const abs = absolutize(base, node)
      if (abs && !isLikelyJunkImage(abs)) out.push(abs)
    }
    return
  }
  if (Array.isArray(node)) {
    for (const item of node) walkProductJson(item, base, out, depth + 1)
    return
  }
  if (typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  for (const key of [
    'src',
    'url',
    'image',
    'images',
    'preview_image',
    'featured_image',
    'media',
    'sources',
  ]) {
    if (key in obj) walkProductJson(obj[key], base, out, depth + 1)
  }
}

function uniqueKeepOrder(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of urls) {
    const key = imageDedupeKey(url)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(url)
    if (out.length >= MAX_IMAGES) break
  }
  return out
}

function shopifyProductJsUrl(pageUrl: string): string | null {
  try {
    const u = new URL(pageUrl)
    if (!/\/products\/[^/?#]+/i.test(u.pathname)) return null
    // /products/handle -> /products/handle.js (strip trailing slash)
    u.pathname = u.pathname.replace(/\/?$/, '') + '.js'
    u.search = ''
    u.hash = ''
    return u.toString()
  } catch {
    return null
  }
}

function collectFromShopifyProductJson(data: unknown, base: string, out: string[]) {
  if (!data || typeof data !== 'object') return
  const product = data as Record<string, unknown>
  if (Array.isArray(product.images)) {
    for (const img of product.images) {
      if (typeof img === 'string') {
        const abs = absolutize(base, img.startsWith('//') ? `https:${img}` : img)
        if (abs && !isLikelyJunkImage(abs)) out.push(abs)
      } else if (img && typeof img === 'object') {
        const src = (img as { src?: string }).src
        if (typeof src === 'string') {
          const abs = absolutize(base, src.startsWith('//') ? `https:${src}` : src)
          if (abs && !isLikelyJunkImage(abs)) out.push(abs)
        }
      }
    }
  }
  if (Array.isArray(product.media)) {
    for (const m of product.media) {
      if (!m || typeof m !== 'object') continue
      const media = m as {
        media_type?: string
        src?: string
        preview_image?: { src?: string }
      }
      if (media.media_type && media.media_type !== 'image') continue
      const src = media.src || media.preview_image?.src
      if (typeof src === 'string') {
        const abs = absolutize(base, src.startsWith('//') ? `https:${src}` : src)
        if (abs && !isLikelyJunkImage(abs)) out.push(abs)
      }
    }
  }
  if (typeof product.featured_image === 'string') {
    const abs = absolutize(
      base,
      product.featured_image.startsWith('//')
        ? `https:${product.featured_image}`
        : product.featured_image,
    )
    if (abs && !isLikelyJunkImage(abs)) out.push(abs)
  }
}

async function tryFetchShopifyProductJs(
  pageUrl: string,
  signal: AbortSignal,
): Promise<{ images: string[]; title?: string } | null> {
  const jsUrl = shopifyProductJsUrl(pageUrl)
  if (!jsUrl) return null
  try {
    const res = await fetch(jsUrl, {
      method: 'GET',
      redirect: 'follow',
      signal,
      headers: {
        Accept: 'application/json,text/javascript,*/*;q=0.8',
        'User-Agent':
          'Mozilla/5.0 (compatible; LUCEBot/1.0; +https://luce-landing.vercel.app)',
      },
    })
    if (!res.ok) return null
    const data = (await res.json()) as Record<string, unknown>
    const images: string[] = []
    collectFromShopifyProductJson(data, pageUrl, images)
    const title = typeof data.title === 'string' ? data.title : undefined
    return images.length ? { images, title } : null
  } catch {
    return null
  }
}

function isDirectImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(url)
}

/**
 * If the user pasted a Shopify CDN file URL, try the referring product page
 * is unknown — return single image. Prefer product page URLs for galleries.
 */
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
    // Fast path: already a direct image file URL
    if (isDirectImageUrl(trimmed)) {
      return {
        ok: true,
        data: {
          url: trimmed,
          images: [trimmed],
          description:
            'This looks like a single image file. Paste the product page URL to load the full gallery.',
        },
      }
    }

    // Shopify: product.js usually has the full media gallery
    const shopify = await tryFetchShopifyProductJs(trimmed, controller.signal)

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
    if (!res.ok && !shopify) {
      return {
        ok: false,
        error: `Could not open that page (${res.status}).`,
        status: 502,
      }
    }

    const finalUrl = res.ok ? res.url || trimmed : trimmed
    const images: string[] = []
    let title: string | undefined = shopify?.title
    let description: string | undefined

    if (shopify?.images.length) {
      images.push(...shopify.images)
    }

    if (res.ok) {
      const contentType = (res.headers.get('content-type') || '').toLowerCase()
      if (contentType.startsWith('image/')) {
        images.unshift(res.url || trimmed)
      } else if (
        !contentType ||
        contentType.includes('text/html') ||
        contentType.includes('application/xhtml') ||
        contentType.includes('text/plain')
      ) {
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.byteLength <= MAX_HTML_BYTES) {
          const html = buf.toString('utf8')
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
              if (abs && !isLikelyJunkImage(abs)) images.push(abs)
            }
          }
          collectJsonLdImages(html, finalUrl, images)
          collectJsonScriptImages(html, finalUrl, images)
          collectShopifyCdnUrls(html, images)
          collectImgTags(html, finalUrl, images)
          title =
            title ||
            metaContent(html, 'og:title') ||
            metaContent(html, 'twitter:title') ||
            titleFromHtml(html)
          description =
            metaContent(html, 'og:description') ||
            metaContent(html, 'description') ||
            metaContent(html, 'twitter:description')
        }
      } else if (!shopify) {
        return {
          ok: false,
          error: 'That URL is not a product page we can read.',
          status: 400,
        }
      }
    }

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
