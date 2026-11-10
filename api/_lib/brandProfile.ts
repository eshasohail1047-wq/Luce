/**
 * Structured brand profile built from evidence-backed extraction.
 * AI may classify/annotate; it must not invent colors/fonts.
 */

import type { ExtractedColor, ExtractedFont } from './brandCssExtract.js'

export type BrandColorRole =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'background'
  | 'text'
  | 'button'
  | 'campaign'
  | 'product'
  | 'unknown'

export type BrandColorEntry = {
  hex: string
  role: BrandColorRole
  classification: string
  source: string
  confidence: number
  verified: boolean
  estimated: boolean
  promotional?: boolean
  property?: string
  cssVariable?: string
  usageContext?: string
  themeKind?: 'theme' | 'promo' | 'third-party' | 'system-ui' | 'unknown'
  occurrences?: number
  evidence?: string
  verificationStatus?: 'verified' | 'ai-inferred' | 'unknown'
}

export type BrandFontEntry = {
  name: string
  usage: 'heading' | 'body' | 'navigation' | 'button' | 'unknown'
  source: string
  confidence: number
  verified: boolean
  estimated: boolean
  property?: string
  cssVariable?: string
  usageContext?: string
  fontFileLoaded?: boolean
  computedStack?: string
  evidence?: string
  verificationStatus?: 'verified' | 'ai-inferred' | 'unknown'
}

export type LogoAnalysis = {
  sourceUrl?: string
  dominantColors: BrandColorEntry[]
  notes?: string
  analyzed: boolean
}

export type VisualStyleNotes = {
  photographyStyle?: string
  backgroundStyle?: string
  layoutPatterns?: string[]
  consistencyNotes?: string
  imageColors: BrandColorEntry[]
}

export type BrandProfile = {
  brandName?: string
  websiteUrl: string
  primaryColors: BrandColorEntry[]
  secondaryColors: BrandColorEntry[]
  accentColors: BrandColorEntry[]
  backgroundColors: BrandColorEntry[]
  textColors: BrandColorEntry[]
  campaignColors: BrandColorEntry[]
  productColors: BrandColorEntry[]
  headingFont?: BrandFontEntry
  bodyFont?: BrandFontEntry
  navigationFont?: BrandFontEntry
  buttonFont?: BrandFontEntry
  brandVoice?: string
  brandKeywords: string[]
  targetAudience?: string
  industry?: string
  styleNotes?: string
  logoAnalysis?: LogoAnalysis
  visualStyle?: VisualStyleNotes
  extractionConfidence: number
  extractionWarnings: string[]
  extractionMethod: string
  stylesheetsFetched: number
  aiRefined: boolean
  paletteIncomplete: boolean
  /** Flat evidence lists for clients that prefer arrays. */
  colorDetails: BrandColorEntry[]
  fontDetails: BrandFontEntry[]
  /** Backward-compatible flat lists (no invented fillers). */
  colors: string[]
  fonts: string[]
}

function toBrandColor(
  c: ExtractedColor,
  roleOverride?: BrandColorRole,
): BrandColorEntry {
  const promotional = c.promotional === true
  let role: BrandColorRole = roleOverride || 'unknown'
  if (!roleOverride) {
    if (promotional) role = 'campaign'
    else if (c.classification === 'background' || c.classification === 'secondary-background')
      role = 'background'
    else if (c.classification === 'text' || c.classification === 'heading') role = 'text'
    else if (c.classification === 'button') role = 'button'
    else if (c.classification === 'accent') role = 'accent'
    else if (c.classification === 'navigation') role = 'secondary'
    else role = 'unknown'
  }
  return {
    hex: c.hex,
    role,
    classification: c.classification,
    source: c.source,
    confidence: c.confidence,
    verified: c.verified === true,
    estimated: c.verified !== true,
    promotional,
    property: c.property,
    cssVariable: c.cssVariable,
    usageContext: c.usageContext,
    themeKind: c.themeKind,
    occurrences: c.occurrences,
    evidence: c.evidence || [c.source, c.cssVariable, c.usageContext].filter(Boolean).join(' | '),
    verificationStatus:
      c.verificationStatus || (c.verified ? 'verified' : 'unknown'),
  }
}

function toBrandFont(
  f: ExtractedFont,
  usage?: BrandFontEntry['usage'],
): BrandFontEntry {
  return {
    name: f.name,
    usage: usage || (f.usage as BrandFontEntry['usage']) || 'unknown',
    source: f.source,
    confidence: f.confidence,
    verified: f.verified === true,
    estimated: f.estimated !== false && f.verified !== true,
    property: f.property,
    cssVariable: f.cssVariable,
    usageContext: f.usageContext,
    fontFileLoaded: f.fontFileLoaded,
    computedStack: f.computedStack,
    evidence:
      f.evidence ||
      [f.source, f.computedStack ? `stack:${f.computedStack}` : '', f.fontFileLoaded ? 'font-file:loaded' : '']
        .filter(Boolean)
        .join(' | '),
    verificationStatus:
      f.verificationStatus || (f.verified ? 'verified' : 'unknown'),
  }
}

