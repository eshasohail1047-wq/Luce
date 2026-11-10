export type FetchedBrandProduct = {
  name: string
  imageUrl: string
  sourceUrl?: string
}

export type ExtractedColor = {
  hex: string
  classification: string
  source: string
  confidence: number
  property?: string
  cssVariable?: string
  usageContext?: string
  verified?: boolean
  promotional?: boolean
  themeKind?: string
  occurrences?: number
  evidence?: string
  verificationStatus?: 'verified' | 'ai-inferred' | 'unknown'
}

export type ExtractedFont = {
  name: string
  usage: string
  source: string
  confidence: number
  estimated?: boolean
  verified?: boolean
  property?: string
  cssVariable?: string
  usageContext?: string
  fontFileLoaded?: boolean
  computedStack?: string
  evidence?: string
  verificationStatus?: 'verified' | 'ai-inferred' | 'unknown'
}

export type BrandColorEntry = {
  hex: string
  role: string
  classification: string
  source: string
  confidence: number
  verified: boolean
  estimated: boolean
  promotional?: boolean
  property?: string
  cssVariable?: string
  usageContext?: string
  themeKind?: string
  occurrences?: number
  evidence?: string
  verificationStatus?: 'verified' | 'ai-inferred' | 'unknown'
}

export type BrandFontEntry = {
  name: string
  usage: string
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
  logoAnalysis?: {
    sourceUrl?: string
    dominantColors: BrandColorEntry[]
    notes?: string
    analyzed: boolean
  }
  visualStyle?: {
    photographyStyle?: string
    backgroundStyle?: string
    layoutPatterns?: string[]
    consistencyNotes?: string
    imageColors: BrandColorEntry[]
  }
  extractionConfidence: number
  extractionWarnings: string[]
  extractionMethod: string
  stylesheetsFetched: number
  aiRefined: boolean
  paletteIncomplete: boolean
  colorDetails: BrandColorEntry[]
  fontDetails: BrandFontEntry[]
  colors: string[]
  fonts: string[]
}

export type EvidenceStatus = 'verified' | 'ai-inferred' | 'unknown'

export type EvidenceField<T = string> = {
  value: T
  status: EvidenceStatus
  evidence?: string
  source?: string
}

export type CompleteBrandKit = Record<string, EvidenceField<unknown>>

export type ScanProgressEvent = {
  type: 'progress'
  stageId: string
  status: string
  pct: number
  label: string
  message?: string
  stats?: {
    pages?: number
    products?: number
    images?: number
    colors?: number
    fonts?: number
    stylesheets?: number
  }
  preview?: {
    logoUrl?: string
    imageUrls?: string[]
    colors?: string[]
    businessName?: string
  }
}

export type FetchedProductPage = {
  url: string
  title?: string
  description?: string
  images: string[]
  logoUrl?: string
  colors?: string[]
  fonts?: string[]
  colorDetails?: ExtractedColor[]
  fontDetails?: ExtractedFont[]
  markets?: string[]
  audienceHint?: string
  products?: FetchedBrandProduct[]
  aiRefined?: boolean
  category?: string
  brandVoice?: string
  styleNotes?: string
  extractionMethod?: string
  warnings?: string[]
  stylesheetsFetched?: number
  paletteIncomplete?: boolean
  brandProfile?: BrandProfile
  brandKeywords?: string[]
  extractionConfidence?: number
  completeBrandKit?: CompleteBrandKit
  aiWarning?: string
}

export type FetchedRemoteMedia = {
  dataUrl: string
  contentType: string
  kind: 'image' | 'video'
  byteLength: number
}

function isColorDetail(c: unknown): c is ExtractedColor {
  return (
    !!c &&
    typeof c === 'object' &&
    typeof (c as ExtractedColor).hex === 'string' &&
    typeof (c as ExtractedColor).source === 'string'
  )
}

function isFontDetail(f: unknown): f is ExtractedFont {
  return (
    !!f &&
    typeof f === 'object' &&
    typeof (f as ExtractedFont).name === 'string' &&
    typeof (f as ExtractedFont).source === 'string'
  )
}

