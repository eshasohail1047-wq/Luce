import { generateMuseImage, getMuseApiKey } from './muse'
import {
  buildLuceSpec,
  formatForImageAsset,
  renderImagePrompt,
} from './luceGeneration'
import { generateImage, getOpenRouterApiKey, getOpenRouterImageModel } from './openRouter'
import { prepareReferenceImage } from './prepareImage'
import { getAiProviderStatus, museSizeForAspect } from './providers'

/**
 * Image generation ~$0.03–0.04/image (Nano Banana / Gemini 2.5 Flash Image).
 * Prefer OpenRouter `google/gemini-2.5-flash-image`.
 * Optional fallback: direct Meta Muse when MUSE_API_KEY is set.
 */
export async function generateImageWithProviders(input: {
  prompt: string
  inputReferences?: string[]
  aspectRatio?: string
}): Promise<{ imageDataUrl: string; provider: string }> {
  const refs = input.inputReferences
  const errors: string[] = []

  // 1) OpenRouter Nano Banana (Gemini 2.5 Flash Image) — product + ref + format
  if (getOpenRouterApiKey()) {
    try {
      const model = getOpenRouterImageModel()
      console.info(
        `[generate-images] OpenRouter · ${model}` +
          (input.aspectRatio ? ` · ${input.aspectRatio}` : ''),
      )
      const result = await generateImage({
        prompt: input.prompt,
        inputReferences: refs,
        aspectRatio: input.aspectRatio,
        model,
      })
      console.info('[generate-images] ok via openrouter')
      return { imageDataUrl: result.imageDataUrl, provider: 'openrouter' }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`OpenRouter (${getOpenRouterImageModel()}): ${msg}`)
      console.warn('[generate-images] OpenRouter image failed', msg)
      if (!getMuseApiKey()) throw new Error(errors.join(' | '))
    }
  }

  // 2) Direct Meta Muse when MUSE_API_KEY / MODEL_API_KEY is set
  if (getMuseApiKey()) {
    console.info(
      `[generate-images] Meta Muse direct · size=${museSizeForAspect(input.aspectRatio)}`,
    )
    const result = await generateMuseImage({
      prompt: input.prompt,
      inputImages: refs,
      size: museSizeForAspect(input.aspectRatio),
    })
    console.info('[generate-images] ok via muse-direct')
    return { imageDataUrl: result.imageDataUrl, provider: 'muse' }
  }

  throw new Error(
    errors.length
      ? errors.join(' | ')
      : 'No image provider. Set OPENROUTER_API_KEY (gemini-2.5-flash-image) or MUSE_API_KEY.',
  )
}

export type ImageAssetKind =
  | 'photo_studio_packshot'
  | 'photo_window_daylight'
  | 'photo_moody_editorial'
  | 'photo_hand_model'
  | 'photo_flatlay'
  | 'photo_promo_offer'
  | 'ad_creative'
  /** Legacy */
  | 'product_image'
  | 'lifestyle_image'
  | 'promo_creative'
  | 'photo_lifestyle_home'
  | 'photo_shelf_context'
  | 'photo_detail_macro'
  | 'photo_social_feed'

export const IMAGE_ASSET_KINDS: ImageAssetKind[] = [
  'photo_studio_packshot',
  'photo_window_daylight',
  'photo_moody_editorial',
  'photo_hand_model',
  'photo_flatlay',
  'photo_promo_offer',
  'ad_creative',
  'product_image',
  'lifestyle_image',
  'promo_creative',
  'photo_lifestyle_home',
  'photo_shelf_context',
  'photo_detail_macro',
  'photo_social_feed',
]

export type CreativeDirectionSummary = {
  prompt?: string
  lighting?: string
  background?: string
  mood?: string
  styleTheme?: string
}

export type GenerateImagesInput = {
  productName: string
  productImage?: string
  /** Style/mood reference — not packaging source of truth */
  referenceImage?: string
  creativeDirection?: CreativeDirectionSummary
  assets: ImageAssetKind[]
  recreateNote?: string
}

export type GeneratedAsset = {
  type: ImageAssetKind
  label: string
  imageDataUrl: string
  promptUsed?: string
}

export type GenerateImagesResult =
  | {
      status: 200
      body: {
        ok: true
        assets: GeneratedAsset[]
        partialErrors?: { type: ImageAssetKind; error: string }[]
      }
    }
  | { status: number; body: { ok?: false; error: string } }

