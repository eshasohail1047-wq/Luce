/** Creative direction options shared across image, video, ads, and campaign flows. */

import type { WorkspaceSettings } from './userSettings'

/** Persisted brand kit slice injected into every generation prompt. */
export type BrandKitDirection = {
  brandName?: string
  colors?: string[]
  fonts?: string[]
  voice?: string
  styleNotes?: string
  industry?: string
  positioning?: string[]
  photographyStyle?: string
  lightingPreferences?: string
  compositionPreferences?: string
  packagingIdentity?: string
  graphicDesignDirection?: string
  socialMediaDirection?: string
  advertisingStyle?: string
  ctaPreferences?: string
  thingsToAvoid?: string[]
  brandRestrictions?: string[]
  brandKeywords?: string[]
}

export type LightingId =
  | 'soft_natural'
  | 'studio_softbox'
  | 'dramatic'
  | 'golden_hour'
  | 'bright_daylight'

export type BackgroundId =
  | 'seamless_studio'
  | 'lifestyle_interior'
  | 'outdoor'
  | 'surface_marble'
  | 'soft_gradient'

export type MoodId =
  | 'premium_clean'
  | 'warm_cozy'
  | 'bold_energetic'
  | 'minimal'
  | 'editorial_beauty'

export type StyleThemeId =
  | 'modern_dtc'
  | 'luxury_beauty'
  | 'clean_clinical'
  | 'playful'
  | 'earthy'

export type AspectRatioId = '1:1' | '4:5' | '9:16' | '16:9'

export const ASPECT_RATIO_OPTIONS: {
  id: AspectRatioId
  label: string
  hint: string
}[] = [
  { id: '1:1', label: '1:1', hint: 'Square feed' },
  { id: '4:5', label: '4:5', hint: 'Portrait feed' },
  { id: '9:16', label: '9:16', hint: 'Story / Reel' },
  { id: '16:9', label: '16:9', hint: 'Widescreen' },
]

export type CreativeDirection = {
  prompt?: string
  lighting?: LightingId
  background?: BackgroundId
  mood?: MoodId
  styleTheme?: StyleThemeId
  /** Hard frame size for generation — overrides format default when set. */
  aspectRatio?: AspectRatioId
  /** Spoken language for video dialogue (Video Studio / Campaign). */
  language?: string
  brandKit?: BrandKitDirection
}

export const LIGHTING_OPTIONS: { id: LightingId; label: string; description: string }[] = [
  { id: 'soft_natural', label: 'Soft natural light', description: 'Gentle daylight feel' },
  { id: 'studio_softbox', label: 'Studio softbox', description: 'Clean controlled studio light' },
  { id: 'dramatic', label: 'Dramatic contrast', description: 'Deeper shadows, high impact' },
  { id: 'golden_hour', label: 'Golden hour', description: 'Warm sunset glow' },
  { id: 'bright_daylight', label: 'Bright daylight', description: 'Crisp, high-key look' },
]

export const BACKGROUND_OPTIONS: { id: BackgroundId; label: string; description: string }[] = [
  { id: 'seamless_studio', label: 'Seamless studio', description: 'Clean backdrop, product-first' },
  { id: 'lifestyle_interior', label: 'Lifestyle interior', description: 'Home or boutique setting' },
  { id: 'outdoor', label: 'Outdoor scene', description: 'Natural environment around the product' },
  { id: 'surface_marble', label: 'Marble / surface', description: 'Premium tabletop styling' },
  { id: 'soft_gradient', label: 'Soft gradient', description: 'Abstract color wash' },
]

export const MOOD_OPTIONS: { id: MoodId; label: string; description: string }[] = [
  { id: 'premium_clean', label: 'Premium & clean', description: 'Polished, brand-ready' },
  { id: 'warm_cozy', label: 'Warm & cozy', description: 'Soft, inviting tone' },
  { id: 'bold_energetic', label: 'Bold & energetic', description: 'High contrast, punchy' },
  { id: 'minimal', label: 'Minimal', description: 'Sparse, quiet, modern' },
  { id: 'editorial_beauty', label: 'Editorial beauty', description: 'Magazine-style framing' },
]

export const STYLE_THEME_OPTIONS: { id: StyleThemeId; label: string; description: string }[] = [
  { id: 'modern_dtc', label: 'Modern DTC', description: 'Shopify-native social aesthetic' },
  { id: 'luxury_beauty', label: 'Luxury beauty', description: 'Fragrance & skincare elegance' },
  { id: 'clean_clinical', label: 'Clean clinical', description: 'Lab-fresh, precise' },
  { id: 'playful', label: 'Playful color', description: 'Bright, youthful energy' },
  { id: 'earthy', label: 'Earthy organic', description: 'Natural textures and tones' },
]

