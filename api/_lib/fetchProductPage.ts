/** Fetch a product page and extract usable image URLs + basic metadata. */

import {
  extractBrandVisuals,
  type ExtractedColor,
  type ExtractedFont,
} from './brandCssExtract.js'
import { buildBrandProfile, type BrandProfile } from './brandProfile.js'
import {
  buildCompleteBrandKit,
  type CompleteBrandKit,
} from './brandIntelligence.js'
import { refineBrandKitWithAi } from './refineBrandKit.js'
import {
  buildEvidenceStyleNotes,
  extractBrandCopyFacts,
  cleanBrandDisplayName,
} from './brandCopyFacts.js'
import { emitStage, type ScanProgressFn } from './scanProgress.js'

export type {
  ExtractedColor,
  ExtractedFont,
  ColorClassification,
  FontUsage,
} from './brandCssExtract.js'
export type { BrandProfile, BrandColorEntry, BrandFontEntry } from './brandProfile.js'
export type { CompleteBrandKit, EvidenceField, EvidenceStatus } from './brandIntelligence.js'

const MAX_HTML_BYTES = 1_800_000
/** Cap gallery choices — product uploads only, not the whole page CDN. */
const MAX_IMAGES = 16
/** Brand onboarding: pull a fuller catalog for the review kit. */
const MAX_BRAND_IMAGES = 36
/** Soft ceiling so huge catalogs stay workable in Firestore / onboarding UI. */
const MAX_BRAND_PRODUCTS = 500
const FETCH_TIMEOUT_MS = 18_000
/** Brand mode: HTML + CSS + Playwright + asset analysis + AI refine. */
const BRAND_FETCH_TIMEOUT_MS = 180_000

export type FetchedBrandProduct = {
  name: string
  imageUrl: string
  sourceUrl?: string
}

export type FetchedProductPage = {
  url: string
  title?: string
  description?: string
  images: string[]
  /** Brand onboarding extras (optional). */
  logoUrl?: string
  /** Backward-compatible hex list (evidence-backed only; no padding). */
  colors?: string[]
  /** Backward-compatible font names. */
  fonts?: string[]
  /** Structured color evidence for Phase 1+. */
  colorDetails?: ExtractedColor[]
  /** Structured font evidence for Phase 1+. */
  fontDetails?: ExtractedFont[]
  markets?: string[]
  audienceHint?: string
  products?: FetchedBrandProduct[]
  /** True when free OpenRouter chat refined the kit. */
  aiRefined?: boolean
  category?: string
  brandVoice?: string
  styleNotes?: string
  extractionMethod?: 'html' | 'html+css' | 'html+css+render' | 'html+css+ai' | 'html+css+render+ai'
  warnings?: string[]
  /** How many external stylesheets were successfully downloaded for brand mode. */
  stylesheetsFetched?: number
  /** True when evidence-backed palette covers fewer than typical brand roles. */
  paletteIncomplete?: boolean
  /** Structured brand profile (Phase complete). */
  brandProfile?: BrandProfile
  brandKeywords?: string[]
  extractionConfidence?: number
  /** Full brand kit with verified / ai-inferred / unknown fields. */
  completeBrandKit?: CompleteBrandKit
  aiWarning?: string
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
  // Tiny Shopify size variants are UI thumbs, not gallery masters
  if (/_(?:pico|icon|thumb|small|compact|50x|60x|80x|100x|160x)(?=\.|_|\?|$)/i.test(u)) {
    return true
  }
  return (
    u.startsWith('data:') ||
    u.endsWith('.svg') ||
    u.includes('.svg?') ||
    u.includes('sprite') ||
    u.includes('/icon') ||
    u.includes('icons/') ||
    u.includes('favicon') ||
    u.includes('logo') ||
    u.includes('1x1') ||
    u.includes('pixel') ||
    u.includes('placeholder') ||
    u.includes('blank.') ||
    u.includes('spacer') ||
    u.includes('payment') ||
    u.includes('badge') ||
    u.includes('avatar') ||
    u.includes('whatsapp') ||
    u.includes('telegram') ||
    u.includes('facebook') ||
    u.includes('fb-') ||
    u.includes('twitter') ||
    u.includes('instagram') ||
    u.includes('pinterest') ||
    u.includes('tiktok') ||
    u.includes('youtube') ||
    u.includes('social') ||
    u.includes('share-') ||
    u.includes('/share/') ||
    u.includes('newsletter') ||
    u.includes('emoji') ||
    u.includes('spinner') ||
    u.includes('loading') ||
    u.includes('lazyload') ||
    u.includes('arrow') ||
    u.includes('chevron') ||
    u.includes('caret') ||
    u.includes('close-') ||
    u.includes('cart') ||
    u.includes('wishlist') ||
    u.includes('star-') ||
    u.includes('rating') ||
    u.includes('review') ||
    u.includes('flag') ||
    u.includes('banner') ||
    u.includes('hero-bg') ||
    u.includes('background') ||
    u.includes('/theme/') ||
    u.includes('/assets/share') ||
    u.includes('gift-card') ||
    u.includes('swatch')
  )
}