const LABELS: Record<ImageAssetKind, string> = {
  photo_studio_packshot: 'Studio packshot',
  photo_window_daylight: 'Window light',
  photo_moody_editorial: 'Moody editorial',
  photo_hand_model: 'In hand',
  photo_flatlay: 'Flatlay',
  photo_promo_offer: 'Promo offer',
  ad_creative: 'Ad creative',
  product_image: 'Studio packshot',
  lifestyle_image: 'Window light',
  promo_creative: 'Promo offer',
  photo_lifestyle_home: 'Window light',
  photo_shelf_context: 'Moody editorial',
  photo_detail_macro: 'Detail macro',
  photo_social_feed: 'Flatlay',
}

/**
 * Hard format contracts — each chosen format maps to fixed shoot rules.
 * Creative direction may refine, never replace these must-haves.
 */
type FormatContract = {
  id: ImageAssetKind
  label: string
  camera: string
  lighting: string
  background: string
  mustInclude: string[]
  mustNot: string[]
  successLooksLike: string
}

const FORMAT_CONTRACTS: Record<ImageAssetKind, FormatContract> = {
  photo_studio_packshot: {
    id: 'photo_studio_packshot',
    label: 'Studio packshot',
    camera: 'Eye-level, centered hero, product fills ~60% of frame, slight 3/4 optional',
    lighting:
      'Match IMAGE 1 lighting mood. If IMAGE 1 is already a styled studio shot, keep that light quality — do not flatten to generic softbox gray.',
    background:
      'KEEP IMAGE 1’s backdrop color, surface, and signature styling (e.g. colored seamless, liquid pour, cream drip, props). Only simplify clutter — never replace a styled set with plain white/gray unless IMAGE 1 is already plain seamless.',
    mustInclude: [
      'Exact product packaging from IMAGE 1',
      'Same visual world as IMAGE 1 (palette, effects, set character)',
      'Product fully visible and sharp, commercial hero framing',
    ],
    mustNot: [
      'Invent a different product or label',
      'Strip away IMAGE 1’s signature look (colored backdrop, pour/drip, props) into empty gray',
      'Hands or clutter that hide the product',
    ],
    successLooksLike:
      'Same product + same styled look as IMAGE 1, cleaned up as a hero packshot for the format frame — not a boring gray catalog void.',
  },
  photo_window_daylight: {
    id: 'photo_window_daylight',
    label: 'Window light',
    camera: 'Slight angle toward a window; product near sill or table by the glass',
    lighting: 'Soft natural daylight from one side (window key light), gentle falloff — still honor IMAGE 1 color story',
    background: 'Bright interior with window cues; weave in IMAGE 1 palette/props where they fit',
    mustInclude: [
      'Obvious window / daylight source in frame or strongly implied',
      'Exact product from IMAGE 1',
      'Airy daylight mood that still feels related to IMAGE 1’s brand look',
    ],
    mustNot: [
      'Wrong product packaging',
      'Ignore IMAGE 1 palette entirely',
      'Dark low-key editorial only',
    ],
    successLooksLike:
      'Daylight lifestyle still of the same product — recognizable as the same brand world as IMAGE 1.',
  },
  photo_moody_editorial: {
    id: 'photo_moody_editorial',
    label: 'Moody editorial',
    camera: '3/4 or slight low angle; tighter editorial crop than a catalog full-body still',
    lighting: 'Low-key: strong rim OR side light, deep shadows, high contrast — keep IMAGE 1 color accents',
    background: 'Dark styled set that still echoes IMAGE 1 palette/materials',
    mustInclude: [
      'Dramatically moodier exposure than a flat catalog shot',
      'Exact product from IMAGE 1',
      'Magazine / beauty-editorial atmosphere',
    ],
    mustNot: [
      'Wrong product or redesigned label',
      'Plain white packshot void',
      'Only a vignette filter on the upload with no real relight',
    ],
    successLooksLike:
      'Editorial reshoot of the same product that still feels like the same brand campaign as IMAGE 1.',
  },
  photo_hand_model: {
    id: 'photo_hand_model',
    label: 'In hand',
    camera: 'Medium close-up; product held toward camera; fingers clearly visible',
    lighting: 'Soft natural or soft studio on hand + product',
    background: 'Soft lifestyle or simple studio — out of focus behind the hand',
    mustInclude: [
      'At least one real human hand holding the product',
      'Visible fingers / skin',
      'Product label / face readable while held',
    ],
    mustNot: [
      'Product sitting alone with no hand',
      'Cropped shelf still with no person',
      'Floating product with no grip',
    ],
    successLooksLike: 'Hand model holding the exact product — unmistakable handheld shot.',
  },
  photo_flatlay: {
    id: 'photo_flatlay',
    label: 'Flatlay',
    camera: 'Straight-down 90° overhead; no perspective foreshortening',
    lighting: 'Even soft overhead light, minimal harsh shadow',
    background: 'Styled flat surface (linen, marble, wood, paper) filling the frame',
    mustInclude: [
      'True top-down camera',
      '2–4 complementary props around the product',
      'Balanced flatlay composition',
    ],
    mustNot: [
      'Eye-level shelf / room shot',
      'Hand holding (unless tiny prop hand)',
      'Same angle as IMAGE 1 if IMAGE 1 was not overhead',
    ],
    successLooksLike: 'Instagram flatlay from above — clearly overhead, not a standing product shot.',
  },
  photo_promo_offer: {
    id: 'photo_promo_offer',
    label: 'Promo offer',
    camera: 'Product weighted to one side (left or right third); open negative space opposite',
    lighting: 'Clean commercial light; product pops against soft backdrop',
    background: 'Simple studio or soft gradient with large empty area for offer text',
    mustInclude: [
      'Product on one side',
      'Large clean empty region (~30%+) for “20% off” / Shop space',
      'Ad-ready composition',
    ],
    mustNot: [
      'Centered packshot with no negative space',
      'Burned-in fake text, prices, or UI chrome',
      'Clutter covering the empty side',
    ],
    successLooksLike: 'Meta ad frame: product + blank offer zone — not a centered catalog crop.',
  },
  ad_creative: {
    id: 'ad_creative',
    label: 'Ad creative',
    camera: 'Bold social crop, product hero, strong read at small size',
    lighting: 'High-impact commercial light, crisp contrast',
    background: 'Simple, high-contrast set that reads on mobile',
    mustInclude: [
      'Scroll-stop composition',
      'Product dominant and sharp',
      'Clean square-friendly framing',
    ],
    mustNot: ['Busy unreadable background', 'Fake app UI overlays', 'Near-copy of IMAGE 1'],
    successLooksLike: 'Paid social still — punchy and different from the upload.',
  },
  product_image: {
    id: 'product_image',
    label: 'Studio packshot',
    camera: 'Centered hero packshot',
    lighting: 'Soft studio softbox',
    background: 'Seamless light backdrop',
    mustInclude: ['Seamless studio', 'Sharp product'],
    mustNot: ['Source room unchanged', 'People'],
    successLooksLike: 'Clean studio packshot reshoot.',
  },
  lifestyle_image: {
    id: 'lifestyle_image',
    label: 'Window light',
    camera: 'Lifestyle angle near daylight',
    lighting: 'Soft window daylight',
    background: 'Bright airy interior with window cues',
    mustInclude: ['Daylight lifestyle feel', 'Product readable'],
    mustNot: ['Dark editorial set', 'Source photo passthrough'],
    successLooksLike: 'Daylight lifestyle still of the product.',
  },
  promo_creative: {
    id: 'promo_creative',
    label: 'Promo offer',
    camera: 'Product off-center with negative space',
    lighting: 'Clean commercial',
    background: 'Soft simple set with empty offer zone',
    mustInclude: ['Negative space for offer', 'Product hero'],
    mustNot: ['Fake burned-in text', 'Centered only'],
    successLooksLike: 'Promo frame with blank offer space.',
  },
  photo_lifestyle_home: {
    id: 'photo_lifestyle_home',
    label: 'Window light',
    camera: 'Home lifestyle angle',
    lighting: 'Soft natural daylight',
    background: 'Lived-in home interior with daylight',
    mustInclude: ['Home/lifestyle environment', 'Daylight'],
    mustNot: ['Seamless studio only', 'Source passthrough'],
    successLooksLike: 'Product in a home daylight setting.',
  },
  photo_shelf_context: {
    id: 'photo_shelf_context',
    label: 'Moody editorial',
    camera: 'Editorial 3/4, dramatic crop',
    lighting: 'Low-key rim/side light',
    background: 'Dark editorial set',
    mustInclude: ['Dark dramatic lighting', 'New angle vs upload'],
    mustNot: ['Bright packshot', 'Upload copy'],
    successLooksLike: 'Dark editorial reshoot.',
  },
  photo_detail_macro: {
    id: 'photo_detail_macro',
    label: 'Detail macro',
    camera: 'Tight macro / close-up on label, texture, or key detail',
    lighting: 'Soft focused light on the detail; creamy bokeh behind',
    background: 'Mostly blurred — detail is the subject',
    mustInclude: [
      'Much tighter crop than a full product shot',
      'Readable detail of the real product surface/label',
      'Shallow depth of field',
    ],
    mustNot: ['Full product with lots of empty room', 'Same framing as IMAGE 1 full shot'],
    successLooksLike: 'Macro detail of the product — obviously closer than the upload.',
  },
  photo_social_feed: {
    id: 'photo_social_feed',
    label: 'Flatlay',
    camera: 'Overhead 90° flatlay',
    lighting: 'Even soft overhead',
    background: 'Styled surface + props',
    mustInclude: ['Top-down angle', 'Styled props'],
    mustNot: ['Eye-level room shot'],
    successLooksLike: 'Social flatlay from above.',
  },
}