function pickFont(
  fonts: ExtractedFont[],
  usage: ExtractedFont['usage'],
): ExtractedFont | undefined {
  return (
    fonts.find((f) => f.usage === usage && f.verified) ||
    fonts.find((f) => f.usage === usage) ||
    undefined
  )
}

/**
 * Partition extracted colors into brand roles without inventing fillers.
 */
export function buildBrandProfile(input: {
  websiteUrl: string
  brandName?: string
  colors: ExtractedColor[]
  fonts: ExtractedFont[]
  warnings: string[]
  extractionMethod: string
  stylesheetsFetched: number
  aiRefined?: boolean
  paletteIncomplete?: boolean
  brandVoice?: string
  brandKeywords?: string[]
  targetAudience?: string
  industry?: string
  styleNotes?: string
  logoAnalysis?: LogoAnalysis
  visualStyle?: VisualStyleNotes
  productImageColors?: ExtractedColor[]
}): BrandProfile {
  const permanent = input.colors.filter((c) => !c.promotional)
  const campaign = input.colors.filter((c) => c.promotional)

  const backgroundColors = permanent
    .filter(
      (c) =>
        c.classification === 'background' ||
        c.classification === 'secondary-background',
    )
    .map((c) => toBrandColor(c, 'background'))

  const textColors = permanent
    .filter((c) => c.classification === 'text' || c.classification === 'heading')
    .map((c) => toBrandColor(c, 'text'))

  const accentColors = permanent
    .filter((c) => c.classification === 'accent' || c.classification === 'button')
    .map((c) =>
      toBrandColor(c, c.classification === 'button' ? 'button' : 'accent'),
    )

  // Primary = highest-confidence verified non-neutral brand/accent/button colors first,
  // then other permanent colors not already listed.
  const used = new Set<string>()
  const pushUnique = (list: BrandColorEntry[], entry: BrandColorEntry) => {
    const key = entry.hex.toUpperCase()
    if (used.has(key)) return
    used.add(key)
    list.push(entry)
  }

  const primaryColors: BrandColorEntry[] = []
  const secondaryColors: BrandColorEntry[] = []

  const rankedPermanent = [...permanent].sort(
    (a, b) =>
      Number(b.verified) - Number(a.verified) ||
      b.confidence - a.confidence,
  )

  // Prefer exact brand / accent CSS tokens as primary before chrome accents
  const brandTokenFirst = [...rankedPermanent].sort((a, b) => {
    const score = (c: ExtractedColor) => {
      const v = (c.cssVariable || '').toLowerCase()
      if (/^--color--brand$|^--brand-color$|^--color-brand$/.test(v)) return 100
      if (/^--color--accent$|^--accent-color$|^--color-accent$/.test(v)) return 90
      if (c.classification === 'accent' && c.verified) return 70
      if (c.classification === 'button' && c.verified) return 60
      return (c.verified ? 20 : 0) + c.confidence * 10
    }
    return score(b) - score(a)
  })

  for (const c of brandTokenFirst) {
    if (
      c.classification === 'accent' ||
      c.classification === 'button' ||
      c.classification === 'navigation'
    ) {
      const entry = toBrandColor(
        c,
        c.classification === 'button'
          ? 'button'
          : c.classification === 'accent'
            ? 'accent'
            : 'primary',
      )
      if (primaryColors.length < 3) pushUnique(primaryColors, { ...entry, role: 'primary' })
      else pushUnique(secondaryColors, { ...entry, role: 'secondary' })
    }
  }

  // Include distinctive backgrounds as secondary when not pure white filler-only
  for (const c of rankedPermanent) {
    if (c.classification === 'background' && c.hex !== '#FFFFFF' && c.hex !== '#000000') {
      pushUnique(secondaryColors, toBrandColor(c, 'secondary'))
    }
  }

  // Remaining permanent colors → secondary (never invent)
  for (const c of rankedPermanent) {
    const key = c.hex.toUpperCase()
    if (used.has(key)) continue
    if (c.classification === 'text' || c.classification === 'heading') continue
    pushUnique(secondaryColors, toBrandColor(c, 'secondary'))
  }

  const campaignColors = campaign.map((c) => toBrandColor(c, 'campaign'))
  const productColors = (input.productImageColors || []).map((c) =>
    toBrandColor(c, 'product'),
  )

  // Logo colors stay in logoAnalysis / secondary — do not auto-promote JPEG-quantized
  // logo pixels into primary over stronger CSS/rendered evidence.
  if (input.logoAnalysis?.dominantColors?.length) {
    for (const lc of input.logoAnalysis.dominantColors) {
      const key = lc.hex.toUpperCase()
      if (used.has(key)) continue
      if (lc.confidence < 0.6) continue
      pushUnique(secondaryColors, { ...lc, role: 'secondary' })
    }
  }

  const heading = pickFont(input.fonts, 'heading')
  const body = pickFont(input.fonts, 'body')
  const navigation = pickFont(input.fonts, 'navigation')
  // Button font: verified button-role evidence only (may match heading/body — still record role)
  const buttonFontHit =
    pickFont(input.fonts, 'button') ||
    input.fonts.find(
      (f) =>
        f.verified &&
        (f.usage === 'button' ||
          (f.usage === 'unknown' && /button|btn|c-btn/i.test(f.source + (f.usageContext || '')))),
    )

  const colorDetails = [
    ...primaryColors,
    ...secondaryColors,
    ...accentColors,
    ...backgroundColors,
    ...textColors,
    ...campaignColors,
    ...productColors,
  ].filter((c, i, arr) => arr.findIndex((x) => x.hex === c.hex && x.role === c.role) === i)

  const fontDetails: BrandFontEntry[] = []
  if (heading) fontDetails.push(toBrandFont(heading, 'heading'))
  if (body) fontDetails.push(toBrandFont(body, 'body'))
  if (navigation) fontDetails.push(toBrandFont(navigation, 'navigation'))
  if (buttonFontHit) fontDetails.push(toBrandFont(buttonFontHit, 'button'))
  for (const f of input.fonts) {
    if (fontDetails.some((x) => x.name.toLowerCase() === f.name.toLowerCase())) continue
    fontDetails.push(toBrandFont(f))
  }

  // Flat hex/name lists — prefer primary→accent→bg→text order, no padding.
  // Logo pixel samples stay in logoAnalysis; distinctive product packaging hues can join.
  const colors: string[] = []
  const pushFlat = (c: BrandColorEntry) => {
    if (c.source.startsWith('logo:')) return
    if (!colors.includes(c.hex)) colors.push(c.hex)
  }
  for (const group of [primaryColors, accentColors, backgroundColors, textColors, secondaryColors]) {
    for (const c of group) pushFlat(c)
  }
  for (const c of input.colors) {
    if (c.promotional) continue
    if (c.source.startsWith('logo:') || c.source.startsWith('image:')) continue
    if (!colors.includes(c.hex)) colors.push(c.hex)
  }
  // Packaging / product photo accents when CSS palette is thin or missing chroma
  for (const c of productColors) {
    if (colors.length >= 6) break
    if (c.confidence < 0.55) continue
    if (/^#(fff|ffffff|000|000000)$/i.test(c.hex)) continue
    if (!colors.includes(c.hex)) colors.push(c.hex)
  }

  const fonts: string[] = []
  for (const f of [heading, body, navigation, buttonFontHit, ...input.fonts]) {
    if (!f) continue
    if (!fonts.some((n) => n.toLowerCase() === f.name.toLowerCase())) fonts.push(f.name)
  }

  const verifiedRatio =
    (input.colors.filter((c) => c.verified).length +
      input.fonts.filter((f) => f.verified).length) /
    Math.max(1, input.colors.length + input.fonts.length)
  const extractionConfidence = Math.round(
    Math.min(
      0.98,
      0.35 +
        verifiedRatio * 0.4 +
        Math.min(0.15, input.stylesheetsFetched * 0.02) +
        (input.extractionMethod.includes('render') ? 0.12 : 0) +
        (input.logoAnalysis?.analyzed ? 0.05 : 0),
    ) * 100,
  ) / 100

  return {
    brandName: input.brandName,
    websiteUrl: input.websiteUrl,
    primaryColors,
    secondaryColors,
    accentColors,
    backgroundColors,
    textColors,
    campaignColors,
    productColors,
    headingFont: heading ? toBrandFont(heading, 'heading') : undefined,
    bodyFont: body ? toBrandFont(body, 'body') : undefined,
    navigationFont: navigation ? toBrandFont(navigation, 'navigation') : undefined,
    buttonFont: buttonFontHit ? toBrandFont(buttonFontHit, 'button') : undefined,
    brandVoice: input.brandVoice,
    brandKeywords: input.brandKeywords || [],
    targetAudience: input.targetAudience,
    industry: input.industry,
    styleNotes: input.styleNotes,
    logoAnalysis: input.logoAnalysis,
    visualStyle: input.visualStyle,
    extractionConfidence,
    extractionWarnings: input.warnings.slice(0, 16),
    extractionMethod: input.extractionMethod,
    stylesheetsFetched: input.stylesheetsFetched,
    aiRefined: input.aiRefined === true,
    paletteIncomplete: input.paletteIncomplete === true || colors.length < 3,
    colorDetails,
    fontDetails,
    colors: colors.slice(0, 10),
    fonts: fonts.slice(0, 4),
  }
}