/** Prefer CDN paths that look like product media, not theme chrome. */
function isLikelyProductMediaPath(url: string): boolean {
  const u = url.toLowerCase()
  if (isLikelyJunkImage(u)) return false
  return (
    /\/products?\//i.test(u) ||
    /\/files\//i.test(u) ||
    /\/product[_-]?images?\//i.test(u) ||
    /cdn\.shopify\.com\/s\/files\//i.test(u) ||
    /\/media\/catalog\/product\//i.test(u) ||
    /\/wp-content\/uploads\//i.test(u)
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
  // Skip brand logos / unrelated thumbnails — product `image` only
  for (const key of ['image', 'photo', 'contentUrl']) {
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

function uniqueKeepOrder(urls: string[], max = MAX_IMAGES): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const url of urls) {
    const key = imageDedupeKey(url)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(url)
    if (out.length >= max) break
  }
  return out
}

function logoScore(url: string): number {
  const u = url.toLowerCase()
  let score = 0
  if (/logo/.test(u)) score += 8
  if (/brand/.test(u)) score += 3
  if (/header.*logo|heading-logo|logo_1|logo-primary|site-logo/.test(u)) score += 4
  if (/favicon|icon|apple-touch|badge|payment|wishlist/.test(u)) score -= 6
  const wh = /(?:width|height)=(\d+)/gi
  let m: RegExpExecArray | null
  let maxDim = 0
  while ((m = wh.exec(u))) maxDim = Math.max(maxDim, Number(m[1]) || 0)
  if (maxDim && maxDim < 48) score -= 10
  if (maxDim >= 120) score += 4
  if (maxDim >= 400) score += 3
  if (/\.svg(\?|$)/.test(u)) score -= 2
  return score
}

/** Prefer a crisp Shopify CDN size for header logos. */
function normalizeLogoUrl(url: string): string {
  try {
    const u = new URL(url)
    if (!/cdn\.shop/i.test(u.hostname) && !/\/cdn\/shop\//i.test(u.pathname)) {
      return url
    }
    const width = Number(u.searchParams.get('width') || 0)
    if (!width || width < 400) u.searchParams.set('width', '600')
    return u.toString()
  } catch {
    return url
  }
}

function extractLogoUrl(html: string, base: string): string | undefined {
  const candidates: string[] = []
  const preferred: string[] = []
  const push = (url?: string | null, prefer = false) => {
    if (!url) return
    const abs = absolutize(base, url)
    if (!abs || abs.startsWith('data:')) return
    candidates.push(abs)
    if (prefer) preferred.push(abs)
  }

  push(metaContent(html, 'og:logo'), true)

  // JSON-LD Organization / Brand logo (strong signal)
  const scriptRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let sm: RegExpExecArray | null
  while ((sm = scriptRe.exec(html))) {
    try {
      walkLogoJsonLd(JSON.parse(sm[1]!.trim()), base, candidates)
    } catch {
      /* ignore */
    }
  }

  const imgRe = /<img\b[^>]*>/gi
  let im: RegExpExecArray | null
  while ((im = imgRe.exec(html))) {
    const tag = im[0]
    const cls = /\bclass=["']([^"']+)["']/i.exec(tag)?.[1] || ''
    const alt = /\balt=["']([^"']+)["']/i.exec(tag)?.[1] || ''
    const id = /\bid=["']([^"']+)["']/i.exec(tag)?.[1] || ''
    const blob = `${cls} ${alt} ${id}`.toLowerCase()
    if (!/\blogo\b/.test(blob) && !/\bbrand[-_]?mark\b/.test(blob)) continue
    const src =
      /\b(?:src|data-src|data-original)=["']([^"']+)["']/i.exec(tag)?.[1] || ''
    if (!src || src.startsWith('data:')) continue
    const preferHeader =
      /header__heading-logo|heading-logo|header.*logo|navbar-brand|site-logo|logo-header/.test(
        blob,
      )
    push(decodeHtmlEntities(src), preferHeader)
  }

  // Apple touch / large icons last
  const linkRe =
    /<link[^>]+rel=["'](?:apple-touch-icon(?:-precomposed)?|icon)["'][^>]*>/gi
  let lm: RegExpExecArray | null
  while ((lm = linkRe.exec(html))) {
    const tag = lm[0]
    const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1]
    const sizes = /\bsizes=["']([^"']+)["']/i.exec(tag)?.[1] || ''
    if (!href || href.endsWith('.ico')) continue
    const dim = Number((sizes.match(/(\d+)/) || [])[1] || 0)
    if (dim && dim < 64) continue
    push(decodeHtmlEntities(href))
  }

  const pool = preferred.length ? preferred : candidates
  if (!pool.length) return undefined
  const best = [...pool].sort((a, b) => logoScore(b) - logoScore(a))[0]
  return best ? normalizeLogoUrl(best) : undefined
}

function walkLogoJsonLd(node: unknown, base: string, out: string[]) {
  if (!node) return
  if (Array.isArray(node)) {
    for (const item of node) walkLogoJsonLd(item, base, out)
    return
  }
  if (typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  const type = String(obj['@type'] || '').toLowerCase()
  if (
    (type.includes('organization') || type.includes('brand') || type.includes('store')) &&
    obj.logo
  ) {
    if (typeof obj.logo === 'string') {
      const abs = absolutize(base, obj.logo)
      if (abs) out.push(abs)
    } else if (obj.logo && typeof obj.logo === 'object') {
      const url = (obj.logo as { url?: string }).url
      if (typeof url === 'string') {
        const abs = absolutize(base, url)
        if (abs) out.push(abs)
      }
    }
  }
  if (Array.isArray(obj['@graph'])) walkLogoJsonLd(obj['@graph'], base, out)
}

const LOCALE_TO_MARKET: Record<string, string> = {
  us: 'United States',
  gb: 'United Kingdom',
  uk: 'United Kingdom',
  ca: 'Canada',
  au: 'Australia',
  nz: 'New Zealand',
  ae: 'United Arab Emirates',
  sa: 'Saudi Arabia',
  pk: 'Pakistan',
  in: 'India',
  de: 'Germany',
  fr: 'France',
  es: 'Spain',
  it: 'Italy',
  nl: 'Netherlands',
  sg: 'Singapore',
  my: 'Malaysia',
  id: 'Indonesia',
  ph: 'Philippines',
  jp: 'Japan',
  kr: 'South Korea',
  br: 'Brazil',
  mx: 'Mexico',
}

function marketFromLocale(locale: string): string | null {
  const parts = locale.toLowerCase().replace('-', '_').split('_')
  const region = parts[1] || parts[0]
  if (!region) return null
  return LOCALE_TO_MARKET[region] || null
}

function titleCaseMarket(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function extractMarkets(
  html: string,
  pageUrl: string,
  title = '',
  description = '',
): string[] {
  const scored = new Map<string, number>()
  const bump = (m?: string | null, weight = 1) => {
    if (!m) return
    const key = titleCaseMarket(m)
    if (!key) return
    scored.set(key, (scored.get(key) || 0) + weight)
  }

  const blob = `${title} ${description}`.toLowerCase()
  const countryInCopy: Array<[RegExp, string, number]> = [
    [/\bpakistan\b/, 'Pakistan', 8],
    [/\bunited arab emirates\b|\bdubai\b|\bu\.?a\.?e\.?\b/, 'United Arab Emirates', 6],
    [/\bunited kingdom\b|\bbritain\b/, 'United Kingdom', 5],
    [/\bunited states\b|\busa\b|\bu\.s\.a\.?\b/, 'United States', 4],
    [/\bindia\b/, 'India', 5],
    [/\bcanada\b/, 'Canada', 4],
    [/\baustralia\b/, 'Australia', 4],
    [/\bsaudi\b/, 'Saudi Arabia', 5],
  ]
  for (const [re, market, w] of countryInCopy) {
    if (re.test(blob)) bump(market, w)
  }

  const locale =
    metaContent(html, 'og:locale') ||
    metaContent(html, 'language') ||
    /\blang=["']([a-zA-Z-_]+)/i.exec(html)?.[1]
  if (locale) bump(marketFromLocale(locale), 3)

  const hrefLangRe = /hreflang=["']([a-zA-Z-_]+)["']/gi
  let hm: RegExpExecArray | null
  while ((hm = hrefLangRe.exec(html))) {
    bump(marketFromLocale(hm[1]!), 2)
  }

  // Strong currency signals — ignore weak "$" alone (common on every Shopify theme)
  const currencyHints: Array<[RegExp, string, number]> = [
    [/\bPKR\b|Rs\.?\s?\d|₨|currency["']?\s*[:=]\s*["']PKR/i, 'Pakistan', 7],
    [/\bAED\b|currency["']?\s*[:=]\s*["']AED/i, 'United Arab Emirates', 6],
    [/\bINR\b|₹|currency["']?\s*[:=]\s*["']INR/i, 'India', 5],
    [/\bGBP\b|£\d|currency["']?\s*[:=]\s*["']GBP/i, 'United Kingdom', 5],
    [/\bCAD\b|currency["']?\s*[:=]\s*["']CAD/i, 'Canada', 4],
    [/\bAUD\b|currency["']?\s*[:=]\s*["']AUD/i, 'Australia', 4],
    [/\bEUR\b|€\d|currency["']?\s*[:=]\s*["']EUR/i, 'European Union', 3],
    [/\bUSD\b|currency["']?\s*[:=]\s*["']USD/i, 'United States', 2],
  ]
  for (const [re, market, w] of currencyHints) {
    if (re.test(html)) bump(market, w)
  }

  try {
    const host = new URL(pageUrl).hostname.replace(/^www\./, '').toLowerCase()
    if (host.endsWith('.pk')) bump('Pakistan', 9)
    else if (host.endsWith('.uk') || host.endsWith('.co.uk')) bump('United Kingdom', 8)
    else if (host.endsWith('.ae')) bump('United Arab Emirates', 8)
    else if (host.endsWith('.in')) bump('India', 8)
    else if (host.endsWith('.ca')) bump('Canada', 7)
    else if (host.endsWith('.au')) bump('Australia', 7)
    else if (host.endsWith('.sa')) bump('Saudi Arabia', 7)
  } catch {
    /* ignore */
  }

  const ranked = [...scored.entries()].sort((a, b) => b[1] - a[1])
  if (!ranked.length) return ['United States']
  // Keep top markets; drop weak USD/US noise when a strong local market exists
  const topScore = ranked[0]![1]
  const markets = ranked
    .filter(([m, score]) => score >= Math.max(3, topScore - 4) || m === ranked[0]![0])
    .map(([m]) => m)
    .slice(0, 3)
  return markets
}

function inferAudienceHint(
  title: string,
  description: string,
  markets: string[] = [],
): string | undefined {
  const text = `${title} ${description}`.toLowerCase()
  if (!text.trim()) return undefined

  let who = 'Customers'
  if (/\bwom[ae]n\b|\bladies\b|\bfemale\b/.test(text)) who = 'Women'
  else if (/\bmen\b|\bmens\b|\bmale\b|\bgentlemen\b|\bbeard\b|\bgrooming\b/.test(text))
    who = 'Men'
  else if (/\bkids?\b|\bchildren\b|\bbaby\b/.test(text)) who = 'Parents & families'

  let age = '22–40'
  if (/gen[\s-]?z/i.test(text)) age = '18–28'
  else if (/millennial/i.test(text)) age = '25–40'

  const market = markets[0] ? ` in ${markets[0]}` : ''
  let care = 'who care about this category'
  if (/groom|beard|shave|hair care|skincare|skin care/.test(text))
    care = 'shopping for grooming essentials'
  else if (/fragrance|perfume|scent/.test(text)) care = 'looking for signature scents'
  else if (/luxury|premium|luxe/.test(text)) care = 'who prefer premium quality'
  else if (/clean|natural|organic/.test(text))
    care = 'who care about clean, considered choices'

  return `${who} ${age}${market} ${care}`
}

function collectJsonLdProducts(
  html: string,
  base: string,
  out: FetchedBrandProduct[],
) {
  const scriptRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let match: RegExpExecArray | null
  while ((match = scriptRe.exec(html))) {
    try {
      walkProductNodes(JSON.parse(match[1]!.trim()), base, out)
    } catch {
      /* ignore */
    }
  }
}

function walkProductNodes(node: unknown, base: string, out: FetchedBrandProduct[], depth = 0) {
  if (!node || depth > 10 || out.length >= MAX_BRAND_PRODUCTS) return
  if (Array.isArray(node)) {
    for (const item of node) walkProductNodes(item, base, out, depth + 1)
    return
  }
  if (typeof node !== 'object') return
  const obj = node as Record<string, unknown>
  const type = String(obj['@type'] || '').toLowerCase()
  if (type.includes('product')) {
    const name = typeof obj.name === 'string' ? obj.name.trim() : ''
    let imageUrl = ''
    const img = obj.image
    if (typeof img === 'string') imageUrl = img
    else if (Array.isArray(img) && typeof img[0] === 'string') imageUrl = img[0]
    else if (img && typeof img === 'object' && typeof (img as { url?: string }).url === 'string') {
      imageUrl = (img as { url: string }).url
    }
    const abs = imageUrl ? absolutize(base, imageUrl) : null
    const link =
      typeof obj.url === 'string'
        ? absolutize(base, obj.url) || undefined
        : undefined
    if (name && abs && !isLikelyJunkImage(abs)) {
      out.push({ name: name.slice(0, 80), imageUrl: abs, sourceUrl: link })
    }
  }
  if (Array.isArray(obj['@graph'])) walkProductNodes(obj['@graph'], base, out, depth + 1)
  if (obj.itemListElement) walkProductNodes(obj.itemListElement, base, out, depth + 1)
  if (obj.item) walkProductNodes(obj.item, base, out, depth + 1)
}

type ShopifyProductRow = {
  title?: string
  handle?: string
  images?: Array<{ src?: string } | string>
  image?: { src?: string } | string
}

function shopifyRowToProduct(
  origin: string,
  p: ShopifyProductRow,
): FetchedBrandProduct | null {
  const name = (p.title || '').trim()
  let src = ''
  const imgs = p.images
  if (Array.isArray(imgs) && imgs.length) {
    const first = imgs[0]
    src =
      typeof first === 'string'
        ? first
        : typeof first?.src === 'string'
          ? first.src
          : ''
  } else if (typeof p.image === 'string') src = p.image
  else if (p.image && typeof p.image === 'object' && typeof p.image.src === 'string') {
    src = p.image.src
  }
  if (!name || !src) return null
  const abs = absolutize(origin, src.startsWith('//') ? `https:${src}` : src)
  if (!abs || isLikelyJunkImage(abs)) return null
  const handle = p.handle?.trim()
  return {
    name: name.slice(0, 80),
    imageUrl: abs,
    sourceUrl: handle ? `${origin}/products/${handle}` : undefined,
  }
}

/**
 * Pull the full public Shopify catalog (paginated products.json), not a first-page sample.
 */
async function tryFetchShopifyCatalog(
  pageUrl: string,
  signal: AbortSignal,
): Promise<FetchedBrandProduct[]> {
  let origin: string
  try {
    origin = new URL(pageUrl).origin
  } catch {
    return []
  }
  const pathBases = ['/products.json', '/collections/all/products.json']
  const pageSize = 250

  for (const pathBase of pathBases) {
    try {
      const out: FetchedBrandProduct[] = []
      const seen = new Set<string>()
      for (let page = 1; page <= 20 && out.length < MAX_BRAND_PRODUCTS; page++) {
        const res = await fetch(
          `${origin}${pathBase}?limit=${pageSize}&page=${page}`,
          {
            method: 'GET',
            redirect: 'follow',
            signal,
            headers: {
              Accept: 'application/json,*/*;q=0.8',
              'User-Agent':
                'Mozilla/5.0 (compatible; LUCEBot/1.0; +https://luce-landing.vercel.app)',
            },
          },
        )
        if (!res.ok) break
        const data = (await res.json()) as { products?: ShopifyProductRow[] }
        const list = Array.isArray(data.products) ? data.products : []
        if (!list.length) break
        for (const p of list) {
          if (out.length >= MAX_BRAND_PRODUCTS) break
          const mapped = shopifyRowToProduct(origin, p)
          if (!mapped) continue
          const key = `${mapped.name.toLowerCase()}|${mapped.imageUrl}`
          if (seen.has(key)) continue
          seen.add(key)
          out.push(mapped)
        }
        if (list.length < pageSize) break
      }
      if (out.length) return out
    } catch {
      /* try next path */
    }
  }
  return []
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
export type FetchProductPageOptions = {
  /** Brand onboarding: allow homepage / empty gallery if title or description exist. */
  mode?: 'product' | 'brand'
  /** Internal: one automatic retry after transient network failure. */
  __retried?: boolean
  /** Real scanning progress callback (brand mode). */
  onProgress?: ScanProgressFn
}

export async function fetchProductPage(
  rawUrl: string,
  options: FetchProductPageOptions = {},
): Promise<{ ok: true; data: FetchedProductPage } | { ok: false; error: string; status: number }> {
  const brandMode = options.mode === 'brand'
  const onProgress = options.onProgress
  const trimmed = rawUrl.trim()
  if (!isHttpUrl(trimmed)) {
    return { ok: false, error: 'Enter a valid http(s) product URL.', status: 400 }
  }

  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    brandMode ? BRAND_FETCH_TIMEOUT_MS : FETCH_TIMEOUT_MS,
  )

  try {
    if (brandMode) {
      emitStage(onProgress, 'connecting', 'active')
    }
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

    // Shopify: product.js is the uploaded gallery — prefer it exclusively
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
    let capturedHtml = ''

    // When Shopify product media exists, do NOT scrape page chrome (icons, banners, WhatsApp, etc.)
    if (shopify?.images.length) {
      images.push(...shopify.images.filter((u) => !isLikelyJunkImage(u)))
      if (res.ok) {
        try {
          const contentType = (res.headers.get('content-type') || '').toLowerCase()
          if (
            contentType.includes('text/html') ||
            contentType.includes('application/xhtml') ||
            !contentType
          ) {
            const buf = Buffer.from(await res.arrayBuffer())
            if (buf.byteLength <= MAX_HTML_BYTES) {
              const html = buf.toString('utf8')
              capturedHtml = html
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
          }
        } catch {
          /* title/description optional */
        }
      }
    } else if (res.ok) {
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
          capturedHtml = html
          const structured: string[] = []
          const loose: string[] = []

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
              if (abs && !isLikelyJunkImage(abs)) structured.push(abs)
            }
          }
          collectJsonLdImages(html, finalUrl, structured)
          collectJsonScriptImages(html, finalUrl, structured)

          // Raw <img> / CDN sweep only as fallback, and only product-looking paths
          const rawImgs: string[] = []
          collectShopifyCdnUrls(html, rawImgs)
          collectImgTags(html, finalUrl, rawImgs)
          for (const u of rawImgs) {
            if (isLikelyProductMediaPath(u)) loose.push(u)
          }

          if (structured.length) {
            images.push(...structured)
            // Add a few extra gallery files that match product media paths
            for (const u of loose) {
              if (!structured.some((s) => imageDedupeKey(s) === imageDedupeKey(u))) {
                images.push(u)
              }
            }
          } else {
            images.push(...loose)
          }

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
      } else if (!brandMode) {
        return {
          ok: false,
          error: 'That URL is not a product page we can read.',
          status: 400,
        }
      }
    }

    const imageCap = brandMode ? MAX_BRAND_IMAGES : MAX_IMAGES
    const unique = uniqueKeepOrder(
      images.filter((u) => !isLikelyJunkImage(u)),
      imageCap,
    )

    if (brandMode) {
      try {
        const { brandCacheGet, brandCacheKey } = await import('./brandExtractCache.js')
        const cached = brandCacheGet<FetchedProductPage>(brandCacheKey(finalUrl))
        if (cached?.url) {
          emitStage(onProgress, 'connecting', 'done', {
            preview: {
              logoUrl: cached.logoUrl,
              businessName: cached.title,
              colors: cached.colors,
              imageUrls: cached.images?.slice(0, 3),
            },
            stats: {
              images: cached.images?.length || 0,
              products: cached.products?.length || 0,
              colors: cached.colors?.length || 0,
              fonts: cached.fonts?.length || 0,
            },
          })
          emitStage(onProgress, 'done', 'done', {
            stats: {
              images: cached.images?.length || 0,
              products: cached.products?.length || 0,
              colors: cached.colors?.length || 0,
              fonts: cached.fonts?.length || 0,
            },
          })
          return { ok: true, data: cached }
        }
      } catch {
        /* cache optional */
      }

      emitStage(onProgress, 'connecting', 'done')
      emitStage(onProgress, 'pages', 'active')

      const htmlForBrand = capturedHtml
      const logoUrl = htmlForBrand ? extractLogoUrl(htmlForBrand, finalUrl) : undefined
      const markets = htmlForBrand
        ? extractMarkets(htmlForBrand, finalUrl, title || '', description || '')
        : extractMarkets('', finalUrl, title || '', description || '')
      const audienceHint = inferAudienceHint(title || '', description || '', markets)

      emitStage(onProgress, 'pages', 'done', {
        preview: {
          logoUrl,
          businessName: title,
          imageUrls: unique.slice(0, 3).filter(Boolean),
        },
        stats: { pages: htmlForBrand ? 1 : 0, images: unique.length },
      })
      emitStage(onProgress, 'assets', 'active', {
        preview: { logoUrl, imageUrls: unique.slice(0, 3) },
      })

      // Do not share the parent abort signal with Playwright/asset analysis —
      // those steps have their own timeouts and must fail open without killing the scan.
      let visual: Awaited<ReturnType<typeof extractBrandVisuals>>
      try {
        visual = htmlForBrand
          ? await extractBrandVisuals(htmlForBrand, finalUrl)
          : {
              colors: [] as ExtractedColor[],
              fonts: [] as ExtractedFont[],
              colorHexes: [] as string[],
              fontNames: [] as string[],
              warnings: ['No HTML available for brand extraction.'],
              extractionMethod: 'html' as const,
              stylesheetsFetched: 0,
              paletteIncomplete: true,
            }
      } catch (err) {
        visual = {
          colors: [],
          fonts: [],
          colorHexes: [],
          fontNames: [],
          warnings: [
            `Visual extraction failed: ${err instanceof Error ? err.message : 'unknown error'}`,
          ],
          extractionMethod: 'html',
          stylesheetsFetched: 0,
          paletteIncomplete: true,
        }
      }

      emitStage(onProgress, 'assets', 'done', {
        preview: { logoUrl, colors: visual.colorHexes.slice(0, 6) },
        stats: {
          stylesheets: visual.stylesheetsFetched,
          colors: visual.colorHexes.length,
          fonts: visual.fontNames.length,
        },
      })
      emitStage(onProgress, 'colors', 'done', {
        stats: { colors: visual.colorHexes.length, stylesheets: visual.stylesheetsFetched },
        preview: { colors: visual.colorHexes.slice(0, 8), logoUrl },
      })
      emitStage(onProgress, 'typography', 'done', {
        stats: { fonts: visual.fontNames.length },
        message: visual.fontNames.join(', ') || 'No fonts verified yet',
      })
      emitStage(onProgress, 'products', 'active')

      const catalog = await tryFetchShopifyCatalog(finalUrl, controller.signal)
      const ldProducts: FetchedBrandProduct[] = []
      if (htmlForBrand) collectJsonLdProducts(htmlForBrand, finalUrl, ldProducts)

      const products: FetchedBrandProduct[] = []
      const seenProduct = new Set<string>()
      const pushProduct = (p: FetchedBrandProduct) => {
        const key = `${p.name.toLowerCase()}|${imageDedupeKey(p.imageUrl)}`
        if (seenProduct.has(key) || products.length >= MAX_BRAND_PRODUCTS) return
        seenProduct.add(key)
        products.push(p)
      }
      for (const p of catalog) pushProduct(p)
      for (const p of ldProducts) pushProduct(p)

      // Fallback: treat distinct product-looking images as catalog entries
      if (products.length < 3) {
        for (let i = 0; i < unique.length && products.length < MAX_BRAND_PRODUCTS; i++) {
          const imageUrl = unique[i]!
          if (logoUrl && imageDedupeKey(logoUrl) === imageDedupeKey(imageUrl)) continue
          let name = `Product ${i + 1}`
          try {
            const baseName = new URL(imageUrl).pathname
              .split('/')
              .filter(Boolean)
              .pop()
              ?.replace(/\.[a-z0-9]+$/i, '')
            if (
              baseName &&
              baseName.length > 2 &&
              !/^(image|img|photo|product|cdn|file|asset|media|static)/i.test(baseName)
            ) {
              name = baseName
                .replace(/[-_]+/g, ' ')
                .replace(/\b\w/g, (c) => c.toUpperCase())
                .slice(0, 48)
            }
          } catch {
            /* keep */
          }
          pushProduct({
            name,
            imageUrl,
            sourceUrl: finalUrl,
          })
        }
      }

      const productImages = products.map((p) => p.imageUrl)
      const mergedImages = uniqueKeepOrder(
        [...productImages, ...unique].filter((u) => !isLikelyJunkImage(u)),
        MAX_BRAND_IMAGES,
      )

      if (!mergedImages.length && !title && !description && !products.length) {
        emitStage(onProgress, 'products', 'error', {
          message: 'Not enough brand details found',
        })
        return {
          ok: false,
          error:
            'Could not read enough brand details from that site. Try another URL or continue manually.',
          status: 404,
        }
      }

      emitStage(onProgress, 'products', 'done', {
        stats: {
          products: products.length,
          images: mergedImages.length,
          colors: visual.colorHexes.length,
          fonts: visual.fontNames.length,
        },
        preview: {
          logoUrl,
          imageUrls: mergedImages.slice(0, 4),
          colors: visual.colorHexes.slice(0, 6),
          businessName: title,
        },
      })

      // Evidence-backed visuals stay authoritative for colors/fonts.
      // Asset analysis + AI classify evidence — never invent unverified colors/fonts.
      let colorDetails = [...visual.colors]
      let fontDetails = [...visual.fonts]
      let colorHexes = [...visual.colorHexes]
      let fontNames = [...visual.fontNames]
      let aiMarkets = markets
      let aiAudience = audienceHint
      // Prefer cleaned storefront name ("Miss Rose Com Pk" → "Miss Rose") over raw <title>.
      const siteName = htmlForBrand
        ? metaContent(htmlForBrand, 'og:site_name')
        : undefined
      let aiTitle =
        cleanBrandDisplayName(siteName || title || '', {
          url: finalUrl,
          productNames: products.map((p) => p.name),
        }) || title
      let aiDescription = description
      let aiCategory: string | undefined
      let aiVoice: string | undefined
      let aiStyle: string | undefined
      let aiKeywords: string[] = []
      let aiIndustry: string | undefined
      let aiRefined = false
      let aiWarning: string | undefined
      let aiDraft: import('./refineBrandKit.js').BrandKitDraft | null = null
      const warnings = [...visual.warnings]
      let extractionMethod: FetchedProductPage['extractionMethod'] =
        visual.extractionMethod
      let logoAnalysis: BrandProfile['logoAnalysis']
      let visualStyle: BrandProfile['visualStyle']
      let productImageColors: ExtractedColor[] = []

      try {
        const { analyzeBrandAssets } = await import('./brandAssetAnalyze.js')
        const assets = await analyzeBrandAssets({
          pageUrl: finalUrl,
          logoUrl,
          imageUrls: mergedImages.slice(0, 3),
        })
        warnings.push(...assets.warnings)
        logoAnalysis = assets.logoAnalysis
        visualStyle = assets.visualStyle
        productImageColors = assets.productColors
      } catch (err) {
        warnings.push(
          `Asset analysis skipped: ${err instanceof Error ? err.message : 'unknown error'}`,
        )
      }

      emitStage(onProgress, 'identity', 'active', {
        preview: {
          logoUrl,
          colors: colorHexes.slice(0, 6),
          imageUrls: mergedImages.slice(0, 4),
          businessName: title,
        },
      })

      try {
        const refineResult = await refineBrandKitWithAi({
          url: finalUrl,
          title: title || undefined,
          description: description || undefined,
          candidateColors: colorHexes,
          candidateFonts: fontNames,
          candidateMarkets: markets,
          productNames: products.map((p) => p.name),
          colorDetails,
          fontDetails,
          logoAnalysis,
          visualStyle,
          imageUrls: [logoUrl, ...mergedImages]
            .filter((u): u is string => typeof u === 'string' && Boolean(u.trim()))
            .filter((u, i, arr) => arr.indexOf(u) === i)
            .slice(0, 3),
        })
        const refined = refineResult.draft
        if (refined) {
          aiDraft = refined
          aiRefined = true
          extractionMethod =
            visual.extractionMethod === 'html+css+render'
              ? 'html+css+render+ai'
              : visual.extractionMethod === 'html+css'
                ? 'html+css+ai'
                : 'html+css+ai'
          if (refined.businessName || refined.brandName) {
            aiTitle =
              cleanBrandDisplayName(refined.businessName || refined.brandName || '', {
                url: finalUrl,
                productNames: products.map((p) => p.name),
              }) || refined.businessName || refined.brandName
          }
          // Keep factual page description; do not overwrite with styleNotes
          if (refined.pitch || refined.description) {
            aiDescription = refined.pitch || refined.description
          }
          if (refined.markets?.length) aiMarkets = refined.markets
          if (refined.audienceHint || refined.targetAudience) {
            aiAudience = refined.targetAudience || refined.audienceHint
          }
          aiCategory = refined.category
          aiVoice = refined.brandVoice
          // styleNotes = creative direction (separate from page description)
          aiStyle =
            [refined.styleNotes, refined.visualDirection, refined.photographyStyle]
              .filter(Boolean)
              .join(' — ') || refined.styleNotes
          aiKeywords = refined.brandKeywords || []
          aiIndustry = refined.industry
          if (refined.designCharacteristics?.length) {
            aiStyle = [aiStyle, refined.designCharacteristics.join(', ')]
              .filter(Boolean)
              .join('. ')
          }
          // AI may reorder candidate colors only — never add new hexes
          if (refined.colors?.length) {
            const allowed = new Set(colorHexes.map((h) => h.toUpperCase()))
            const filtered = refined.colors
              .map((c) => c.toUpperCase())
              .filter((c) => allowed.has(c))
            if (filtered.length) {
              colorHexes = filtered
              colorDetails = colorDetails
                .filter((c) => filtered.includes(c.hex.toUpperCase()))
                .sort(
                  (a, b) =>
                    filtered.indexOf(a.hex.toUpperCase()) -
                    filtered.indexOf(b.hex.toUpperCase()),
                )
            }
          }
          if (refined.fonts?.length) {
            const allowed = new Set(fontNames.map((n) => n.toLowerCase()))
            const filtered = refined.fonts.filter((n) =>
              allowed.has(n.toLowerCase()),
            )
            if (filtered.length) {
              fontNames = filtered
              fontDetails = fontDetails
                .filter((f) =>
                  filtered.some((n) => n.toLowerCase() === f.name.toLowerCase()),
                )
                .sort(
                  (a, b) =>
                    filtered.findIndex(
                      (n) => n.toLowerCase() === a.name.toLowerCase(),
                    ) -
                    filtered.findIndex(
                      (n) => n.toLowerCase() === b.name.toLowerCase(),
                    ),
                )
            }
          }
        } else {
          aiWarning =
            refineResult.error ||
            'AI brand interpretation unavailable — showing website evidence only. You can complete unknown fields manually.'
          warnings.push(aiWarning)
          console.warn('[fetchProductPage] AI refine empty', {
            error: refineResult.error,
            model: refineResult.model,
          })
        }
      } catch (err) {
        aiWarning = `AI refine skipped: ${err instanceof Error ? err.message : 'unknown error'}`
        warnings.push(aiWarning)
        console.warn('[fetchProductPage] AI brand refine skipped', aiWarning)
      }

      // Deterministic copy facts fill gaps when free AI refine fails — still evidence-backed.
      // Static import (not dynamic) so Vite SSR does not fail after long Playwright work.
      try {
        const copyFacts = extractBrandCopyFacts({
          title: aiTitle || title,
          description: description || aiDescription,
          productNames: products.map((p) => p.name),
        })
        if (!aiDraft) {
          aiDraft = {
            industry: copyFacts.industry,
            niche: copyFacts.niche,
            positioning: copyFacts.positioning,
            targetAudience: copyFacts.targetAudience,
            brandKeywords: copyFacts.brandKeywords,
            brandPersonality: copyFacts.brandPersonality,
            brandVoice: copyFacts.brandVoice,
            brandTone: copyFacts.brandTone,
            fieldEvidence: copyFacts.fieldEvidence,
          }
          if (copyFacts.industry || copyFacts.niche || copyFacts.brandPersonality?.length) {
            aiRefined = true
            // Soften free-model empty failures — evidence was kept + copy-facts filled gaps.
            if (aiWarning) {
              aiWarning =
                'Free AI polish was unavailable — niche and personality were filled from your website copy. Colors, fonts, and products stay evidence-backed.'
            }
          } else if (aiWarning) {
            aiWarning =
              'Free AI polish was unavailable — website colors, fonts, and products were kept. You can complete remaining fields manually.'
          }
        } else {
          aiDraft.industry = aiDraft.industry || copyFacts.industry
          aiDraft.niche = aiDraft.niche || copyFacts.niche
          aiDraft.positioning = aiDraft.positioning?.length
            ? aiDraft.positioning
            : copyFacts.positioning
          aiDraft.targetAudience = aiDraft.targetAudience || copyFacts.targetAudience
          aiDraft.brandKeywords = aiDraft.brandKeywords?.length
            ? aiDraft.brandKeywords
            : copyFacts.brandKeywords
          aiDraft.brandPersonality = aiDraft.brandPersonality?.length
            ? aiDraft.brandPersonality
            : copyFacts.brandPersonality
          aiDraft.brandVoice = aiDraft.brandVoice || copyFacts.brandVoice
          aiDraft.brandTone = aiDraft.brandTone || copyFacts.brandTone
          aiDraft.fieldEvidence = {
            ...(copyFacts.fieldEvidence || {}),
            ...(aiDraft.fieldEvidence || {}),
          }
        }
        if (!aiIndustry && copyFacts.industry) aiIndustry = copyFacts.industry
        if (!aiKeywords.length && copyFacts.brandKeywords?.length) {
          aiKeywords = copyFacts.brandKeywords
        }
        if (!aiVoice && copyFacts.brandVoice) aiVoice = copyFacts.brandVoice
        if (!aiAudience && copyFacts.targetAudience) aiAudience = copyFacts.targetAudience

        if (!aiStyle) {
          aiStyle = buildEvidenceStyleNotes({
            title: aiTitle || title,
            description,
            colors: colorHexes,
            fonts: fontNames,
            industry: aiIndustry || copyFacts.industry,
          })
          if (aiStyle && aiDraft) {
            aiDraft.styleNotes = aiDraft.styleNotes || aiStyle
            aiDraft.graphicDesignDirection =
              aiDraft.graphicDesignDirection || aiStyle.slice(0, 220)
            aiDraft.fieldEvidence = {
              ...(aiDraft.fieldEvidence || {}),
              styleNotes:
                'Built from verified palette/fonts plus on-page category language — not a meta description copy.',
              graphicDesignDirection:
                'Production direction derived from extracted brand evidence.',
            }
          }
        }
      } catch (copyErr) {
        warnings.push(
          `Copy-fact extraction skipped: ${copyErr instanceof Error ? copyErr.message : 'unknown error'}`,
        )
      }

      emitStage(onProgress, 'identity', 'done')
      emitStage(onProgress, 'kit', 'active')

      const brandProfile = buildBrandProfile({
        websiteUrl: finalUrl,
        brandName: aiTitle?.slice(0, 160),
        colors: colorDetails,
        fonts: fontDetails,
        warnings,
        extractionMethod: extractionMethod || visual.extractionMethod,
        stylesheetsFetched: visual.stylesheetsFetched,
        aiRefined,
        paletteIncomplete: visual.paletteIncomplete,
        brandVoice: aiVoice,
        brandKeywords: aiKeywords,
        targetAudience: aiAudience,
        industry: aiIndustry,
        styleNotes: aiStyle,
        logoAnalysis,
        visualStyle,
        productImageColors,
      })

      colorHexes = brandProfile.colors.length ? brandProfile.colors : colorHexes
      fontNames = brandProfile.fonts.length ? brandProfile.fonts : fontNames

      const fontSources: Record<string, string> = {}
      for (const f of fontDetails) fontSources[f.name] = f.source
      const colorSources: Record<string, string> = {}
      for (const c of colorDetails) colorSources[c.hex] = c.source

      let completeBrandKit: CompleteBrandKit | undefined
      try {
        completeBrandKit = buildCompleteBrandKit({
          brandName: aiTitle,
          description: aiDescription,
          industry: aiIndustry || aiCategory,
          primaryColors: brandProfile.primaryColors.map((c) => c.hex),
          secondaryColors: brandProfile.secondaryColors.map((c) => c.hex),
          accentColors: brandProfile.accentColors.map((c) => c.hex),
          backgroundColors: brandProfile.backgroundColors.map((c) => c.hex),
          textColors: brandProfile.textColors.map((c) => c.hex),
          campaignColors: brandProfile.campaignColors.map((c) => c.hex),
          productColors: brandProfile.productColors.map((c) => c.hex),
          colorsVerified: colorDetails.some((c) => c.verified),
          headingFont: brandProfile.headingFont?.name,
          bodyFont: brandProfile.bodyFont?.name,
          navigationFont: brandProfile.navigationFont?.name,
          buttonFont: brandProfile.buttonFont?.name,
          fontsVerified: fontDetails.some((f) => f.verified),
          fontSources,
          colorSources,
          logoNotes: logoAnalysis?.notes,
          logoAnalyzed: logoAnalysis?.analyzed,
          ai: aiDraft,
          aiFailed: !aiRefined,
          markets: aiMarkets,
        })
      } catch (kitErr) {
        const kitMsg =
          kitErr instanceof Error ? kitErr.message : 'Brand kit assembly failed'
        warnings.push(`Brand kit assembly warning: ${kitMsg}`)
        if (!aiWarning) {
          aiWarning =
            'Evidence extracted, but complete brand kit assembly failed. You can fill fields manually.'
        }
        console.warn('[fetchProductPage] kit assembly', kitMsg)
      }

      const payload: FetchedProductPage = {
        url: finalUrl,
        title: aiTitle?.slice(0, 160),
        description: aiDescription?.slice(0, 500),
        images: mergedImages,
        logoUrl,
        colors: colorHexes.length ? colorHexes : undefined,
        fonts: fontNames.length ? fontNames : undefined,
        colorDetails: colorDetails.length ? colorDetails : undefined,
        fontDetails: fontDetails.length ? fontDetails : undefined,
        markets: aiMarkets.length ? aiMarkets : undefined,
        audienceHint: aiAudience,
        products: products.length ? products : undefined,
        aiRefined,
        category: aiCategory,
        brandVoice: aiVoice,
        styleNotes: aiStyle,
        extractionMethod,
        warnings: warnings.length ? warnings.slice(0, 16) : undefined,
        stylesheetsFetched: visual.stylesheetsFetched,
        paletteIncomplete: brandProfile.paletteIncomplete,
        brandProfile,
        brandKeywords: aiKeywords.length ? aiKeywords : undefined,
        extractionConfidence: brandProfile.extractionConfidence,
        completeBrandKit,
        aiWarning,
      }

      emitStage(onProgress, 'kit', 'done', {
        stats: {
          products: products.length,
          images: mergedImages.length,
          colors: colorHexes.length,
          fonts: fontNames.length,
          stylesheets: visual.stylesheetsFetched,
        },
        preview: {
          logoUrl,
          imageUrls: mergedImages.slice(0, 4),
          colors: colorHexes.slice(0, 8),
          businessName: aiTitle,
        },
      })
      emitStage(onProgress, 'done', 'done', {
        stats: {
          products: products.length,
          images: mergedImages.length,
          colors: colorHexes.length,
          fonts: fontNames.length,
        },
        preview: {
          logoUrl,
          imageUrls: mergedImages.slice(0, 4),
          colors: colorHexes.slice(0, 8),
          businessName: aiTitle,
        },
      })

      try {
        const { brandCacheKey, brandCacheSet } = await import('./brandExtractCache.js')
        brandCacheSet(brandCacheKey(finalUrl), payload)
      } catch {
        /* cache optional */
      }

      return { ok: true, data: payload }
    }

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
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[fetchProductPage]', msg)
    // One automatic retry for transient network failures in brand mode
    if (
      brandMode &&
      !aborted &&
      !options.__retried &&
      /fetch failed|network|ECONNRESET|ETIMEDOUT|socket/i.test(msg)
    ) {
      await new Promise((r) => setTimeout(r, 1200))
      return fetchProductPage(rawUrl, { ...options, __retried: true })
    }
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
