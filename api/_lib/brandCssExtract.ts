/**
 * Phase 1 / 1.1 brand extraction: homepage stylesheets + optional Playwright
 * rendered verification. Evidence-backed only — no artificial palette padding.
 */

import {
  fontsRoughlyMatch,
  inspectRenderedBrand,
} from './brandRenderedInspect.js'

export type ColorClassification =
  | 'background'
  | 'text'
  | 'heading'
  | 'button'
  | 'navigation'
  | 'accent'
  | 'secondary-background'
  | 'unknown'

export type ColorThemeKind = 'theme' | 'promo' | 'third-party' | 'system-ui' | 'unknown'

export type ExtractedColor = {
  hex: string
  classification: ColorClassification
  source: string
  confidence: number
  /** CSS property that contributed (e.g. background-color, color). */
  property?: string
  /** CSS custom property when the hit came from a variable. */
  cssVariable?: string
  /** Human-readable usage context (selector / role). */
  usageContext?: string
  /** True when confirmed via rendered computed style. */
  verified?: boolean
  /** True when evidence looks promotional (sale/discount) rather than permanent brand. */
  promotional?: boolean
  /** Theme vs promo vs third-party vs form/system chrome. */
  themeKind?: ColorThemeKind
  /** How many independent evidence hits contributed. */
  occurrences?: number
  /** Short proof snippet for review UI (selector / var / rendered node). */
  evidence?: string
  /** Verification label for clients. */
  verificationStatus?: 'verified' | 'ai-inferred' | 'unknown'
}

export type FontUsage = 'heading' | 'body' | 'navigation' | 'button' | 'unknown'

export type ExtractedFont = {
  name: string
  usage: FontUsage
  source: string
  confidence: number
  /** True when name is declared but not confirmed via computed style. */
  estimated?: boolean
  /** True when Playwright computed style matched this family for the usage. */
  verified?: boolean
  property?: string
  cssVariable?: string
  usageContext?: string
  /** True when document.fonts listed this family (or close match). */
  fontFileLoaded?: boolean
  /** Full computed font-family stack when available. */
  computedStack?: string
  evidence?: string
  verificationStatus?: 'verified' | 'ai-inferred' | 'unknown'
}

export type BrandVisualExtraction = {
  colors: ExtractedColor[]
  fonts: ExtractedFont[]
  /** Backward-compatible hex list (no invented padding). */
  colorHexes: string[]
  /** Backward-compatible font names. */
  fontNames: string[]
  warnings: string[]
  extractionMethod: 'html' | 'html+css' | 'html+css+render'
  stylesheetsFetched: number
  /** True when fewer than a typical brand role set was verified. */
  paletteIncomplete?: boolean
}

const MAX_STYLESHEETS = 8
const MAX_CSS_BYTES = 900_000
const MAX_IMPORT_DEPTH = 2
const CSS_TIMEOUT_MS = 8_000
const USER_AGENT =
  'Mozilla/5.0 (compatible; LUCEBot/1.0; +https://luce-landing.vercel.app)'

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata',
])

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '')
  if (BLOCKED_HOSTS.has(h) || h.endsWith('.localhost') || h.endsWith('.local')) {
    return true
  }
  // IPv4
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (m) {
    const a = [+m[1]!, +m[2]!, +m[3]!, +m[4]!]
    if (a.some((n) => n > 255)) return true
    if (a[0] === 10) return true
    if (a[0] === 127) return true
    if (a[0] === 0) return true
    if (a[0] === 169 && a[1] === 254) return true
    if (a[0] === 172 && a[1]! >= 16 && a[1]! <= 31) return true
    if (a[0] === 192 && a[1] === 168) return true
    if (a[0] === 100 && a[1]! >= 64 && a[1]! <= 127) return true // CGNAT
  }
  // IPv6 local / link-local
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) {
    return true
  }
  return false
}

export function isSafePublicUrl(raw: string, pageOrigin?: string): boolean {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (u.username || u.password) return false
    if (isPrivateHostname(u.hostname)) return false
    // Prefer same-origin + known public CDNs for CSS; allow any public https host
    // that is not private (Shopify themes often load from cdn.shopify.com).
    void pageOrigin
    return true
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

export function normalizeHex(raw: string): string | null {
  const t = raw.trim().toLowerCase()
  if (!t || t === 'transparent' || t === 'inherit' || t === 'currentcolor' || t === 'none') {
    return null
  }
  const short = /^#([0-9a-f]{3})$/i.exec(t)
  if (short) {
    const [r, g, b] = short[1]!.split('')
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase()
  }
  const full = /^#([0-9a-f]{6})$/i.exec(t)
  if (full) return `#${full[1]!.toUpperCase()}`
  const eight = /^#([0-9a-f]{8})$/i.exec(t)
  if (eight) {
    const rgb = eight[1]!.slice(0, 6)
    const a = parseInt(eight[1]!.slice(6, 8), 16) / 255
    if (a < 0.15) return null
    return `#${rgb.toUpperCase()}`
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(
    t,
  )
  if (rgb) {
    const aRaw = rgb[4]
    if (aRaw != null) {
      const a = aRaw.endsWith('%') ? parseFloat(aRaw) / 100 : parseFloat(aRaw)
      if (a < 0.15) return null
    }
    const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)))
    return `#${[clamp(+rgb[1]!), clamp(+rgb[2]!), clamp(+rgb[3]!)]
      .map((n) => n.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()}`
  }
  return null
}

function colorDistance(a: string, b: string): number {
  const pa = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/.exec(a)
  const pb = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/.exec(b)
  if (!pa || !pb) return 999
  const dr = parseInt(pa[1]!, 16) - parseInt(pb[1]!, 16)
  const dg = parseInt(pa[2]!, 16) - parseInt(pb[2]!, 16)
  const db = parseInt(pa[3]!, 16) - parseInt(pb[3]!, 16)
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

function luminance(hex: string): number {
  const m = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/.exec(hex)
  if (!m) return 0
  return (
    (0.299 * parseInt(m[1]!, 16) +
      0.587 * parseInt(m[2]!, 16) +
      0.114 * parseInt(m[3]!, 16)) /
    255
  )
}

function saturation(hex: string): number {
  const m = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/.exec(hex)
  if (!m) return 0
  const r = parseInt(m[1]!, 16)
  const g = parseInt(m[2]!, 16)
  const b = parseInt(m[3]!, 16)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === 0) return 0
  return (max - min) / max
}

function isPromoLikely(hex: string): boolean {
  const m = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/.exec(hex)
  if (!m) return false
  const r = parseInt(m[1]!, 16)
  const g = parseInt(m[2]!, 16)
  const b = parseInt(m[3]!, 16)
  // Classic sale/error reds
  if (r > 160 && g < 90 && b < 90) return true
  // Neon warning oranges with extreme saturation and mid luminance
  if (saturation(hex) > 0.85 && luminance(hex) > 0.35 && luminance(hex) < 0.65 && r > 200 && g > 80 && b < 60) {
    return true
  }
  return false
}