const LIGHTING_MAP: Record<string, string> = {
  soft_natural: 'Bias lighting toward soft natural daylight (without breaking format must-haves)',
  studio_softbox: 'Bias lighting toward controlled softbox (without breaking format must-haves)',
  dramatic: 'Increase contrast / deeper shadows (without breaking format must-haves)',
  golden_hour: 'Add warm golden-hour color cast (without breaking format must-haves)',
  bright_daylight: 'Push brighter high-key daylight (without breaking format must-haves)',
}

const BACKGROUND_MAP: Record<string, string> = {
  seamless_studio: 'Prefer seamless studio surfaces where the format allows',
  lifestyle_interior: 'Prefer lifestyle interior cues where the format allows',
  outdoor: 'Prefer subtle outdoor cues where the format allows',
  surface_marble: 'Prefer marble/stone surface styling where the format allows',
  soft_gradient: 'Prefer soft gradient backdrop where the format allows',
}

const MOOD_MAP: Record<string, string> = {
  premium_clean: 'Overall mood: polished, premium, clean',
  warm_cozy: 'Overall mood: warm, inviting, cozy',
  bold_energetic: 'Overall mood: bold, high-energy, punchy',
  minimal: 'Overall mood: minimal, sparse, quiet',
  editorial_beauty: 'Overall mood: magazine editorial beauty',
}

