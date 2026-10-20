/** Creative direction options shared across image, video, ads, and campaign flows. */

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

export type CreativeDirection = {
  prompt?: string
  lighting?: LightingId
  background?: BackgroundId
  mood?: MoodId
  styleTheme?: StyleThemeId
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

export function sanitizeCreativeDirection(input: {
  prompt?: string
  lighting?: string
  background?: string
  mood?: string
  styleTheme?: string
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

  if (!prompt && !lighting && !background && !mood && !styleTheme) return undefined
  // Omit undefined keys — Firestore rejects them (and nested arrays of maps with undefined).
  const out: CreativeDirection = {}
  if (prompt) out.prompt = prompt
  if (lighting) out.lighting = lighting
  if (background) out.background = background
  if (mood) out.mood = mood
  if (styleTheme) out.styleTheme = styleTheme
  return out
}