function isBrowserDefaultNoise(hex: string): boolean {
  // Common browser / UA stylesheet leftovers we never want as brand
  return (
    hex === '#0000EE' ||
    hex === '#551A8B' ||
    hex === '#0000FF' ||
    hex === '#FF0000'
  )
}

type ColorHit = {
  hex: string
  classification: ColorClassification
  source: string
  weight: number
  promoContext: boolean
  property?: string
  cssVariable?: string
  usageContext?: string
  chromeNoise?: boolean
  fromRendered?: boolean
  themeKind?: ColorThemeKind
  /** Exact brand token (--color--brand / --color--accent / --color--bg / --color--text). */
  brandTokenStrength?: number
}

type FontHit = {
  name: string
  usage: FontUsage
  source: string
  weight: number
  /** Declared in @font-face / Google Fonts link (resource exists). */
  fromFaceOrGoogle: boolean
  /** Came only from a CSS variable / declaration — not rendered-verified. */
  declaredOnly?: boolean
  property?: string
  cssVariable?: string
  usageContext?: string
  fromRendered?: boolean
  fontFileLoaded?: boolean
  computedStack?: string
}

/** Third-party / chrome stylesheets that should not drive brand colors. */
function isChromeStylesheetUrl(url: string): boolean {
  return /portable-wallets|accelerated-checkout|shopifycloud\/.*(payment|wallet)|shopify-pay|cookiebot|onetrust|consent|klaviyo|yotpo|judgeme|jdgm|okendo|gorgias|tiktok|facebook\.net|hotjar|clarity|paypal|afterpay|klarna|shop\.app|google-analytics|googletagmanager|golootlo|shopsmart|one-click-social|social_login|bluecart|bcpb-app|slick-carousel|slick\/slick|popup-block|attn\.|fugu|privy|smile\.io|stamped\.io|loox|reviews\.io|trustpilot|hulk|replo|pagefly|shogun|gem-pages/i.test(
    url,
  )
}

function isChromeSelector(sel: string): boolean {
  return /scrollbar|::-webkit-scrollbar|cookie|consent|gdpr|onetrust|cookiebot|payment|wallet|paypal|afterpay|klarna|shopify-payment|portable-wallet|accelerated-checkout|wishlist|wkh-|oke[-_]|okendo|yotpo|judgeme|jdgm|klaviyo|gorgias|tiktok|facebook|golootlo|shopsmart|bluecart|bcpb-|one-click|social.?login|disabled|:disabled|\.disable|loading-overlay|spinner|skeleton|placeholder-svg|sr-only|visually-hidden|swiper-button|swiper-pagination|cart-threshold|ingredient-title:after|ingredient-title:before|attn-waitlist|skip-to-content|skip-link|mfp-close|magnific|back-to-top|\.is-valid|\.is-invalid|\.success\b|\.error\b|form-validation|needs-validation|recommended-products__nav|multi-column__nav|loyalty-shading|mm-button|message-bar|announcement|announce-bar|shipping-bar|promo-bar|ticker|marquee|utility-bar|notification-bar|usp-bar|store-bar|trust-badge|scheme-\w*-announcement/i.test(
    sel,
  )
}

/** Top bars / announcements / message strips — not brand identity. */
function isUiChromeContext(blob: string): boolean {
  return /message-bar|announcement|announce-bar|shipping-bar|promo-bar|ticker|marquee|utility-bar|top-bar|notification-bar|scheme-\w*-announcement|usp-bar|store-bar|trust-badge|free-shipping-bar|countdown-bar/i.test(
    blob,
  )
}

function isSystemUiColorContext(selOrVar: string): boolean {
  return /\.success\b|\.is-valid|\.is-invalid|\.error\b|alert|toast|form.?valid|validation|in-stock|low-stock|out-of-stock|sold[_-]?out|account\s+\.success|\.mfp-|\bmagnific\b/i.test(
    selOrVar,
  )
}

/** Classify ownership from selector / stylesheet / variable — reusable, not site-specific. */
function classifyThemeKind(input: {
  selector?: string
  sourceLabel?: string
  cssVariable?: string
  promo?: boolean
}): ColorThemeKind {
  const blob = `${input.selector || ''} ${input.sourceLabel || ''} ${input.cssVariable || ''}`.toLowerCase()
  if (input.promo || isUiChromeContext(blob)) return 'promo'
  if (
    isChromeStylesheetUrl(blob) ||
    isChromeSelector(blob) ||
    /golootlo|judgeme|jdgm-|yotpo|okendo|klaviyo|shopsmart|bluecart|bcpb|one-click|social.?login|slick-|swiper|mfp-|magnific|popup|voucher|wallet|payment/.test(
      blob,
    )
  ) {
    return 'third-party'
  }
  if (isSystemUiColorContext(blob) || /status|success|error|validation|toast|alert/.test(blob)) {
    return 'system-ui'
  }
  // Exact brand tokens / theme roots — not every Shopify `--primary-bg-color` utility
  if (
    /--color--(?:brand|accent|bg|text|headings)|--brand-color|--accent-color|^--brand$|^--accent$|\[data-theme]|:root.*brand|theme-color/.test(
      blob,
    )
  ) {
    return 'theme'
  }
  if (/\bbrand\b|\baccent\b/.test(blob) && !/primary-bg|secondary-bg|section-bg/.test(blob)) {
    return 'theme'
  }
  return 'unknown'
}

/** Well-known framework / widget accent blues that are almost never brand identity. */
function isFrameworkAccentNoise(hex: string): boolean {
  return (
    hex === '#2563EB' || // Tailwind blue-600
    hex === '#3B82F6' || // Tailwind blue-500
    hex === '#1D4ED8' || // Tailwind blue-700
    hex === '#007BFF' || // Bootstrap primary
    hex === '#0D6EFD' || // Bootstrap 5 primary
    hex === '#1877F2' // Facebook blue
  )
}

/** Status greens only when they lack a brand CSS token — never permanent by hex alone. */
function isStatusGreenNoise(hex: string, brandTokenStrength: number): boolean {
  if (brandTokenStrength >= 3) return false
  return (
    hex === '#00964D' ||
    hex === '#28A745' ||
    hex === '#198754' ||
    hex === '#22C55E' ||
    hex === '#16A34A'
  )
}