const THEME_MAP: Record<string, string> = {
  modern_dtc: 'Aesthetic: modern DTC / Shopify social',
  luxury_beauty: 'Aesthetic: luxury beauty / fragrance elegance',
  clean_clinical: 'Aesthetic: clean clinical / precise',
  playful: 'Aesthetic: playful bright color',
  earthy: 'Aesthetic: earthy organic textures',
}

function bullets(items: string[]): string {
  return items.map((i) => `- ${i}`).join('\n')
}

function optionalDirection(
  dir?: CreativeDirectionSummary,
  recreateNote?: string,
  hasReferenceImage = false,
): string {
  const parts: string[] = []
  if (dir?.lighting && LIGHTING_MAP[dir.lighting]) parts.push(LIGHTING_MAP[dir.lighting]!)
  if (dir?.background && BACKGROUND_MAP[dir.background]) {
    parts.push(BACKGROUND_MAP[dir.background]!)
  }
  if (dir?.mood && MOOD_MAP[dir.mood]) parts.push(MOOD_MAP[dir.mood]!)
  if (dir?.styleTheme && THEME_MAP[dir.styleTheme]) parts.push(THEME_MAP[dir.styleTheme]!)
  if (dir?.prompt?.trim()) parts.push(`User note: ${dir.prompt.trim()}`)
  if (recreateNote?.trim()) parts.push(`Recreate note: ${recreateNote.trim()}`)
  if (!parts.length) {
    return hasReferenceImage
      ? 'No extra text direction — IMAGE 2 is the style/mood authority.'
      : 'No extra creative direction — follow the format contract exactly.'
  }
  if (hasReferenceImage) {
    return `${parts.join('\n')}
PRIORITY: IMAGE 1 product + selected format (shoot structure + ratio) + IMAGE 2 reference look — all three. Text only refines the mix.`
  }
  return `${parts.join('\n')}
PRIORITY: Product + format. Creative direction refines color/mood within those rules.`
}