export async function requestFetchProductPage(
  productUrl: string,
  options: { mode?: 'product' | 'brand' } = {},
): Promise<FetchedProductPage> {
  const mode = options.mode === 'brand' ? 'brand' : 'product'
  const res = await fetch('/api/fetch-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: productUrl.trim(), mode }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    url?: string
    title?: string
    description?: string
    images?: string[]
    logoUrl?: string
    colors?: string[]
    fonts?: string[]
    colorDetails?: ExtractedColor[]
    fontDetails?: ExtractedFont[]
    markets?: string[]
    audienceHint?: string
    products?: FetchedBrandProduct[]
    aiRefined?: boolean
    category?: string
    brandVoice?: string
    styleNotes?: string
    extractionMethod?: string
    warnings?: string[]
    stylesheetsFetched?: number
    paletteIncomplete?: boolean
    brandProfile?: BrandProfile
    brandKeywords?: string[]
    extractionConfidence?: number
    completeBrandKit?: CompleteBrandKit
    aiWarning?: string
  }
  if (!res.ok || !data.ok || !Array.isArray(data.images)) {
    throw new Error(data.error || `Could not fetch product photos (${res.status})`)
  }
  if (mode === 'product' && !data.images.length) {
    throw new Error(data.error || `Could not fetch product photos (${res.status})`)
  }
  return {
    url: data.url || productUrl.trim(),
    title: data.title,
    description: data.description,
    images: data.images,
    logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : undefined,
    colors: Array.isArray(data.colors)
      ? data.colors.filter((c): c is string => typeof c === 'string')
      : undefined,
    fonts: Array.isArray(data.fonts)
      ? data.fonts.filter((f): f is string => typeof f === 'string')
      : undefined,
    colorDetails: Array.isArray(data.colorDetails)
      ? data.colorDetails.filter(isColorDetail)
      : undefined,
    fontDetails: Array.isArray(data.fontDetails)
      ? data.fontDetails.filter(isFontDetail)
      : undefined,
    markets: Array.isArray(data.markets)
      ? data.markets.filter((m): m is string => typeof m === 'string')
      : undefined,
    audienceHint: typeof data.audienceHint === 'string' ? data.audienceHint : undefined,
    products: Array.isArray(data.products)
      ? data.products.filter(
          (p): p is FetchedBrandProduct =>
            !!p &&
            typeof p === 'object' &&
            typeof p.name === 'string' &&
            typeof p.imageUrl === 'string',
        )
      : undefined,
    aiRefined: data.aiRefined === true,
    category: typeof data.category === 'string' ? data.category : undefined,
    brandVoice: typeof data.brandVoice === 'string' ? data.brandVoice : undefined,
    styleNotes: typeof data.styleNotes === 'string' ? data.styleNotes : undefined,
    extractionMethod:
      typeof data.extractionMethod === 'string' ? data.extractionMethod : undefined,
    warnings: Array.isArray(data.warnings)
      ? data.warnings.filter((w): w is string => typeof w === 'string')
      : undefined,
    stylesheetsFetched:
      typeof data.stylesheetsFetched === 'number'
        ? data.stylesheetsFetched
        : undefined,
    paletteIncomplete: data.paletteIncomplete === true,
    brandProfile:
      data.brandProfile && typeof data.brandProfile === 'object'
        ? data.brandProfile
        : undefined,
    brandKeywords: Array.isArray(data.brandKeywords)
      ? data.brandKeywords.filter((k): k is string => typeof k === 'string')
      : undefined,
    extractionConfidence:
      typeof data.extractionConfidence === 'number'
        ? data.extractionConfidence
        : undefined,
    completeBrandKit:
      data.completeBrandKit && typeof data.completeBrandKit === 'object'
        ? (data.completeBrandKit as CompleteBrandKit)
        : undefined,
    aiWarning: typeof data.aiWarning === 'string' ? data.aiWarning : undefined,
  }
}

function parseFetchedPagePayload(
  data: Record<string, unknown>,
  fallbackUrl: string,
): FetchedProductPage {
  return {
    url: (typeof data.url === 'string' && data.url) || fallbackUrl,
    title: typeof data.title === 'string' ? data.title : undefined,
    description: typeof data.description === 'string' ? data.description : undefined,
    images: Array.isArray(data.images)
      ? data.images.filter((u): u is string => typeof u === 'string')
      : [],
    logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : undefined,
    colors: Array.isArray(data.colors)
      ? data.colors.filter((c): c is string => typeof c === 'string')
      : undefined,
    fonts: Array.isArray(data.fonts)
      ? data.fonts.filter((f): f is string => typeof f === 'string')
      : undefined,
    colorDetails: Array.isArray(data.colorDetails)
      ? data.colorDetails.filter(isColorDetail)
      : undefined,
    fontDetails: Array.isArray(data.fontDetails)
      ? data.fontDetails.filter(isFontDetail)
      : undefined,
    markets: Array.isArray(data.markets)
      ? data.markets.filter((m): m is string => typeof m === 'string')
      : undefined,
    audienceHint: typeof data.audienceHint === 'string' ? data.audienceHint : undefined,
    products: Array.isArray(data.products)
      ? data.products.filter(
          (p): p is FetchedBrandProduct =>
            !!p &&
            typeof p === 'object' &&
            typeof (p as FetchedBrandProduct).name === 'string' &&
            typeof (p as FetchedBrandProduct).imageUrl === 'string',
        )
      : undefined,
    aiRefined: data.aiRefined === true,
    category: typeof data.category === 'string' ? data.category : undefined,
    brandVoice: typeof data.brandVoice === 'string' ? data.brandVoice : undefined,
    styleNotes: typeof data.styleNotes === 'string' ? data.styleNotes : undefined,
    extractionMethod:
      typeof data.extractionMethod === 'string' ? data.extractionMethod : undefined,
    warnings: Array.isArray(data.warnings)
      ? data.warnings.filter((w): w is string => typeof w === 'string')
      : undefined,
    stylesheetsFetched:
      typeof data.stylesheetsFetched === 'number' ? data.stylesheetsFetched : undefined,
    paletteIncomplete: data.paletteIncomplete === true,
    brandProfile:
      data.brandProfile && typeof data.brandProfile === 'object'
        ? (data.brandProfile as BrandProfile)
        : undefined,
    brandKeywords: Array.isArray(data.brandKeywords)
      ? data.brandKeywords.filter((k): k is string => typeof k === 'string')
      : undefined,
    extractionConfidence:
      typeof data.extractionConfidence === 'number'
        ? data.extractionConfidence
        : undefined,
    completeBrandKit:
      data.completeBrandKit && typeof data.completeBrandKit === 'object'
        ? (data.completeBrandKit as CompleteBrandKit)
        : undefined,
    aiWarning: typeof data.aiWarning === 'string' ? data.aiWarning : undefined,
  }
}