function sanitizeBrandKit(raw: unknown): BrandKitDirection | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const asArr = (v: unknown) =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
      : []
  const brandName = typeof o.brandName === 'string' ? o.brandName.trim() : ''
  const colors = asArr(o.colors)
  const fonts = asArr(o.fonts)
  const voice = typeof o.voice === 'string' ? o.voice.trim() : ''
  const styleNotes = typeof o.styleNotes === 'string' ? o.styleNotes.trim() : ''
  const industry = typeof o.industry === 'string' ? o.industry.trim() : ''
  const positioning = asArr(o.positioning)
  const str = (k: string) =>
    typeof o[k] === 'string' ? (o[k] as string).trim() : ''
  const photographyStyle = str('photographyStyle')
  const lightingPreferences = str('lightingPreferences')
  const compositionPreferences = str('compositionPreferences')
  const packagingIdentity = str('packagingIdentity')
  const graphicDesignDirection = str('graphicDesignDirection')
  const socialMediaDirection = str('socialMediaDirection')
  const advertisingStyle = str('advertisingStyle')
  const ctaPreferences = str('ctaPreferences')
  const thingsToAvoid = asArr(o.thingsToAvoid)
  const brandRestrictions = asArr(o.brandRestrictions)
  const brandKeywords = asArr(o.brandKeywords)
  if (
    !brandName &&
    !colors.length &&
    !fonts.length &&
    !voice &&
    !styleNotes &&
    !industry &&
    !positioning.length &&
    !photographyStyle &&
    !packagingIdentity &&
    !thingsToAvoid.length
  ) {
    return undefined
  }
  const out: BrandKitDirection = {}
  if (brandName) out.brandName = brandName
  if (colors.length) out.colors = colors
  if (fonts.length) out.fonts = fonts
  if (voice) out.voice = voice
  if (styleNotes) out.styleNotes = styleNotes
  if (industry) out.industry = industry
  if (positioning.length) out.positioning = positioning
  if (photographyStyle) out.photographyStyle = photographyStyle
  if (lightingPreferences) out.lightingPreferences = lightingPreferences
  if (compositionPreferences) out.compositionPreferences = compositionPreferences
  if (packagingIdentity) out.packagingIdentity = packagingIdentity
  if (graphicDesignDirection) out.graphicDesignDirection = graphicDesignDirection
  if (socialMediaDirection) out.socialMediaDirection = socialMediaDirection
  if (advertisingStyle) out.advertisingStyle = advertisingStyle
  if (ctaPreferences) out.ctaPreferences = ctaPreferences
  if (thingsToAvoid.length) out.thingsToAvoid = thingsToAvoid
  if (brandRestrictions.length) out.brandRestrictions = brandRestrictions
  if (brandKeywords.length) out.brandKeywords = brandKeywords
  return out
}

/** Build brand kit bits from saved workspace settings for generation requests. */
export function brandKitFromWorkspace(
  workspace: WorkspaceSettings,
): BrandKitDirection | undefined {
  return sanitizeBrandKit({
    brandName: workspace.brandName,
    colors: workspace.brandColors,
    fonts: workspace.brandFonts,
    voice: workspace.brandVoice || workspace.brandTone,
    styleNotes: workspace.brandStyleNotes || workspace.brandPitch,
    industry: workspace.brandIndustry,
    positioning: workspace.brandPositioning,
    photographyStyle: workspace.brandPhotographyStyle,
    lightingPreferences: workspace.brandLighting,
    compositionPreferences: workspace.brandComposition,
    packagingIdentity: workspace.brandPackagingIdentity,
    graphicDesignDirection: workspace.brandGraphicDirection,
    socialMediaDirection: workspace.brandSocialDirection,
    advertisingStyle: workspace.brandAdvertisingStyle,
    ctaPreferences: workspace.brandCtaPreferences,
    thingsToAvoid: workspace.brandThingsToAvoid,
    brandRestrictions: workspace.brandRestrictions,
    brandKeywords: workspace.brandKeywords,
  })
}

export function withBrandKit(
  direction: CreativeDirection | undefined,
  workspace: WorkspaceSettings,
): CreativeDirection | undefined {
  const brandKit = brandKitFromWorkspace(workspace)
  if (!direction && !brandKit) return undefined
  const base = sanitizeCreativeDirection(direction ?? {}) || {}
  if (brandKit) base.brandKit = brandKit
  return Object.keys(base).length ? base : undefined
}

export function sanitizeCreativeDirection(input: {
  prompt?: string
  lighting?: string
  background?: string
  mood?: string
  styleTheme?: string
  aspectRatio?: string
  language?: string
  brandKit?: unknown
}): CreativeDirection | undefined {
  const prompt = input.prompt?.trim() || undefined
  const lighting = LIGHTING_OPTIONS.some((o) => o.id === input.lighting)
    ? (input.lighting as LightingId)
    : undefined
  const background = BACKGROUND_OPTIONS.some((o) => o.id === input.background)
    ? (input.background as BackgroundId)
    : undefined
  const mood = MOOD_OPTIONS.some((o) => o.id === input.mood)
    ? (input.mood as MoodId)
    : undefined
  const styleTheme = STYLE_THEME_OPTIONS.some((o) => o.id === input.styleTheme)
    ? (input.styleTheme as StyleThemeId)
    : undefined
  const aspectRatio = ASPECT_RATIO_OPTIONS.some((o) => o.id === input.aspectRatio)
    ? (input.aspectRatio as AspectRatioId)
    : undefined
  const language =
    typeof input.language === 'string' && input.language.trim()
      ? input.language.trim().slice(0, 80)
      : undefined
  const brandKit = sanitizeBrandKit(input.brandKit)

  if (
    !prompt &&
    !lighting &&
    !background &&
    !mood &&
    !styleTheme &&
    !aspectRatio &&
    !language &&
    !brandKit
  )
    return undefined
  // Omit undefined keys — Firestore rejects them (and nested arrays of maps with undefined).
  const out: CreativeDirection = {}
  if (prompt) out.prompt = prompt
  if (lighting) out.lighting = lighting
  if (background) out.background = background
  if (mood) out.mood = mood
  if (styleTheme) out.styleTheme = styleTheme
  if (aspectRatio) out.aspectRatio = aspectRatio
  if (language) out.language = language
  if (brandKit) out.brandKit = brandKit
  return out
}