function formatContractBody(
  kind: ImageAssetKind,
  intensify: boolean,
  hasReferenceImage = false,
): string {
  const c = FORMAT_CONTRACTS[kind]
  const boost = intensify
    ? `\nRETRY — previous frame failed (looked like the source photo or ignored the reference).\nRebuild for ${c.label}. Keep IMAGE 1 product exact. ${hasReferenceImage ? 'Match IMAGE 2 look more strongly.' : 'Change lighting + background + camera.'}`
    : ''

  // Reference + format: follow BOTH — format structure + reference look
  if (hasReferenceImage) {
    return `FORMAT ID: ${c.id} (${c.label})
USER MIX: follow reference AND format accordingly.

FORMAT MUST FOLLOW:
- Camera / composition: ${c.camera}
- Aspect / orientation for ${c.label}
- What makes this format recognizable: ${c.successLooksLike}
- Product fully visible and readable

REFERENCE MUST FOLLOW (paint the format with this look):
- Lighting quality, backdrop color, mood, props, pour/drip, palette from IMAGE 2
- Place IMAGE 1’s product into a shot that still feels like IMAGE 2
- Adapt IMAGE 2’s world to satisfy the format (e.g. flatlay = overhead of that world; packshot = hero of that world; window = daylight version of that world)

MUST INCLUDE:
- Exact product from IMAGE 1
- Clearly recognizable ${c.label} structure
- Clearly recognizable IMAGE 2 look

MUST NOT:
- Swap product/brand from IMAGE 2
- Obey format but drop the reference look
- Obey reference but make a wrong format (e.g. eye-level when flatlay is required)
- Wrong aspect ratio

SUCCESS LOOKS LIKE: “A proper ${c.label} of IMAGE 1’s product that still feels like IMAGE 2.”
${boost}`
  }

  // No separate style ref → product photo IS the look reference
  return `FORMAT ID: ${c.id}
LOOK AUTHORITY: IMAGE 1 is packaging ground truth AND the style to match.
Preserve IMAGE 1’s signature look: backdrop color, surface, liquid pour / cream drip / props / palette.
Camera may adjust for ${c.label}; do NOT invent a plain gray/white void if IMAGE 1 is already styled.

CAMERA: ${c.camera}
LIGHTING: ${c.lighting}
BACKGROUND: ${c.background}

MUST INCLUDE:
${bullets(c.mustInclude)}

MUST NOT:
${bullets(c.mustNot)}

SUCCESS LOOKS LIKE: ${c.successLooksLike}
${boost}`
}

function promptForAsset(
  kind: ImageAssetKind,
  productName: string,
  dir?: CreativeDirectionSummary,
  recreateNote?: string,
  intensify = false,
  hasReferenceImage = false,
): string {
  const c = FORMAT_CONTRACTS[kind]
  const directionLines = optionalDirection(dir, recreateNote, hasReferenceImage)
  const userBits = [
    dir?.prompt?.trim(),
    directionLines.includes('No extra') ? undefined : directionLines,
  ].filter(Boolean)

  const lead = hasReferenceImage
    ? `User chose reference + format. Follow both: keep image 1’s product exact; apply image 2’s look; execute a real ${c.label} (camera, composition, ratio) — blend, don’t pick only one.`
    : `Edit image 1 into a ${c.label} still: keep packaging exact AND keep image 1’s styled look — do not replace with plain gray.`

  const spec = buildLuceSpec({
    modality: 'image',
    assetType: kind,
    assetLabel: c.label,
    productName,
    formatContractBody: formatContractBody(kind, intensify, hasReferenceImage),
    creativeDirection: {
      prompt: [lead, userBits.length ? userBits.join('\n') : undefined]
        .filter(Boolean)
        .join('\n'),
      lighting: dir?.lighting,
      background: dir?.background,
      mood: dir?.mood,
      styleTheme: dir?.styleTheme,
    },
    recreateNote,
    hasProductImage: true,
    hasReferenceImage,
  })

  return renderImagePrompt(spec)
}

function isImageAssetKind(value: string): value is ImageAssetKind {
  return (IMAGE_ASSET_KINDS as string[]).includes(value)
}

const CONCURRENCY = 2

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0

  async function worker() {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i]!, i)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}

