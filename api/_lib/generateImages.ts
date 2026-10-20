import { generateMuseImage, getMuseApiKey } from './muse'
import { generateImage, getOpenRouterApiKey } from './openRouter'

async function generateImageWithProviders(input: {
  prompt: string
  inputReferences?: string[]
}): Promise<{ imageDataUrl: string; provider: string }> {
  const refs = input.inputReferences
  // Prefer Meta Muse ($0.01/image) when configured
  if (getMuseApiKey()) {
    try {
      const result = await generateMuseImage({
        prompt: input.prompt,
        inputImages: refs,
      })
      return { imageDataUrl: result.imageDataUrl, provider: 'muse' }
    } catch (err) {
      console.warn(
        '[generate-images] Muse failed, trying OpenRouter',
        err instanceof Error ? err.message : err,
      )
      if (!getOpenRouterApiKey()) throw err
    }
  }

  if (!getOpenRouterApiKey()) {
    throw new Error(
      'No image provider configured. Set MUSE_API_KEY (or MODEL_API_KEY) and/or OPENROUTER_API_KEY.',
    )
  }

  const result = await generateImage({
    prompt: input.prompt,
    inputReferences: refs,
  })
  return { imageDataUrl: result.imageDataUrl, provider: 'openrouter' }
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
  photo_detail_macro: 'Studio packshot',
  photo_social_feed: 'Flatlay',
}

const FIDELITY_RULES = `
CRITICAL PRODUCT FIDELITY (LUCE brand promise):
- The FIRST attached image is the product packaging ground truth. Keep packaging EXACTLY true: same label artwork, logo, typography, colors, bottle/jar shape, materials, and proportions.
- If a SECOND image is attached, it is a STYLE / MOOD / SCENE reference only. Copy lighting, composition, atmosphere, and props vibe from it — NEVER replace or blend the product packaging from that second image.
- Do NOT invent, redraw, blur, or restyle the brand mark or label text.
- Only change scene, lighting, camera angle, composition, and supporting props — never the product identity itself.
- Photorealistic commercial photography. No text overlays unless the style explicitly needs promo space (leave clean negative space).
`.trim()

function humanize(id: string | undefined): string {
  if (!id) return ''
  return id.replaceAll('_', ' ')
}

function directionBlock(dir?: CreativeDirectionSummary, recreateNote?: string): string {
  const parts: string[] = []
  if (dir?.lighting) parts.push(`Lighting: ${humanize(dir.lighting)}`)
  if (dir?.background) parts.push(`Background: ${humanize(dir.background)}`)
  if (dir?.mood) parts.push(`Mood: ${humanize(dir.mood)}`)
  if (dir?.styleTheme) parts.push(`Style theme: ${humanize(dir.styleTheme)}`)
  if (dir?.prompt?.trim()) parts.push(`Creative direction: ${dir.prompt.trim()}`)
  if (recreateNote?.trim()) parts.push(`Recreate notes: ${recreateNote.trim()}`)
  return parts.length ? parts.join('\n') : 'Use clean, premium DTC product photography defaults.'
}

function sceneFor(kind: ImageAssetKind, name: string): string {
  const scenes: Record<ImageAssetKind, string> = {
    photo_studio_packshot: `Professional studio packshot of "${name}". Clean seamless backdrop, soft controlled lighting, hero product centered, sharp focus on packaging.`,
    photo_window_daylight: `"${name}" lit by soft window daylight. Gentle shadows, airy atmosphere, packaging exact.`,
    photo_moody_editorial: `Dark, moody editorial still of "${name}". Dramatic low-key lighting, premium brand feel, packaging still fully readable.`,
    photo_hand_model: `Natural hand holding "${name}" clearly in frame. Fingers relaxed, product label facing camera, photorealistic skin and exact packaging. The product must be visibly held in a human hand — not floating alone.`,
    photo_flatlay: `Overhead flatlay of "${name}" on a styled surface with minimal complementary props. Balanced composition, packaging fully legible.`,
    photo_promo_offer: `Campaign promo still of "${name}" with intentional negative space for an offer. Product hero, true packaging, not cluttered.`,
    ad_creative: `Paid social / Meta-ready ad creative still of "${name}". Strong scroll-stop composition, true packaging, clean square framing. No fake UI chrome.`,
    product_image: `Professional studio packshot of "${name}". Clean seamless backdrop, soft controlled lighting, hero product centered.`,
    lifestyle_image: `"${name}" lit by soft window daylight in a natural setting. Packaging fully legible.`,
    promo_creative: `Campaign promotional still of "${name}" with premium composition and space for an offer.`,
    photo_lifestyle_home: `"${name}" lit by soft window daylight in a natural setting. Packaging fully legible.`,
    photo_shelf_context: `Dark, moody editorial still of "${name}". Dramatic lighting, packaging readable.`,
    photo_detail_macro: `Professional studio packshot of "${name}". Clean backdrop, sharp packaging.`,
    photo_social_feed: `Overhead flatlay of "${name}" on a styled surface. Packaging fully legible.`,
  }
  return scenes[kind]
}

function promptForAsset(
  kind: ImageAssetKind,
  productName: string,
  dir?: CreativeDirectionSummary,
  recreateNote?: string,
): string {
  const name = productName.trim() || 'the product'
  const direction = directionBlock(dir, recreateNote)

  return `${sceneFor(kind, name)}

${FIDELITY_RULES}

Creative brief:
${direction}

Use the attached reference image as the exact product. Reproduce packaging faithfully.`
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
  if (!getMuseApiKey() && !getOpenRouterApiKey()) {
    return {
      status: 503,
      body: {
        error:
          'Image AI is not configured. Set MUSE_API_KEY (Meta Muse) and/or OPENROUTER_API_KEY.',
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
  const referenceImage = input.referenceImage?.trim() || undefined
  const inputReferences = [productImage, referenceImage].filter(
    (v): v is string => Boolean(v),
  )

  type Settled =
    | { ok: true; asset: GeneratedAsset }
    | { ok: false; type: ImageAssetKind; error: string }

  const settled = await mapWithConcurrency(assets, CONCURRENCY, async (type) => {
    const promptUsed = promptForAsset(
      type,
      productName,
      input.creativeDirection,
      input.recreateNote,
    )
    try {
      const result = await generateImageWithProviders({
        prompt: promptUsed,
        inputReferences: inputReferences.length ? inputReferences : undefined,
      })
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