function firstFontFamily(value: string): string | null {
  let first = value.split(',')[0]?.trim() || ''
  first = first.replace(/!important/gi, '').replace(/^["']|["']$/g, '').trim()
  if (!first) return null
  // Skip unresolved CSS vars — resolve separately
  if (/^var\(/i.test(first)) return null
  if (/^\d/.test(first) || /(px|rem|em|%)$/i.test(first)) return null
  if (
    /^(inherit|initial|unset|none|serif|sans-serif|monospace|cursive|fantasy|system-ui|emoji|ui-sans-serif|ui-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|arial|helvetica|helvetica neue|times|times new roman|courier|courier new|georgia|verdana|tahoma|trebuchet ms|segoe ui|roboto)$/i.test(
      first,
    )
  ) {
    return null
  }
  if (first.length < 2 || first.length > 48) return null
  if (
    /^(font|icon|icons|fa-|fas|far|fab|judgeme|swiper|slick|shopify|oke[-_]?widget)/i.test(
      first,
    )
  ) {
    return null
  }
  if (/icon/i.test(first)) return null
  return first
}

/** Map --font-* custom properties to concrete family names when declared. */
function collectCssVarFontMap(css: string): Map<string, string> {
  const map = new Map<string, string>()
  // Only family tokens — ignore size/weight/line-height vars
  const re =
    /(--(?:[\w-]*(?:font(?:-family)?|typeface)[\w-]*|font-(?:heading|body|display|nav|navigation|title|text)(?:-family)?))\s*:\s*([^;}{]+)/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    const key = m[1]!.toLowerCase()
    if (/size|weight|style|line|spacing|letter|height|width/.test(key)) continue
    if (!/family|heading|body|display|title|nav|typeface|^--font$/.test(key)) continue
    const name = firstFontFamily(m[2]!.trim())
    if (name) map.set(key, titleFont(name))
  }
  return map
}

function resolveFontVar(value: string, varMap: Map<string, string>): string | null {
  const direct = firstFontFamily(value)
  if (direct) return direct
  const vm = /^var\(\s*(--[\w-]+)/i.exec(value.trim())
  if (!vm) return null
  return varMap.get(vm[1]!.toLowerCase()) || null
}

function isIgnoredColorVar(name: string): boolean {
  return /sale|error|critical|danger|warning|alert|discount|payment|wallet|badge|success|info|toast|shadow|overlay|scrim|mask|skeleton|placeholder|transparent|review|scrollbar|cookie|consent|^--oke|oke-|yotpo|judgeme|jdgm|klaviyo|golootlo|in-stock|low-stock|price(?!-)|swiper|disabled|valid|invalid/.test(
    name.toLowerCase(),
  )
}

/** Rank how strongly a CSS custom property names a permanent brand token. */
function brandTokenStrength(name: string): number {
  const n = name.toLowerCase()
  if (/^--color--brand$|^--brand-color$|^--color-brand$|^--brand$/.test(n)) return 5
  if (/^--color--accent$|^--accent-color$|^--color-accent$|^--accent$/.test(n)) return 4.8
  if (/^--color--bg$|^--color--background$|^--background$|^--color-bg$/.test(n)) return 4.5
  if (/^--color--text$|^--color--headings$|^--text-color$|^--color-text$/.test(n)) return 4.4
  // Exact primary/secondary color tokens — not section utilities like --primary-bg-color
  if (/^--primary-color$|^--color-primary$|^--secondary-color$|^--color-secondary$/.test(n)) {
    return 3.5
  }
  if (/\bbrand\b/.test(n) && /color|bg|background/.test(n) && !/brand-light|brand-dark/.test(n)) {
    return 3.5
  }
  if (/accent(?!-dark|-light)/.test(n) && /color/.test(n)) return 3.2
  // Light/dark variants are supporting tokens — keep below primary brand/accent
  if (/brand-light|brand-dark/.test(n)) return 2.4
  if (/accent-dark|accent-light/.test(n)) return 1.6
  return 0
}

function titleFont(name: string): string {
  return name.replace(/\b\w/g, (c) => c.toUpperCase())
}

/** Collect stylesheet hrefs from HTML (link + @import in style tags). */
export function extractStylesheetUrls(html: string, pageUrl: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (raw?: string) => {
    if (!raw) return
    const abs = absolutize(pageUrl, decodeHtmlEntities(raw.trim()))
    if (!abs || !isSafePublicUrl(abs, pageUrl) || seen.has(abs)) return
    // Skip non-CSS looking links that are clearly fonts-only? Keep Google CSS.
    if (/\.(woff2?|ttf|otf|eot)(\?|$)/i.test(abs)) return
    // Skip third-party chrome stylesheets (payments, cookies, apps)
    if (isChromeStylesheetUrl(abs)) return
    seen.add(abs)
    out.push(abs)
  }

  const linkRe =
    /<link\b[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*>|<link\b[^>]*href=["'][^"']+["'][^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*>/gi
  let lm: RegExpExecArray | null
  while ((lm = linkRe.exec(html)) && out.length < MAX_STYLESHEETS) {
    const tag = lm[0]
    const href = /\bhref=["']([^"']+)["']/i.exec(tag)?.[1]
    push(href)
  }

  // Inline <style> @import
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  let sm: RegExpExecArray | null
  while ((sm = styleRe.exec(html)) && out.length < MAX_STYLESHEETS) {
    collectCssImports(sm[1] || '', pageUrl, push)
  }

  return out.slice(0, MAX_STYLESHEETS)
}

function collectCssImports(
  css: string,
  baseUrl: string,
  push: (raw?: string) => void,
) {
  const re = /@import\s+(?:url\(\s*)?(?:["']([^"')]+)["']|([^);"'\s]+))\s*\)?[^;]*;/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    push(m[1] || m[2])
  }
  // Also google fonts @import style
  void baseUrl
}

async function fetchTextSafe(
  url: string,
  pageUrl: string,
  signal: AbortSignal,
): Promise<string | null> {
  if (!isSafePublicUrl(url, pageUrl)) return null
  try {
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal,
      headers: {
        Accept: 'text/css,*/*;q=0.1',
        'User-Agent': USER_AGENT,
      },
    })
    if (!res.ok) return null
    // Re-check final URL after redirects
    const finalUrl = res.url || url
    if (!isSafePublicUrl(finalUrl, pageUrl)) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength > MAX_CSS_BYTES) return null
    return buf.toString('utf8')
  } catch {
    return null
  }
}

export async function fetchStylesheetBundle(
  html: string,
  pageUrl: string,
  parentSignal?: AbortSignal,
): Promise<{ cssTexts: Array<{ url: string; css: string }>; warnings: string[] }> {
  const warnings: string[] = []
  const urls = extractStylesheetUrls(html, pageUrl)
  const cssTexts: Array<{ url: string; css: string }> = []
  const fetched = new Set<string>()

  async function loadOne(url: string, depth: number) {
    if (fetched.has(url) || cssTexts.length >= MAX_STYLESHEETS) return
    fetched.add(url)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), CSS_TIMEOUT_MS)
    const onAbort = () => controller.abort()
    parentSignal?.addEventListener('abort', onAbort)
    try {
      const css = await fetchTextSafe(url, pageUrl, controller.signal)
      if (!css) {
        warnings.push(`Could not fetch stylesheet: ${url}`)
        return
      }
      cssTexts.push({ url, css })
      if (depth < MAX_IMPORT_DEPTH) {
        const imports: string[] = []
        collectCssImports(css, url, (raw) => {
          const abs = raw ? absolutize(url, raw) : null
          if (abs && isSafePublicUrl(abs, pageUrl)) imports.push(abs)
        })
        for (const next of imports.slice(0, 4)) {
          await loadOne(next, depth + 1)
        }
      }
    } finally {
      clearTimeout(timer)
      parentSignal?.removeEventListener('abort', onAbort)
    }
  }

  for (const u of urls) {
    await loadOne(u, 0)
  }

  return { cssTexts, warnings }
}

function extractInlineStyleBlocks(html: string): string {
  const chunks: string[] = []
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi
  let m: RegExpExecArray | null
  while ((m = styleRe.exec(html))) chunks.push(m[1] || '')
  // style="" attributes — keep tag/id/class so third-party widgets can be filtered
  const attrRe =
    /<([a-zA-Z][\w-]*)\b([^>]*?)\sstyle=["']([^"']{3,400})["'][^>]*>/gi
  let am: RegExpExecArray | null
  while ((am = attrRe.exec(html))) {
    const tag = am[1] || 'div'
    const attrs = am[2] || ''
    const styleBody = am[3] || ''
    const id = /(?:^|\s)id=["']([^"']+)["']/i.exec(attrs)?.[1]?.trim() || ''
    const cls =
      /(?:^|\s)class=["']([^"']+)["']/i
        .exec(attrs)?.[1]
        ?.trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 4)
        .join('.') || ''
    const sel = [
      tag,
      id ? `#${id.replace(/[^a-zA-Z0-9_-]/g, '')}` : '',
      cls ? `.${cls}` : '',
    ]
      .filter(Boolean)
      .join('')
    chunks.push(`${sel || 'inline'}{${styleBody}}`)
  }
  return chunks.join('\n')
}

function metaContent(html: string, propertyOrName: string): string | undefined {
  const escaped = propertyOrName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
    'i',
  )
  const m = re.exec(html)
  const raw = (m?.[1] || m?.[2] || '').trim()
  return raw || undefined
}