export async function generateCampaignImages(
  input: GenerateImagesInput,
): Promise<GenerateImagesResult> {
  const providerStatus = getAiProviderStatus()
  console.info('[generate-images]', providerStatus.summary)

  if (!getOpenRouterApiKey() && !getMuseApiKey()) {
    return {
      status: 503,
      body: {
        error:
          'Image AI not configured. Set OPENROUTER_API_KEY (gemini-2.5-flash-image) or MUSE_API_KEY, then restart.',
      },
    }
  }

  const productName = String(input.productName ?? '').trim()
  if (!productName) {
    return { status: 400, body: { error: 'productName is required' } }
  }

  const rawAssets = Array.isArray(input.assets) ? input.assets : []
  const assets = [...new Set(rawAssets.map(String).filter(isImageAssetKind))]
  if (assets.length === 0) {
    return {
      status: 400,
      body: {
        error: 'assets must include at least one photo format or ad_creative',
      },
    }
  }

  const productImage = input.productImage?.trim() || undefined
  if (!productImage) {
    return {
      status: 400,
      body: {
        error:
          'productImage is required. Upload your product photo so formats keep packaging true.',
      },
    }
  }
  const referenceImage = input.referenceImage?.trim() || undefined
  // Order: IMAGE 1 = product (lock), IMAGE 2 = style reference (optional)
  const inputReferences = await Promise.all(
    [productImage, referenceImage]
      .filter((v): v is string => Boolean(v))
      .map((url) => prepareReferenceImage(url)),
  )
  const hasStyleRef = Boolean(referenceImage)
  console.info(
    `[generate-images] refs=${inputReferences.length}` +
      (hasStyleRef ? ' (product + style reference)' : ' (product only — no style reference)'),
  )
  if (!hasStyleRef) {
    console.info(
      '[generate-images] tip: without a style reference, formats use built-in scene contracts (e.g. packshot = seamless studio).',
    )
  }

  type Settled =
    | { ok: true; asset: GeneratedAsset }
    | { ok: false; type: ImageAssetKind; error: string }

  /** Rough check: model sometimes returns the source photo unchanged. */
  function looksLikeSourcePhoto(generated: string, source: string): boolean {
    const a = generated.replace(/\s/g, '')
    const b = source.replace(/\s/g, '')
    if (!a || !b) return false
    if (a === b) return true
    // Same data-URL payload (ignore mime differences)
    const payA = a.includes(',') ? a.slice(a.indexOf(',') + 1) : a
    const payB = b.includes(',') ? b.slice(b.indexOf(',') + 1) : b
    if (payA.length > 200 && payA === payB) return true
    // Near-identical length + shared prefix often means passthrough
    if (
      payA.length > 2000 &&
      payB.length > 2000 &&
      Math.abs(payA.length - payB.length) < 32 &&
      payA.slice(0, 120) === payB.slice(0, 120)
    ) {
      return true
    }
    return false
  }

  const hasRef = hasStyleRef

  const settled = await mapWithConcurrency(assets, CONCURRENCY, async (type) => {
    let promptUsed = promptForAsset(
      type,
      productName,
      input.creativeDirection,
      input.recreateNote,
      false,
      hasRef,
    )
    try {
      const aspectRatio = formatForImageAsset(type).aspectRatio
      let result = await generateImageWithProviders({
        prompt: promptUsed,
        inputReferences: inputReferences.length ? inputReferences : undefined,
        aspectRatio,
      })

      if (looksLikeSourcePhoto(result.imageDataUrl, productImage)) {
        console.warn(
          `[generate-images] ${type}: output matched source — retrying with stronger restyle`,
        )
        promptUsed = promptForAsset(
          type,
          productName,
          input.creativeDirection,
          input.recreateNote,
          true,
          hasRef,
        )
        result = await generateImageWithProviders({
          prompt: promptUsed,
          inputReferences: inputReferences.length ? inputReferences : undefined,
          aspectRatio,
        })
        if (looksLikeSourcePhoto(result.imageDataUrl, productImage)) {
          throw new Error(
            'Image model returned the source photo unchanged — try again or pick another format.',
          )
        }
      }

      return {
        ok: true as const,
        asset: {
          type,
          label: LABELS[type],
          imageDataUrl: result.imageDataUrl,
          promptUsed,
        },
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image generation failed'
      console.error(`[generate-images] ${type} failed`, message)
      return { ok: false as const, type, error: message }
    }
  })

  const generated: GeneratedAsset[] = []
  const partialErrors: { type: ImageAssetKind; error: string }[] = []

  for (const item of settled as Settled[]) {
    if (item.ok) generated.push(item.asset)
    else partialErrors.push({ type: item.type, error: item.error })
  }

  if (generated.length === 0) {
    return {
      status: 502,
      body: {
        error:
          partialErrors[0]?.error ||
          'All image generations failed. Check Muse / OpenRouter keys and models.',
      },
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      assets: generated,
      ...(partialErrors.length ? { partialErrors } : {}),
    },
  }
}
