/**
 * LUCE AI Campaign Generation Contract
 *
 * Encodes the platform system prompt: product is source of truth, asset type
 * and format are hard requirements, prompts/refs are secondary, conflict
 * priority is fixed, and model params must be explicit (never inferred).
 */

export type AssetModality = 'image' | 'video'

export type AspectRatioId = '1:1' | '4:5' | '9:16' | '16:9' | '3:4'

export type OrientationId = 'square' | 'portrait' | 'vertical' | 'landscape'

export type PlatformHint =
  | 'instagram_feed'
  | 'instagram_story'
  | 'instagram_reel'
  | 'tiktok'
  | 'youtube'
  | 'ecommerce'
  | 'ads'
  | 'generic'

export type FormatSpec = {
  aspectRatio: AspectRatioId
  orientation: OrientationId
  platform: PlatformHint
  /** Human label for prompts, e.g. "Instagram Reel · 9:16" */
  label: string
  resolutionHint?: string
}

export type BrandKitBits = {
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

export type CreativeDirectionBits = {
  prompt?: string
  lighting?: string
  background?: string
  mood?: string
  styleTheme?: string
  /** User-selected Size in Studio — hard override of format default when set. */
  aspectRatio?: AspectRatioId
  /** Spoken language for video dialogue (e.g. "Urdu (اردو)") */
  language?: string
  brandKit?: BrandKitBits
}

export function isAspectRatioId(value: unknown): value is AspectRatioId {
  return (
    value === '1:1' ||
    value === '4:5' ||
    value === '9:16' ||
    value === '16:9' ||
    value === '3:4'
  )
}

/** Apply Studio Size selection on top of the format’s default frame. */
export function withAspectOverride(
  format: FormatSpec,
  aspectRatio?: AspectRatioId | string,
): FormatSpec {
  if (!isAspectRatioId(aspectRatio) || aspectRatio === format.aspectRatio) {
    return format
  }
  const orientation: OrientationId =
    aspectRatio === '1:1'
      ? 'square'
      : aspectRatio === '16:9'
        ? 'landscape'
        : aspectRatio === '9:16'
          ? 'vertical'
          : 'portrait'
  const platform =
    aspectRatio === '9:16'
      ? ('instagram_story' as PlatformHint)
      : aspectRatio === '16:9'
        ? ('youtube' as PlatformHint)
        : format.platform
  return {
    ...format,
    aspectRatio,
    orientation,
    platform,
    label: `${format.label.split('·')[0]?.trim() || format.label} · ${aspectRatio}`,
    resolutionHint:
      aspectRatio === '1:1'
        ? '1080×1080'
        : aspectRatio === '4:5'
          ? '1080×1350'
          : aspectRatio === '9:16'
            ? '1080×1920'
            : aspectRatio === '16:9'
              ? '1920×1080'
              : format.resolutionHint,
  }
}

/** Render brand kit constraints for image/video prompts. */
export function renderBrandKitBlock(kit?: BrandKitBits): string {
  if (!kit) return ''
  const lines: string[] = [
    '=== BRAND KIT (HARD REQUIREMENT — FETCHED BRAND DETAILS) ===',
    'These fields were extracted from the brand’s real website/kit. KEEP THEM FRONT OF MIND for every creative decision.',
    'Apply them to lighting, palette, set, mood, typography feel, motion style, and advertising look — not as optional flavor.',
  ]
  if (kit.brandName?.trim()) lines.push(`Brand name: ${kit.brandName.trim()}`)
  if (kit.industry?.trim()) lines.push(`Industry: ${kit.industry.trim()}`)
  if (kit.colors?.length) lines.push(`Verified brand colors: ${kit.colors.join(', ')}`)
  if (kit.fonts?.length) lines.push(`Brand fonts (typography feel): ${kit.fonts.join(', ')}`)
  if (kit.voice?.trim()) lines.push(`Brand voice / tone: ${kit.voice.trim()}`)
  if (kit.brandKeywords?.length) {
    lines.push(`Brand keywords: ${kit.brandKeywords.join(', ')}`)
  }
  if (kit.styleNotes?.trim()) lines.push(`Style notes: ${kit.styleNotes.trim()}`)
  if (kit.photographyStyle?.trim()) {
    lines.push(`Photography style: ${kit.photographyStyle.trim()}`)
  }
  if (kit.lightingPreferences?.trim()) {
    lines.push(`Lighting: ${kit.lightingPreferences.trim()}`)
  }
  if (kit.compositionPreferences?.trim()) {
    lines.push(`Composition: ${kit.compositionPreferences.trim()}`)
  }
  if (kit.graphicDesignDirection?.trim()) {
    lines.push(`Graphic direction: ${kit.graphicDesignDirection.trim()}`)
  }
  if (kit.packagingIdentity?.trim()) {
    lines.push(
      `Packaging identity (do not redesign SKU): ${kit.packagingIdentity.trim()}`,
    )
  }
  if (kit.socialMediaDirection?.trim()) {
    lines.push(`Social direction: ${kit.socialMediaDirection.trim()}`)
  }
  if (kit.advertisingStyle?.trim()) {
    lines.push(`Advertising style: ${kit.advertisingStyle.trim()}`)
  }
  if (kit.ctaPreferences?.trim()) lines.push(`CTA style: ${kit.ctaPreferences.trim()}`)
  if (kit.positioning?.length) {
    lines.push(`Positioning: ${kit.positioning.filter(Boolean).join('; ')}`)
  }
  if (kit.thingsToAvoid?.length) {
    lines.push(`Avoid: ${kit.thingsToAvoid.join('; ')}`)
  }
  if (kit.brandRestrictions?.length) {
    lines.push(`Restrictions: ${kit.brandRestrictions.join('; ')}`)
  }
  if (lines.length <= 3) return ''
  lines.push(
    'Brand-kit lock: lighting, palette, typography feel, photography style, graphic/ad direction, and overall aesthetic MUST match this kit unless the user prompt explicitly overrides a specific field.',
  )
  lines.push(
    'Generic stock “AI product photo” look that ignores this brand kit → failure.',
  )
  lines.push(
    'PRODUCT RULE: brand styling must never distort the actual uploaded product packaging, label, or shape.',
  )
  return lines.join('\n')
}

export type LuceGenerationSpec = {
  modality: AssetModality
  assetType: string
  assetLabel: string
  productName: string
  format: FormatSpec
  durationSeconds?: number
  creativeDirection?: CreativeDirectionBits
  recreateNote?: string
  hasProductImage: boolean
  hasReferenceImage: boolean
  hasReferenceVideoFrame: boolean
  /** Format-specific shoot / motion contract body */
  formatContractBody: string
  /** Extra beat for video structure (UGC, unboxing, etc.) */
  structureBeat?: string
}

/**
 * Conflict priority — when user provides reference + format: mix BOTH accordingly.
 * Product stays locked; reference supplies look; format supplies shoot structure + frame.
 */
export const LUCE_PRIORITY = `CONFLICT PRIORITY (highest first):
1) Product accuracy (IMAGE 1) — exact packaging, shape, colors, label, brand (NEVER redesign the SKU)
2) Selected format — FOLLOW ACCORDINGLY: asset type rules + aspect ratio + orientation + camera/framing for that format (packshot / window / flatlay / hand / editorial / promo, etc.)
3) Brand kit (when provided) — KEEP FETCHED BRAND DETAILS FRONT OF MIND: verified colors, voice, photography/lighting/composition, graphic & advertising direction, packaging identity, keywords, things to avoid. The output must look like THIS brand, not a generic DTC template.
4) Reference look (IMAGE 2, when provided) — FOLLOW ACCORDINGLY: lighting quality, color palette, mood, backdrop character, props, pour/drip, material feel from the reference — still inside brand-kit constraints
5) User creative prompt — MUST follow for spoken language, dialogue/script language (e.g. Urdu, English), lines, tone, and any explicit creative request; refine inside product + format + brand kit (+ reference when present). Never ignore language or speaking instructions from the user.
6) LUCE default — only if no brand kit, no reference, and no user prompt

MIX RULE (brand + reference + format together):
Result = IMAGE 1 product + brand kit identity + IMAGE 2 visual language (if any) + selected format’s shoot structure.
- Format answers: “what kind of shot is this?” (hero packshot vs flatlay vs in-hand vs window, etc.) and the exact frame ratio.
- Brand kit answers: “who is this brand?” (palette, voice, photo style, ad direction, avoid list).
- Reference answers: “what should it feel/look like?” (colors, light, set character, effects) — blend with brand kit, do not overwrite brand identity.
- Never drop the product. Never ignore the format type. Never ignore the brand kit when provided. Never ignore the reference when IMAGE 2 is present.`

export const LUCE_PRODUCT_RULES = `PRODUCT + REFERENCE + FORMAT MIX (IMAGE EDIT):
- IMAGE 1 = product packaging ground truth. Same physical item: shape, proportions, label, logo, colors, materials.
- IMAGE 2 (when present) = style/mood reference. Carry its look into the shot.
- Selected format = shoot type + frame. Obey camera, composition, and aspect for that format.
- Blend: format structure + reference look + IMAGE 1 product.
- Do NOT redesign the SKU. Do NOT skip format rules. Do NOT skip the reference look when provided.
- No claims the user did not provide. No random text overlays or fake UI.`

export const LUCE_DEFAULT_CREATIVE = `LUCE DEFAULT (when user prompt is empty):
Premium, modern, clean, professional, product-focused, commercial-quality for a real e-commerce brand.
Avoid generic AI backgrounds and excessive effects unless requested.`

/** Default format per image asset — hard requirement, not a suggestion. */
export function formatForImageAsset(assetType: string): FormatSpec {
  switch (assetType) {
    case 'photo_social_feed':
      return {
        aspectRatio: '1:1',
        orientation: 'square',
        platform: 'instagram_feed',
        label: 'Instagram Feed · Square 1:1',
        resolutionHint: '1080×1080',
      }
    case 'ad_creative':
    case 'photo_promo_offer':
    case 'promo_creative':
      return {
        aspectRatio: '1:1',
        orientation: 'square',
        platform: 'ads',
        label: 'Ad / Promo · Square 1:1',
        resolutionHint: '1080×1080',
      }
    case 'photo_hand_model':
    case 'photo_flatlay':
    case 'photo_studio_packshot':
    case 'photo_window_daylight':
    case 'photo_moody_editorial':
    case 'product_image':
    case 'lifestyle_image':
    case 'photo_lifestyle_home':
    case 'photo_shelf_context':
    case 'photo_detail_macro':
    default:
      return {
        aspectRatio: '4:5',
        orientation: 'portrait',
        platform: 'instagram_feed',
        label: 'Instagram Feed · Portrait 4:5',
        resolutionHint: '1080×1350',
      }
  }
}

/** All Video Studio formats are short-form vertical unless overridden. */
export function formatForVideoAsset(assetType: string): FormatSpec {
  void assetType
  return {
    aspectRatio: '9:16',
    orientation: 'vertical',
    platform: 'instagram_reel',
    label: 'Instagram Reel / TikTok · Vertical 9:16',
    resolutionHint: '1080×1920 · 768p generation',
  }
}

export function buildLuceSpec(input: {
  modality: AssetModality
  assetType: string
  assetLabel: string
  productName: string
  formatContractBody: string
  structureBeat?: string
  durationSeconds?: number
  creativeDirection?: CreativeDirectionBits
  recreateNote?: string
  hasProductImage: boolean
  hasReferenceImage?: boolean
  hasReferenceVideoFrame?: boolean
  formatOverride?: FormatSpec
}): LuceGenerationSpec {
  const format =
    input.formatOverride ||
    (input.modality === 'video'
      ? formatForVideoAsset(input.assetType)
      : formatForImageAsset(input.assetType))

  return {
    modality: input.modality,
    assetType: input.assetType,
    assetLabel: input.assetLabel,
    productName: input.productName.trim() || 'Product',
    format,
    durationSeconds: input.durationSeconds,
    creativeDirection: input.creativeDirection,
    recreateNote: input.recreateNote,
    hasProductImage: input.hasProductImage,
    hasReferenceImage: Boolean(input.hasReferenceImage),
    hasReferenceVideoFrame: Boolean(input.hasReferenceVideoFrame),
    formatContractBody: input.formatContractBody,
    structureBeat: input.structureBeat,
  }
}

function refsBlock(spec: LuceGenerationSpec): string {
  const lines = [
    `This is IMAGE EDITING from the attached reference(s).`,
    `IMAGE 1 = product photo — lock packaging 1:1 (shape, label, logo, colors).`,
  ]
  if (spec.hasReferenceImage) {
    lines.push(
      `IMAGE 2 = USER REFERENCE — apply its look (backdrop, light, mood, pour/drip, props, palette).`,
      `FORMAT = ${spec.format.label} (${spec.format.aspectRatio}) — apply its shoot structure (camera, composition, what makes this format recognizable).`,
      `BLEND: same product as IMAGE 1 + look of IMAGE 2 + structure of the selected format.`,
      `Never swap in IMAGE 2’s product/brand. Never ignore format rules. Never ignore IMAGE 2’s look.`,
    )
  } else {
    lines.push(
      `No separate reference image — IMAGE 1 is also the LOOK reference. Keep its backdrop, effects, palette, and set while applying the selected format’s shoot structure.`,
    )
  }
  if (spec.hasReferenceVideoFrame) {
    lines.push(
      `Optional video-frame reference = motion/pacing inspiration only. Keep IMAGE 1 product; blend IMAGE 2 look with format when present.`,
    )
  }
  if (!spec.hasProductImage) {
    lines.push(`WARNING: No product image provided — product accuracy cannot be guaranteed.`)
  }
  lines.push(
    `Output frame MUST be exactly ${spec.format.aspectRatio} (${spec.format.label}).`,
  )
  return lines.join('\n')
}

function userPromptBlock(spec: LuceGenerationSpec): string {
  const user = spec.creativeDirection?.prompt?.trim()
  const recreate = spec.recreateNote?.trim()
  if (!user && !recreate) {
    return spec.hasReferenceImage
      ? 'No optional text prompt — blend IMAGE 2 look with the selected format’s shoot rules.'
      : `${LUCE_DEFAULT_CREATIVE}\nNo optional user prompt — invent a professional direction that still obeys product + format rules.`
  }
  const parts: string[] = []
  if (user) {
    parts.push(`USER PROMPT: ${user}`)
    parts.push(
      'USER PROMPT REQUIREMENTS: Obey any spoken language, dialogue language (e.g. Urdu, English), script lines, tone, and other explicit creative requests in the user prompt. Do not drop or ignore these.',
    )
  }
  if (recreate) parts.push(`RECREATE NOTE: ${recreate}`)
  parts.push(
    spec.hasReferenceImage
      ? 'Combine user text with IMAGE 2 look AND the selected format. Product accuracy first; then satisfy both reference and format. User language/speaking requests still apply.'
      : 'Combine user prompt with asset type + format. If they conflict: product accuracy wins, then format — but still honor user language, dialogue, and explicit creative requests.',
  )
  return parts.join('\n')
}

/**
 * Full model prompt for IMAGE generation from a LUCE spec.
 */
export function renderImagePrompt(spec: LuceGenerationSpec): string {
  const { format } = spec
  const refGoal = spec.hasReferenceImage
    ? `MIX accordingly: IMAGE 1 product + IMAGE 2 reference look + ${format.label} format (${format.aspectRatio}) — follow both reference and format.`
    : `Reshoot IMAGE 1 for this format — keep packaging and IMAGE 1’s styled look; follow ${format.label} (${format.aspectRatio}).`
  const brandBlock = renderBrandKitBlock(spec.creativeDirection?.brandKit)
  return `You are the LUCE AI generation engine for a marketing campaign platform.

SYSTEM: When a BRAND KIT block is present below, treat those fetched brand details as hard creative constraints for this image — colors, voice, photography, lighting, composition, graphic/ad direction, and avoid lists must shape the final still.

TASK: IMAGE EDIT — produce ONE ${spec.assetLabel} still. ${refGoal}
ASSET TYPE: ${spec.assetType} (${spec.assetLabel})
PRODUCT: "${spec.productName}"

=== FORMAT (MUST FOLLOW) ===
Platform / use: ${format.label}
Orientation: ${format.orientation}
Aspect ratio: ${format.aspectRatio}${format.resolutionHint ? `\nTarget: ${format.resolutionHint}` : ''}
Hard requirements: correct ${format.aspectRatio} frame; recognizable ${spec.assetLabel} shoot structure; product fully visible.
${spec.hasReferenceImage ? 'Apply IMAGE 2’s look inside this format — do not drop format rules, do not drop the reference.' : 'Follow the format contract for scene and camera.'}

=== INPUTS ===
${refsBlock(spec)}

${LUCE_PRODUCT_RULES}

=== FORMAT CONTRACT ===
${spec.formatContractBody}

${brandBlock}

=== OPTIONAL CREATIVE DIRECTION ===
${userPromptBlock(spec)}
Lighting preference: ${spec.creativeDirection?.lighting || 'default'}
Background preference: ${spec.creativeDirection?.background || 'default'}
Mood: ${spec.creativeDirection?.mood || 'default'}
Style theme: ${spec.creativeDirection?.styleTheme || 'default'}

${LUCE_PRIORITY}

=== OUTPUT RULES ===
- Photorealistic commercial quality unless the user asked otherwise.
- No watermarks, no fake UI, no invented price tags or captions burned in.
- Must be ${format.aspectRatio}. Must look like the same product as IMAGE 1.
- Must clearly read as ${spec.assetLabel} (format followed).
- If a brand kit was provided: must clearly read as that brand’s look (palette/style/direction) — generic kit-ignored output → failure.
- If packaging drifts → failure. If format is wrong → failure. If aspect ratio is wrong → failure.
${
  spec.hasReferenceImage
    ? `- Must also clearly carry IMAGE 2’s look (palette/light/set character) — weak hint only → failure.
- Filter-only copy of IMAGE 1 that skips format or reference → failure.`
    : `- Filter-only copy of the upload with no real format/look work → failure.`
}

Generate the final ${format.aspectRatio} ${spec.assetLabel} image now.`
}

/**
 * Full model prompt for VIDEO motion (image-to-video) from a LUCE spec.
 */
export function renderVideoMotionPrompt(spec: LuceGenerationSpec): string {
  const { format } = spec
  const duration = spec.durationSeconds ?? 5
  const brandBlock = renderBrandKitBlock(spec.creativeDirection?.brandKit)
  return `You are the LUCE AI generation engine for a marketing campaign platform.

SYSTEM: When a BRAND KIT block is present below, keep those fetched brand details front of mind for motion, lighting continuity, mood, and advertising feel throughout the clip.

TASK: Generate ONE VIDEO clip via image-to-video from the provided first frame.
ASSET TYPE: ${spec.assetType} (${spec.assetLabel})
PRODUCT: "${spec.productName}"

=== FORMAT (HARD REQUIREMENT) ===
Platform / use: ${format.label}
Orientation: ${format.orientation}
Aspect ratio: ${format.aspectRatio}
Duration: ${duration} seconds
Resolution target: ${format.resolutionHint || '768p'}
Do not generate landscape or square when vertical was selected.

=== PRODUCT + FRAME ===
Animate THIS exact first frame. Keep packaging, label, logo, shape, and colors EXACT throughout every frame.
No product morphing, no swapped SKU, no label drift between frames.

${LUCE_PRODUCT_RULES}

=== VIDEO STRUCTURE (${spec.assetLabel}) ===
${spec.structureBeat || ''}
${spec.formatContractBody ? `\nMotion detail:\n${spec.formatContractBody}` : ''}

${brandBlock}

=== OPTIONAL CREATIVE DIRECTION ===
${userPromptBlock(spec)}

${LUCE_PRIORITY}

=== OUTPUT RULES ===
- Photorealistic, smooth motion, natural pacing for ${format.platform}.
- No watermarks, no UI chrome, no fake burned-in captions/subtitles.
- Clip must read as ${spec.assetLabel} content in ${format.aspectRatio} for ${duration}s.
- If a brand kit was provided: motion mood, lighting continuity, and overall ad feel must stay on-brand — kit-ignored generic motion → failure.

Generate the ${duration}s ${format.aspectRatio} ${spec.assetLabel} video now.`
}

/**
 * Keyframe (still) prompt before person-led video — still obeys LUCE contract.
 */
export function renderVideoKeyframePrompt(spec: LuceGenerationSpec): string {
  const { format } = spec
  const brandBlock = renderBrandKitBlock(spec.creativeDirection?.brandKit)
  return `You are the LUCE AI generation engine. Create the FIRST FRAME still for a ${spec.assetLabel} video.

SYSTEM: When a BRAND KIT block is present, apply those fetched brand details to the keyframe look before motion starts.

PRODUCT: "${spec.productName}"
FORMAT: ${format.label} (${format.aspectRatio})
This still will be animated — compose for vertical video framing.

=== INPUTS ===
${refsBlock(spec)}

${LUCE_PRODUCT_RULES}

=== KEYFRAME SCENE ===
${spec.formatContractBody}

${brandBlock}

=== OPTIONAL CREATIVE DIRECTION ===
${userPromptBlock(spec)}

${LUCE_PRIORITY}

Photorealistic still. No text overlays. Product packaging exact. Suitable as frame 1 of a ${format.aspectRatio} ${spec.assetLabel} clip.`
}