function classifyFromSelector(selector: string, prop: string): ColorClassification {
  const s = selector.toLowerCase()
  const p = prop.toLowerCase()
  if (/sale|discount|error|danger|warning|alert|badge--sale|price--on-sale/.test(s)) {
    return 'unknown'
  }
  // Pseudo overlays / hidden masks are not page backgrounds
  if (
    p.includes('background') &&
    (/:(?:before|after)\b/.test(s) || /opacity\b/.test(s))
  ) {
    return 'unknown'
  }
  if (/\b(button|btn|cta|shop-now|add-to-cart|addtocart|c-btn)\b/.test(s)) {
    return 'button'
  }
  if (/\b(nav|navbar|menu|header__menu|site-nav|primary-nav)\b/.test(s)) return 'navigation'
  if (/\b(h1|h2|h3|heading|title|hero__title|section__title)\b/.test(s)) return 'heading'
  if (p === 'color' && /\b(body|p|text|paragraph|main)\b/.test(s)) return 'text'
  if (
    p.includes('background') &&
    /\b(body|html|main|page|wrapper|container)\b/.test(s) &&
    !/:(?:before|after)\b/.test(s)
  ) {
    return 'background'
  }
  if (p.includes('background') && /\b(section|footer|card|drawer|sidebar)\b/.test(s)) {
    return 'secondary-background'
  }
  if (/accent|brand|primary|highlight/.test(s) || /accent|brand|primary/.test(p)) {
    return 'accent'
  }
  if (p === 'color') return 'text'
  if (p.includes('background')) return 'secondary-background'
  return 'unknown'
}

function fontUsageFromSelector(selector: string): FontUsage {
  const s = selector.toLowerCase()
  if (/\b(h1|h2|h3|heading|title|hero__title|display)\b/.test(s)) return 'heading'
  if (/\b(button|btn|c-btn|cta)\b/.test(s)) return 'button'
  if (/\b(nav|navbar|menu|site-nav)\b/.test(s)) return 'navigation'
  if (/\b(body|html|p|main|text|paragraph)\b/.test(s)) return 'body'
  return 'unknown'
}

