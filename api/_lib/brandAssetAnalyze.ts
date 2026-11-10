/**
 * Logo / imagery color analysis using sharp (already in the project).
 * No paid vision API required. Optional free OpenRouter vision can annotate later.
 */

import { isSafePublicUrl, normalizeHex, type ExtractedColor } from './brandCssExtract.js'
import type { LogoAnalysis, VisualStyleNotes, BrandColorEntry } from './brandProfile.js'

const MAX_IMAGE_BYTES = 1_500_000
const IMAGE_TIMEOUT_MS = 8_000
const MAX_IMAGES = 4
const USER_AGENT =
  'Mozilla/5.0 (compatible; LUCEBot/1.0; +https://luce-landing.vercel.app)'

async function fetchImageBuffer(
  url: string,
  pageUrl: string,
  signal?: AbortSignal,
): Promise<Buffer | null> {
  if (!isSafePublicUrl(url, pageUrl)) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), IMAGE_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  signal?.addEventListener('abort', onAbort)
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Accept: 'image/*,*/*;q=0.1',
        'User-Agent': USER_AGENT,
      },
    })
    if (!res.ok) return null
    const finalUrl = res.url || url
    if (!isSafePublicUrl(finalUrl, pageUrl)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength < 64 || buf.byteLength > MAX_IMAGE_BYTES) return null
    return buf
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

function isNearWhiteOrBlack(hex: string): boolean {
  const m = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(hex)
  if (!m) return true
  const r = parseInt(m[1]!, 16)
  const g = parseInt(m[2]!, 16)
  const b = parseInt(m[3]!, 16)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max < 28) return true
  if (min > 240) return true
  // Near-gray / low-chroma logo anti-alias pixels are not brand accents
  const sat = max === 0 ? 0 : (max - min) / max
  if (sat < 0.12) return true
  return false
}

/**
 * Sample dominant colors from an image buffer via sharp stats / resize histogram.
 */
async function dominantColorsFromBuffer(
  buf: Buffer,
  sourceLabel: string,
  maxColors = 4,
): Promise<BrandColorEntry[]> {
  let sharp: typeof import('sharp')
  try {
    sharp = (await import('sharp')).default
  } catch {
    return []
  }

  try {
    const image = sharp(buf, { failOn: 'none' }).rotate()
    const { data, info } = await image
      .resize(48, 48, { fit: 'inside' })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    const buckets = new Map<string, number>()
    const channels = info.channels
    for (let i = 0; i < data.length; i += channels) {
      const a = channels === 4 ? data[i + 3]! : 255
      if (a < 40) continue // skip transparent
      // Quantize to reduce noise
      const r = data[i]! >> 4 << 4
      const g = data[i + 1]! >> 4 << 4
      const b = data[i + 2]! >> 4 << 4
      const hex = rgbToHex(r, g, b)
      if (isNearWhiteOrBlack(hex)) continue
      buckets.set(hex, (buckets.get(hex) || 0) + 1)
    }

    const ranked = [...buckets.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxColors)

    const total = ranked.reduce((s, [, n]) => s + n, 0) || 1
    return ranked.map(([hex, count], idx) => {
      const norm = normalizeHex(hex) || hex
      return {
        hex: norm,
        role: idx === 0 ? 'primary' : 'secondary',
        classification: 'accent',
        source: sourceLabel,
        confidence: Math.round(Math.min(0.92, 0.45 + count / total) * 100) / 100,
        verified: true,
        estimated: false,
        property: 'image-pixels',
        usageContext: sourceLabel,
      } satisfies BrandColorEntry
    })
  } catch {
    return []
  }
}

export async function analyzeBrandAssets(input: {
  pageUrl: string
  logoUrl?: string
  imageUrls?: string[]
  signal?: AbortSignal
}): Promise<{
  logoAnalysis: LogoAnalysis
  visualStyle: VisualStyleNotes
  productColors: ExtractedColor[]
  warnings: string[]
}> {
  const warnings: string[] = []
  const logoAnalysis: LogoAnalysis = {
    sourceUrl: input.logoUrl,
    dominantColors: [],
    analyzed: false,
  }
  const imageColors: BrandColorEntry[] = []
  const productColors: ExtractedColor[] = []

  const urls: Array<{ url: string; kind: 'logo' | 'image' }> = []
  if (input.logoUrl) urls.push({ url: input.logoUrl, kind: 'logo' })
  for (const u of (input.imageUrls || []).slice(0, MAX_IMAGES)) {
    if (input.logoUrl && u === input.logoUrl) continue
    urls.push({ url: u, kind: 'image' })
  }

  const runOne = async (item: (typeof urls)[number]) => {
    const buf = await fetchImageBuffer(item.url, input.pageUrl, input.signal)
    if (!buf) {
      warnings.push(`Could not analyze image: ${item.url.slice(0, 80)}`)
      return
    }
    const colors = await dominantColorsFromBuffer(
      buf,
      item.kind === 'logo' ? `logo:${item.url}` : `image:${item.url}`,
      item.kind === 'logo' ? 4 : 3,
    )
    if (item.kind === 'logo') {
      logoAnalysis.dominantColors = colors
      logoAnalysis.analyzed = colors.length > 0
      logoAnalysis.notes = colors.length
        ? `Sampled ${colors.length} dominant non-neutral color(s) from logo pixels.`
        : 'Logo fetched but no non-neutral colors found (may be mono/white).'
    } else {
      imageColors.push(...colors)
      for (const c of colors) {
        productColors.push({
          hex: c.hex,
          classification: 'accent',
          source: c.source,
          confidence: Math.round(c.confidence * 85) / 100,
          property: 'image-pixels',
          usageContext: 'product/lifestyle image',
          verified: true,
          promotional: false,
        })
      }
    }
  }

  // Concurrency 2
  for (let i = 0; i < urls.length; i += 2) {
    await Promise.all(urls.slice(i, i + 2).map(runOne))
  }

  const visualStyle: VisualStyleNotes = {
    imageColors: imageColors.slice(0, 8),
    photographyStyle: imageColors.length
      ? 'Derived from sampled product/lifestyle imagery colors (pixel evidence only).'
      : undefined,
    backgroundStyle: undefined,
    layoutPatterns: [],
    consistencyNotes: logoAnalysis.analyzed
      ? 'Logo colors sampled independently from CSS extraction.'
      : undefined,
  }

  return { logoAnalysis, visualStyle, productColors, warnings }
}