/** Onboarding brand scan with real NDJSON progress events. */
export async function requestScanWebsite(
  websiteUrl: string,
  options?: {
    onProgress?: (event: ScanProgressEvent) => void
    signal?: AbortSignal
  },
): Promise<FetchedProductPage> {
  const res = await fetch('/api/fetch-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: websiteUrl.trim(),
      mode: 'brand',
      stream: true,
    }),
    signal: options?.signal,
  })

  // Fallback: non-stream JSON if proxy strips streaming
  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  if (!contentType.includes('ndjson') && !contentType.includes('stream')) {
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok || data.ok !== true || !Array.isArray(data.images)) {
      throw new Error(
        (typeof data.error === 'string' && data.error) ||
          `Could not scan website (${res.status})`,
      )
    }
    options?.onProgress?.({
      type: 'progress',
      stageId: 'done',
      status: 'done',
      pct: 100,
      label: 'Brand kit ready',
      stats: {
        images: (data.images as string[]).length,
        colors: Array.isArray(data.colors) ? data.colors.length : 0,
        fonts: Array.isArray(data.fonts) ? data.fonts.length : 0,
        products: Array.isArray(data.products) ? data.products.length : 0,
      },
      preview: {
        logoUrl: typeof data.logoUrl === 'string' ? data.logoUrl : undefined,
        colors: Array.isArray(data.colors)
          ? data.colors.filter((c): c is string => typeof c === 'string')
          : undefined,
        businessName: typeof data.title === 'string' ? data.title : undefined,
        imageUrls: (data.images as string[]).slice(0, 4),
      },
    })
    return parseFetchedPagePayload(data, websiteUrl.trim())
  }

  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error || `Could not scan website (${res.status})`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalPage: FetchedProductPage | null = null
  let streamError: string | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      let event: Record<string, unknown>
      try {
        event = JSON.parse(trimmed) as Record<string, unknown>
      } catch {
        continue
      }
      if (event.type === 'progress') {
        options?.onProgress?.(event as unknown as ScanProgressEvent)
      } else if (event.type === 'result' && event.ok === true) {
        finalPage = parseFetchedPagePayload(event, websiteUrl.trim())
      } else if (event.type === 'error') {
        streamError =
          (typeof event.error === 'string' && event.error) || 'Scan failed'
      }
    }
  }

  if (buffer.trim()) {
    try {
      const event = JSON.parse(buffer.trim()) as Record<string, unknown>
      if (event.type === 'result' && event.ok === true) {
        finalPage = parseFetchedPagePayload(event, websiteUrl.trim())
      } else if (event.type === 'error') {
        streamError =
          (typeof event.error === 'string' && event.error) || 'Scan failed'
      }
    } catch {
      /* ignore */
    }
  }

  if (streamError) throw new Error(streamError)
  if (!finalPage) throw new Error('Scan finished without a brand result.')
  return finalPage
}

export async function requestFetchRemoteMedia(
  mediaUrl: string,
  prefer: 'image' | 'video' | 'any' = 'any',
): Promise<FetchedRemoteMedia> {
  const res = await fetch('/api/fetch-media', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: mediaUrl.trim(), prefer }),
  })
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    dataUrl?: string
    contentType?: string
    kind?: 'image' | 'video'
    byteLength?: number
  }
  if (!res.ok || !data.ok || typeof data.dataUrl !== 'string') {
    throw new Error(data.error || `Could not fetch remote media (${res.status})`)
  }
  return {
    dataUrl: data.dataUrl,
    contentType: data.contentType || 'application/octet-stream',
    kind: data.kind === 'video' ? 'video' : 'image',
    byteLength: typeof data.byteLength === 'number' ? data.byteLength : 0,
  }
}

export async function remoteMediaToFile(
  media: FetchedRemoteMedia,
  filename = 'media',
): Promise<File> {
  const res = await fetch(media.dataUrl)
  const blob = await res.blob()
  const type = media.contentType || blob.type || 'application/octet-stream'
  const ext = type.includes('png')
    ? 'png'
    : type.includes('webp')
      ? 'webp'
      : type.includes('gif')
        ? 'gif'
        : type.includes('webm')
          ? 'webm'
          : type.includes('quicktime') || type.includes('mov')
            ? 'mov'
            : type.startsWith('video/')
              ? 'mp4'
              : 'jpg'
  const name = filename.includes('.') ? filename : `${filename}.${ext}`
  return new File([blob], name, { type })
}