function collectColorHitsFromCss(
  css: string,
  sourceLabel: string,
  hits: ColorHit[],
) {
  const chromeSheet = isChromeStylesheetUrl(sourceLabel)

  // CSS variables with brand-ish names
  const varRe =
    /(--[\w-]*(?:color|colour|bg|background|text|ink|brand|accent|primary|secondary|button|cta|nav|header|heading)[\w-]*)\s*:\s*([^;}{]+)/gi
  let vm: RegExpExecArray | null
  while ((vm = varRe.exec(css))) {
    const name = vm[1]!.toLowerCase()
    if (isIgnoredColorVar(name)) continue
    if (chromeSheet) continue
    const hex = normalizeHex(vm[2]!.trim())
    if (!hex || isBrowserDefaultNoise(hex) || isFrameworkAccentNoise(hex)) continue
    // Pure white/black from weak utility vars are low signal unless clearly brand tokens
    const weakNeutral =
      (hex === '#FFFFFF' || hex === '#000000') &&
      !/brand|primary|accent|text|ink|foreground|button|cta|heading/.test(name)
    if (weakNeutral) continue
    let classification: ColorClassification = 'unknown'
    if (/button|cta|btn/.test(name) && !/text-label/.test(name)) classification = 'button'
    else if (/nav|menu|header/.test(name) && !/heading/.test(name)) classification = 'navigation'
    else if (/heading|title|h1|h2/.test(name)) classification = 'heading'
    else if (/text|ink|foreground|fg/.test(name)) classification = 'text'
    else if (/^--color--brand$|^--brand-color$|^--color-brand$/.test(name)) classification = 'accent'
    else if (/accent|brand|primary|highlight/.test(name)) classification = 'accent'
    else if (/secondary|muted|surface|card|section|drawer/.test(name) && /bg|background/.test(name))
      classification = 'secondary-background'
    else if (/bg|background/.test(name)) classification = 'background'
    const promoVar = /sale|discount|promo|badge|label-discount|label-custom/.test(name)
    const tokenStrength = brandTokenStrength(name)
    const themeKind = classifyThemeKind({
      sourceLabel,
      cssVariable: name,
      promo: promoVar,
    })
    if (themeKind === 'third-party' || themeKind === 'system-ui') continue
    if (isStatusGreenNoise(hex, tokenStrength)) continue
    const weight = promoVar
      ? 0.4
      : tokenStrength > 0
        ? 2.2 + tokenStrength
        : 2.2
    hits.push({
      hex,
      classification,
      source: `${sourceLabel}:${name}`,
      weight,
      promoContext: promoVar,
      property: 'custom-property',
      cssVariable: name,
      usageContext: name,
      themeKind,
      brandTokenStrength: tokenStrength,
      chromeNoise: false,
    })
  }

  // Declarations inside rule blocks — sample common properties
  const ruleRe = /([^{}@][^{]*)\{([^{}]+)\}/g
  let rm: RegExpExecArray | null
  while ((rm = ruleRe.exec(css))) {
    const selector = rm[1]!.trim().slice(0, 180)
    const body = rm[2] || ''
    if (!selector || /@(keyframes|font-face|media)/i.test(selector)) continue
    const sel = selector.toLowerCase()
    // Skip promo, payment, scrollbar, cookie, disabled, and third-party chrome
    if (
      /sale|discount|error|danger|warning|alert|badge--sale|payment-terms|shopify-payment|okereviews|okeloyalty|oke-|judgeme|jdgm|yotpo|klaviyo|tiktok|facebook|golootlo|shopsmart|bluecart|bcpb|one-click/.test(
        sel,
      ) ||
      isChromeSelector(sel) ||
      chromeSheet
    ) {
      continue
    }
    if (/^\s*\*(?:,|:|$)/.test(sel.trim()) || sel.trim() === '*' || sel.includes('*,:before')) {
      continue
    }
    // Skip backdrop / focus-ring utility blues and stroke-only loader paths
    if (/::backdrop|:focus-visible|loading-overlay|\.path\b/.test(sel)) continue
    // Hidden overlay masks (common Shopify body:before dimmers)
    if (/:(?:before|after)\b/.test(sel) && /body|html|overlay|mask|dimmer/.test(sel)) continue

    const promoContext = /sale|discount|promo|compare-at|on-sale/.test(sel)
    const themeKind = classifyThemeKind({
      selector: sel,
      sourceLabel,
      promo: promoContext,
    })
    if (themeKind === 'third-party' || themeKind === 'system-ui') continue
    const propRe =
      /(background(?:-color)?|color|border-color|outline-color|fill|stroke)\s*:\s*([^;}{]+)/gi
    let pm: RegExpExecArray | null
    while ((pm = propRe.exec(body))) {
      const prop = pm[1]!.toLowerCase()
      // stroke/fill on non-brand SVG chrome is usually noise
      if ((prop === 'stroke' || prop === 'fill') && !/logo|brand|icon-brand|svg.*brand/.test(sel)) {
        continue
      }
      // Border/outline focus rings are rarely brand identity
      if (
        (prop === 'border-color' || prop === 'outline-color') &&
        !/button|btn|c-btn|brand|accent|primary/.test(sel)
      ) {
        continue
      }
      const hex = normalizeHex(pm[2]!.trim())
      if (!hex || isBrowserDefaultNoise(hex) || isFrameworkAccentNoise(hex)) continue
      if (isStatusGreenNoise(hex, 0)) continue
      const classification = classifyFromSelector(selector, prop)
      // Sale/error reds should not become brand backgrounds
      if (isPromoLikely(hex) && classification !== 'button' && classification !== 'accent') {
        continue
      }
      if (isPromoLikely(hex) && /:root|html|body/.test(sel)) continue
      // Disabled / muted button greys are not primary brand colors
      if (/:disabled|\.disabled|\.disable|\[disabled\]/.test(sel) && classification === 'button') {
        continue
      }
      // Popup/close chrome greys
      if (/mfp-close|magnific|\.close\b|modal__close|popup__close/.test(sel)) continue
      let weight = 1
      if (classification === 'button') weight = 2.4
      else if (classification === 'background') weight = 2.6
      else if (classification === 'heading') weight = 2.1
      else if (classification === 'navigation') weight = 1.9
      else if (classification === 'accent') weight = 2.3
      else if (classification === 'text') weight = 2.0
      else if (classification === 'secondary-background') weight = 1.4
      if (promoContext) weight *= 0.2
      // Hover/focus-only link colors are not permanent brand tokens
      if (/:hover|:active|:focus/.test(sel)) {
        if (
          classification === 'secondary-background' ||
          classification === 'unknown' ||
          /\ba\b|\.rte\b|link/.test(sel)
        ) {
          continue
        }
        weight *= 0.55
      }
      hits.push({
        hex,
        classification: promoContext ? 'unknown' : classification,
        source: `${sourceLabel}:${selector.slice(0, 60)}.${prop}`,
        weight,
        promoContext: promoContext || isPromoLikely(hex),
        property: prop,
        usageContext: selector.slice(0, 80),
        chromeNoise: false,
        themeKind,
        brandTokenStrength: 0,
      })
    }
  }
}

function collectFontHitsFromCss(
  css: string,
  sourceLabel: string,
  hits: FontHit[],
) {
  const varMap = collectCssVarFontMap(css)

  // @font-face (skip icon packs)
  const faceRe = /@font-face\s*\{([\s\S]*?)\}/gi
  let fm: RegExpExecArray | null
  while ((fm = faceRe.exec(css))) {
    const family = /font-family\s*:\s*([^;}{]+)/i.exec(fm[1] || '')?.[1]
    const name = family ? firstFontFamily(family) : null
    if (!name || /icon/i.test(name)) continue
    hits.push({
      name: titleFont(name),
      usage: 'unknown',
      source: `${sourceLabel}:@font-face`,
      weight: 2.0,
      fromFaceOrGoogle: true,
      declaredOnly: true,
      property: 'font-family',
      usageContext: '@font-face',
    })
  }

  // Explicit --font-* assignments — declared evidence only (not verified until rendered)
  for (const [key, name] of varMap) {
    if (!firstFontFamily(name)) continue
    let usage: FontUsage = 'unknown'
    if (/heading|title|display|h1|h2/.test(key)) usage = 'heading'
    else if (/body|text|paragraph/.test(key)) usage = 'body'
    else if (/nav|menu/.test(key)) usage = 'navigation'
    hits.push({
      name,
      usage,
      source: `${sourceLabel}:${key}`,
      weight: 2.2,
      fromFaceOrGoogle: false,
      declaredOnly: true,
      property: 'custom-property',
      cssVariable: key,
      usageContext: key,
    })
  }

  const ruleRe = /([^{}@][^{]*)\{([^{}]+)\}/g
  let rm: RegExpExecArray | null
  while ((rm = ruleRe.exec(css))) {
    const selector = rm[1]!.trim().slice(0, 180)
    const body = rm[2] || ''
    if (isChromeSelector(selector.toLowerCase())) continue
    const ff = /font-family\s*:\s*([^;}{]+)/i.exec(body)?.[1]
    if (!ff) continue
    const resolved = resolveFontVar(ff, varMap)
    if (!resolved) continue
    const usage = fontUsageFromSelector(selector)
    const weight =
      usage === 'body' ? 2.0 : usage === 'heading' ? 2.2 : usage === 'navigation' ? 1.8 : 0.9
    hits.push({
      name: titleFont(resolved),
      usage,
      source: `${sourceLabel}:${selector.slice(0, 60)}`,
      weight,
      fromFaceOrGoogle: false,
      declaredOnly: true,
      property: 'font-family',
      usageContext: selector.slice(0, 80),
    })
  }
}

function collectGoogleFontsFromHtml(html: string, hits: FontHit[]) {
  const gf = /fonts\.googleapis\.com\/css2?\?[^"'>\s]*family=([A-Za-z0-9+|:%20_-]+)/gi
  let gm: RegExpExecArray | null
  while ((gm = gf.exec(html))) {
    try {
      const families = decodeURIComponent(gm[1]!.replace(/\+/g, ' '))
        .split('|')
        .flatMap((p) => p.split('&')[0]!.split(':')[0]!.split(','))
      for (const f of families) {
        const name = firstFontFamily(f.replace(/_/g, ' '))
        if (!name) continue
        hits.push({
          name: titleFont(name),
          usage: 'unknown',
          source: 'html:google-fonts',
          weight: 2.0,
          fromFaceOrGoogle: true,
          declaredOnly: true,
          property: 'stylesheet',
          usageContext: 'google-fonts link',
        })
      }
    } catch {
      /* ignore */
    }
  }
}

/**
 * Rank evidence-backed colors. Variable length. No artificial padding.
 */
export function refineBrandPalette(hits: ColorHit[]): ExtractedColor[] {
  type Agg = {
    hex: string
    classification: ColorClassification
    source: string
    score: number
    promoOnly: boolean
    nonPromoScore: number
    renderedScore: number
    hitCount: number
    property?: string
    cssVariable?: string
    usageContext?: string
    fromRendered: boolean
    brandTokenStrength: number
    themeKind: ColorThemeKind
    evidenceParts: string[]
  }
  const byHex = new Map<string, Agg>()

  const classPriority: Record<ColorClassification, number> = {
    accent: 6,
    button: 5,
    background: 5,
    heading: 4,
    text: 4,
    navigation: 3,
    'secondary-background': 2,
    unknown: 1,
  }

  const preferHitMeta = (prev: Agg, hit: ColorHit) => {
    const hitToken = hit.brandTokenStrength || 0
    if (hitToken > prev.brandTokenStrength) {
      prev.hex = hit.hex
      prev.source = hit.source
      prev.property = hit.property || prev.property
      prev.cssVariable = hit.cssVariable || prev.cssVariable
      prev.usageContext = hit.usageContext || prev.usageContext
      prev.brandTokenStrength = hitToken
      prev.classification = hit.classification
      if (hit.themeKind) prev.themeKind = hit.themeKind
      return
    }
    if (
      hitToken === prev.brandTokenStrength &&
      classPriority[hit.classification] > classPriority[prev.classification]
    ) {
      // Don't let overlay/unknown chrome upgrade over a solid text/accent token
      if (hit.classification === 'unknown') return
      prev.classification = hit.classification
      if (!prev.cssVariable || hit.cssVariable) {
        prev.source = hit.source
        prev.property = hit.property || prev.property
        prev.cssVariable = hit.cssVariable || prev.cssVariable
        prev.usageContext = hit.usageContext || prev.usageContext
      }
    }
  }

  for (const hit of hits) {
    if (hit.chromeNoise) continue
    if (hit.themeKind === 'third-party' || hit.themeKind === 'system-ui') continue
    // Merge near-duplicates into the stronger brand-token hex when possible
    let key = hit.hex
    for (const [existing, agg] of byHex) {
      if (colorDistance(existing, hit.hex) < 18) {
        // Prefer keeping the hex that is an exact brand token (e.g. #030303 over #101010)
        const hitToken = hit.brandTokenStrength || 0
        if (hitToken > agg.brandTokenStrength) {
          byHex.delete(existing)
          key = hit.hex
          byHex.set(key, { ...agg, hex: hit.hex })
        } else {
          key = existing
        }
        break
      }
    }
    const prev = byHex.get(key)
    if (!prev) {
      byHex.set(key, {
        hex: key,
        classification: hit.classification,
        source: hit.source,
        score: hit.weight,
        promoOnly: hit.promoContext,
        nonPromoScore: hit.promoContext ? 0 : hit.weight,
        renderedScore: hit.fromRendered ? hit.weight : 0,
        hitCount: 1,
        property: hit.property,
        cssVariable: hit.cssVariable,
        usageContext: hit.usageContext,
        fromRendered: !!hit.fromRendered,
        brandTokenStrength: hit.brandTokenStrength || 0,
        themeKind: hit.themeKind || 'unknown',
        evidenceParts: [hit.source.slice(0, 120)],
      })
    } else {
      prev.score += hit.weight
      prev.hitCount += 1
      if (!hit.promoContext) {
        prev.promoOnly = false
        prev.nonPromoScore += hit.weight
      }
      if (hit.fromRendered) {
        prev.fromRendered = true
        prev.renderedScore += hit.weight
      }
      if (prev.evidenceParts.length < 4 && !prev.evidenceParts.includes(hit.source.slice(0, 120))) {
        prev.evidenceParts.push(hit.source.slice(0, 120))
      }
      preferHitMeta(prev, hit)
    }
  }

  const ranked = [...byHex.values()]
    .filter((c) => {
      if (c.themeKind === 'third-party' || c.themeKind === 'system-ui') return false
      // Announcement / message-bar / shipping strips are not the brand palette
      if (c.themeKind === 'promo' && c.brandTokenStrength < 4) return false
      if (c.promoOnly && isPromoLikely(c.hex)) return false
      // Drop promo-heavy reds unless they also appear as non-promo brand evidence
      if (isPromoLikely(c.hex) && c.nonPromoScore < 1.5 && c.renderedScore < 2) return false
      // Framework accent blues / status greens without a brand token are never permanent
      if (isFrameworkAccentNoise(c.hex) && c.brandTokenStrength < 3) return false
      if (isStatusGreenNoise(c.hex, c.brandTokenStrength)) return false
      // Weak Shopify utility “primary” blues with no brand token + only chrome context
      if (
        c.brandTokenStrength < 2 &&
        saturation(c.hex) > 0.25 &&
        /message-bar|announcement|primary-bg|scheme-/i.test(
          `${c.source} ${c.usageContext || ''} ${c.cssVariable || ''}`,
        )
      ) {
        return false
      }
      // Pure white from review widgets / weak contexts without brand token
      if (
        c.hex === '#FFFFFF' &&
        c.brandTokenStrength < 2.4 &&
        !c.fromRendered &&
        /jdgm|judgeme|review|widget|voucher/i.test(
          `${c.source} ${c.usageContext || ''} ${c.cssVariable || ''}`,
        )
      ) {
        return false
      }
      // Chrome-only / one-off weak colors without recurrence or rendered proof
      if (
        !c.fromRendered &&
        c.brandTokenStrength < 2 &&
        c.hitCount < 2 &&
        c.nonPromoScore < 2.0 &&
        c.classification === 'unknown'
      ) {
        return false
      }
      // Require brand-token OR rendered OR recurring evidence for permanent palette
      if (
        !c.fromRendered &&
        c.brandTokenStrength < 2.4 &&
        c.hitCount < 2 &&
        c.nonPromoScore < 3.5
      ) {
        return false
      }
      return c.score >= 0.9
    })
    .sort(
      (a, b) =>
        b.brandTokenStrength - a.brandTokenStrength ||
        b.renderedScore - a.renderedScore ||
        b.nonPromoScore - a.nonPromoScore ||
        b.hitCount - a.hitCount ||
        b.score - a.score,
    )

  // Prefer one color per major role when possible, keep total reasonable
  const out: ExtractedColor[] = []
  const usedRoles = new Set<ColorClassification>()
  for (const c of ranked) {
    if (out.length >= 8) break
    // Near-dup: keep stronger brand token; skip weaker neighbor
    const nearIdx = out.findIndex((o) => colorDistance(o.hex, c.hex) < 22)
    if (nearIdx >= 0) {
      const existing = out[nearIdx]!
      const existingToken = brandTokenStrength(existing.cssVariable || '')
      if (c.brandTokenStrength > existingToken + 0.5) {
        out[nearIdx] = {
          ...existing,
          hex: c.hex,
          classification: c.classification,
          source: c.source,
          property: c.property,
          cssVariable: c.cssVariable,
          usageContext: c.usageContext,
          verified: existing.verified || c.fromRendered,
          confidence: Math.max(existing.confidence, 0.7),
          themeKind: c.themeKind,
          occurrences: c.hitCount,
          evidence: c.evidenceParts.join(' | '),
          verificationStatus: existing.verified || c.fromRendered ? 'verified' : 'unknown',
        }
      }
      continue
    }
    // Avoid stacking many unknowns / weak greys
    if (c.classification === 'unknown' && out.length >= 3) continue
    if (
      c.classification === 'secondary-background' &&
      c.brandTokenStrength < 2 &&
      saturation(c.hex) < 0.08 &&
      !c.fromRendered
    ) {
      continue
    }
    // Keep only one accent family unless both are strong brand tokens
    if (
      c.classification === 'accent' &&
      usedRoles.has('accent') &&
      c.brandTokenStrength < 4
    ) {
      continue
    }
    if (
      usedRoles.has(c.classification) &&
      c.classification !== 'accent' &&
      c.brandTokenStrength < 4 &&
      out.length >= 4
    ) {
      continue
    }
    usedRoles.add(c.classification)
    const confidence = Math.max(
      0.35,
      Math.min(
        0.98,
        0.35 +
          c.nonPromoScore / 10 +
          Math.min(0.25, c.hitCount * 0.04) +
          (c.fromRendered ? 0.22 : 0) +
          Math.min(0.2, c.brandTokenStrength * 0.04) +
          (c.classification === 'unknown' ? -0.12 : 0.08),
      ),
    )
    const verified = c.fromRendered || c.brandTokenStrength >= 4
    out.push({
      hex: c.hex,
      classification: c.classification,
      source: c.source,
      confidence: Math.round(confidence * 100) / 100,
      property: c.property,
      cssVariable: c.cssVariable,
      usageContext: c.usageContext,
      verified,
      promotional: c.promoOnly || (isPromoLikely(c.hex) && c.renderedScore < 1),
      themeKind: c.themeKind,
      occurrences: c.hitCount,
      evidence: c.evidenceParts.join(' | '),
      verificationStatus: verified ? 'verified' : 'unknown',
    })
  }
  return out
}

function refineFonts(hits: FontHit[]): ExtractedFont[] {
  type Agg = {
    name: string
    usage: FontUsage
    source: string
    score: number
    fromFaceOrGoogle: boolean
    declaredOnly: boolean
    fromRendered: boolean
    fontFileLoaded: boolean
    property?: string
    cssVariable?: string
    usageContext?: string
    computedStack?: string
  }
  // Keep separate aggregates per (family, usage) so body/nav/heading can all
  // surface Montserrat (or whatever) when rendered verification confirms each role.
  const byKey = new Map<string, Agg>()
  const usageRank: Record<FontUsage, number> = {
    heading: 4,
    body: 3,
    navigation: 2,
    button: 2,
    unknown: 1,
  }
  for (const hit of hits) {
    const usageKey = hit.usage === 'unknown' && !hit.fromRendered ? 'unknown' : hit.usage
    const key = `${hit.name.toLowerCase()}::${usageKey}`
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, {
        name: hit.name,
        usage: hit.usage,
        source: hit.source,
        score: hit.weight,
        fromFaceOrGoogle: hit.fromFaceOrGoogle,
        declaredOnly: !!hit.declaredOnly,
        fromRendered: !!hit.fromRendered,
        fontFileLoaded: !!hit.fontFileLoaded || hit.fromFaceOrGoogle,
        property: hit.property,
        cssVariable: hit.cssVariable,
        usageContext: hit.usageContext,
        computedStack: hit.computedStack,
      })
    } else {
      prev.score += hit.weight
      prev.fromFaceOrGoogle = prev.fromFaceOrGoogle || hit.fromFaceOrGoogle
      prev.fontFileLoaded = prev.fontFileLoaded || !!hit.fontFileLoaded || hit.fromFaceOrGoogle
      prev.declaredOnly = prev.declaredOnly && !!hit.declaredOnly
      if (hit.computedStack) prev.computedStack = hit.computedStack
      if (hit.fromRendered) {
        prev.fromRendered = true
        prev.declaredOnly = false
        prev.source = hit.source
        prev.property = hit.property || prev.property
        prev.usageContext = hit.usageContext || prev.usageContext
        if (hit.usage !== 'unknown' && usageRank[hit.usage] >= usageRank[prev.usage]) {
          prev.usage = hit.usage
        }
      } else if (usageRank[hit.usage] > usageRank[prev.usage] && !prev.fromRendered) {
        prev.usage = hit.usage
        prev.source = hit.source
        prev.property = hit.property || prev.property
        prev.cssVariable = hit.cssVariable || prev.cssVariable
        prev.usageContext = hit.usageContext || prev.usageContext
      }
    }
  }

  const ranked = [...byKey.values()].sort(
    (a, b) =>
      Number(b.fromRendered) - Number(a.fromRendered) ||
      usageRank[b.usage] - usageRank[a.usage] ||
      b.score - a.score,
  )
  const out: ExtractedFont[] = []
  const usedUsage = new Set<FontUsage>()
  const usedNames = new Set<string>()
  for (const f of ranked) {
    if (out.length >= 6) break
    // Prefer distinct usages; allow same family on multiple roles when rendered
    if (f.usage !== 'unknown' && usedUsage.has(f.usage)) {
      // Same family already covering this usage — skip
      continue
    }
    // Cap unknown / declared-only duplicates of an already-listed family
    if (
      !f.fromRendered &&
      usedNames.has(f.name.toLowerCase()) &&
      f.usage === 'unknown'
    ) {
      continue
    }
    if (f.usage !== 'unknown') usedUsage.add(f.usage)
    usedNames.add(f.name.toLowerCase())
    const verified = f.fromRendered
    const estimated = !verified
    const confidence = Math.max(
      0.28,
      Math.min(
        0.98,
        0.3 +
          f.score / 12 +
          (verified ? 0.35 : 0) +
          (f.fontFileLoaded && verified ? 0.08 : 0) +
          (f.fromFaceOrGoogle && !verified ? 0.08 : 0) +
          (f.usage !== 'unknown' ? 0.1 : 0) -
          (estimated ? 0.05 : 0),
      ),
    )
    out.push({
      name: f.name,
      usage: f.usage,
      source: f.source,
      confidence: Math.round(confidence * 100) / 100,
      estimated,
      verified,
      property: f.property || 'font-family',
      cssVariable: f.cssVariable,
      usageContext: f.usageContext,
      fontFileLoaded: f.fontFileLoaded,
      computedStack: f.computedStack,
      evidence: [
        f.source,
        f.computedStack ? `computed:${f.computedStack}` : '',
        f.fontFileLoaded ? 'document.fonts:loaded' : '',
      ]
        .filter(Boolean)
        .join(' | '),
      verificationStatus: verified ? 'verified' : 'unknown',
    })
  }
  return out
}

function mapRenderedUsageToClass(
  usage: string,
): ColorClassification {
  if (usage === 'background') return 'background'
  if (usage === 'text') return 'text'
  if (usage === 'heading') return 'heading'
  if (usage === 'button') return 'button'
  if (usage === 'navigation') return 'navigation'
  if (usage === 'accent') return 'accent'
  return 'unknown'
}

/**
 * Full visual extraction from homepage HTML + stylesheets + optional render pass.
 */
export async function extractBrandVisuals(
  html: string,
  pageUrl: string,
  parentSignal?: AbortSignal,
): Promise<BrandVisualExtraction> {
  const colorHits: ColorHit[] = []
  const fontHits: FontHit[] = []
  const warnings: string[] = []

  // Meta theme-color (weak but real evidence)
  const theme = metaContent(html, 'theme-color')
  const themeHex = theme ? normalizeHex(theme) : null
  if (themeHex && !isBrowserDefaultNoise(themeHex)) {
    colorHits.push({
      hex: themeHex,
      classification: 'accent',
      source: 'html:meta:theme-color',
      weight: 1.6,
      promoContext: false,
      property: 'theme-color',
      usageContext: 'meta[name=theme-color]',
    })
  }

  const inlineCss = extractInlineStyleBlocks(html)
  if (inlineCss) {
    collectColorHitsFromCss(inlineCss, 'html:inline-style', colorHits)
    collectFontHitsFromCss(inlineCss, 'html:inline-style', fontHits)
  }
  collectGoogleFontsFromHtml(html, fontHits)

  const { cssTexts, warnings: cssWarnings } = await fetchStylesheetBundle(
    html,
    pageUrl,
    parentSignal,
  )
  warnings.push(...cssWarnings)

  for (const sheet of cssTexts) {
    if (isChromeStylesheetUrl(sheet.url)) continue
    collectColorHitsFromCss(sheet.css, `css:${sheet.url}`, colorHits)
    collectFontHitsFromCss(sheet.css, `css:${sheet.url}`, fontHits)
  }

  // Do NOT mine arbitrary Shopify JSON color blobs — only CSS/meta/rendered evidence.

  // Phase 1.1: verify fonts/colors against computed styles when Chromium is available.
  let usedRender = false
  try {
    const rendered = await inspectRenderedBrand(pageUrl, parentSignal)
    warnings.push(...rendered.warnings)
    usedRender = rendered.usedPlaywright
    const loaded = rendered.loadedFontFamilies

    for (const f of rendered.fonts) {
      const usage: FontUsage = f.usage
      // Prefer families that are both computed and present in document.fonts when available
      const loadedMatch =
        loaded.length > 0 &&
        loaded.some((lf) => fontsRoughlyMatch(lf, f.primaryFont))
      // Ignore icon / widget font faces even if computed somehow
      if (/icon|judgeme|jdgm|slick|ys text|one-click/i.test(f.primaryFont)) continue
      fontHits.push({
        name: titleFont(f.primaryFont),
        usage,
        source: `rendered:${f.selector}.${f.property}`,
        weight: loadedMatch ? 5.5 : 4.2,
        fromFaceOrGoogle: loadedMatch,
        declaredOnly: false,
        fromRendered: true,
        fontFileLoaded: loadedMatch,
        computedStack: f.fontFamily,
        property: f.property,
        usageContext: `${f.usage} via ${f.selector}`,
      })
    }

    for (const c of rendered.colors) {
      if (isBrowserDefaultNoise(c.hex) || isFrameworkAccentNoise(c.hex)) continue
      if (isChromeSelector(c.selector)) continue
      colorHits.push({
        hex: c.hex,
        classification: mapRenderedUsageToClass(c.usage),
        source: `rendered:${c.selector}.${c.property}`,
        weight: c.usage === 'accent' || c.usage === 'background' ? 5.2 : 4.8,
        promoContext: false,
        property: c.property,
        usageContext: `${c.usage} via ${c.selector}`,
        fromRendered: true,
        themeKind: 'theme',
        brandTokenStrength: c.usage === 'accent' ? 3.5 : c.usage === 'background' ? 3 : 2.5,
      })
    }

    if (usedRender && !rendered.fonts.length) {
      warnings.push(
        'Playwright ran but could not sample heading/body/nav fonts on the page.',
      )
    }
  } catch (err) {
    warnings.push(
      `Rendered inspection skipped: ${err instanceof Error ? err.message : 'unknown error'}`,
    )
  }

  const colors = refineBrandPalette(colorHits)
  const fonts = refineFonts(fontHits)

  const roles = new Set(colors.map((c) => c.classification))
  const hasCoreRoles =
    (roles.has('background') || roles.has('secondary-background')) &&
    (roles.has('text') || roles.has('heading') || roles.has('button') || roles.has('accent'))
  const paletteIncomplete = colors.length < 3 || !hasCoreRoles
  if (paletteIncomplete && colors.length > 0) {
    warnings.push(
      `Palette may be incomplete — returned ${colors.length} evidence-backed color(s) without inventing fillers.`,
    )
  }
  if (!colors.length) {
    warnings.push('No evidence-backed brand colors found in HTML/CSS.')
  }
  if (!fonts.length) {
    warnings.push('No evidence-backed fonts found; font remains unknown/estimated.')
  } else if (fonts.every((f) => f.estimated)) {
    warnings.push(
      'Fonts are estimated from CSS declarations only — not confirmed via rendered computed styles.',
    )
  }

  let extractionMethod: BrandVisualExtraction['extractionMethod'] = 'html'
  if (cssTexts.length && usedRender) extractionMethod = 'html+css+render'
  else if (cssTexts.length) extractionMethod = 'html+css'

  return {
    colors,
    fonts,
    colorHexes: colors.map((c) => c.hex),
    fontNames: fonts.map((f) => f.name),
    warnings,
    extractionMethod,
    stylesheetsFetched: cssTexts.length,
    paletteIncomplete,
  }
}
