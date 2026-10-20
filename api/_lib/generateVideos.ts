import { generateVideo, getOpenRouterApiKey } from './openRouter'

export type VideoAssetKind =
  | 'video_table_talk'
  | 'video_cinematic'
  | 'video_howto_demo'
  | 'video_unboxing'
  | 'video_ugc_selfie'
  | 'video_testimonial'
  | 'video_grwm'
  | 'video_asmr_spray'
  | 'video_product_spin'
  | 'video_hook_caption'
  | 'video_mirror_selfie'
  | 'video_flatlay_reveal'
  | 'video_winner_cut'

export const VIDEO_ASSET_KINDS: VideoAssetKind[] = [
  'video_table_talk',
  'video_cinematic',
  'video_howto_demo',
  'video_unboxing',
  'video_ugc_selfie',
  'video_testimonial',
  'video_grwm',
  'video_asmr_spray',
  'video_product_spin',
  'video_hook_caption',
  'video_mirror_selfie',
  'video_flatlay_reveal',
  'video_winner_cut',
]

export function isVideoAssetKind(value: string): value is VideoAssetKind {
  return (VIDEO_ASSET_KINDS as string[]).includes(value)
}

export type CreativeDirectionSummary = {
  prompt?: string
  lighting?: string
  background?: string
  mood?: string
  styleTheme?: string
}

export type GenerateVideosInput = {
  productName: string
  /** Product still — used as first-frame / packaging guide when possible */
  productImage?: string
  /** Optional still extracted from the user's reference video */
  referenceFrameImage?: string
  creativeDirection?: CreativeDirectionSummary
  assets: VideoAssetKind[]
  recreateNote?: string
}

export type GeneratedVideoAsset = {
  type: VideoAssetKind
  label: string
  videoDataUrl: string
  promptUsed?: string
}

export type GenerateVideosResult =
  | {
      status: 200
      body: {
        ok: true
        assets: GeneratedVideoAsset[]
        partialErrors?: { type: VideoAssetKind; error: string }[]
      }
    }
  | { status: number; body: { ok?: false; error: string } }

const LABELS: Record<VideoAssetKind, string> = {
  video_table_talk: 'Table talk',
  video_cinematic: 'Cinematic',
  video_howto_demo: 'How to use',
  video_unboxing: 'Unboxing',
  video_ugc_selfie: 'UGC selfie',
  video_testimonial: 'Testimonial',
  video_grwm: 'GRWM',
  video_asmr_spray: 'Spray ASMR',
  video_product_spin: 'Product spin',
  video_hook_caption: 'Hook caption',
  video_mirror_selfie: 'Mirror selfie',
  video_flatlay_reveal: 'Flatlay reveal',
  video_winner_cut: 'Winner cut',
}

const FORMAT_BEATS: Record<VideoAssetKind, string> = {
  video_table_talk:
    'Creator at a clean table talking to camera while presenting the product, natural speech energy, medium shot.',
  video_cinematic:
    'Premium cinematic product hero spot: slow camera move, soft mist or light bloom around the bottle, luxury commercial.',
  video_howto_demo:
    'How-to demo: person sprays or applies the product correctly (wrist / skin), clear instructional motion.',
  video_unboxing:
    'Unboxing: hands open packaging and reveal the product on a table, slow premium reveal.',
  video_ugc_selfie:
    'UGC selfie / creator phone video holding the product near the face, candid social energy.',
  video_testimonial:
    'Testimonial: person facing camera holding the product, sincere review vibe.',
  video_grwm:
    'Get-ready-with-me vanity routine finishing with the product as the scent step.',
  video_asmr_spray:
    'ASMR close-up of the nozzle being pressed with visible mist, shallow depth of field.',
  video_product_spin:
    'Hero product turn / slow orbit of the bottle on a clean surface.',
  video_hook_caption:
    'Talking-head hook style with space for a bold caption, energetic social ad.',
  video_mirror_selfie:
    'Bathroom mirror selfie holding the product, bright vanity light.',
  video_flatlay_reveal:
    'Overhead flatlay reveal of the product on a styled surface.',
  video_winner_cut:
    'Winning-ad style variation of a smiling creator presenting the product.',
}

function humanize(id: string | undefined): string {
  if (!id) return ''
  return id.replaceAll('_', ' ')
}

function buildPrompt(
  type: VideoAssetKind,
  productName: string,
  cd: CreativeDirectionSummary | undefined,
  recreateNote?: string,
): string {
  const userPrompt = cd?.prompt?.trim()
  const bits = [
    `Vertical 9:16 product marketing video for "${productName}".`,
    'Keep packaging fidelity: same bottle/jar shape, label, colors, and brand marks whenever the product is visible.',
    FORMAT_BEATS[type],
    'Photorealistic, premium commercial quality, natural motion, no watermarks, no UI chrome.',
  ]
  if (userPrompt) {
    bits.push(
      `USER PROMPT (apply after matching any reference look): ${userPrompt}`,
    )
  }
  if (cd?.lighting) bits.push(`Lighting: ${humanize(cd.lighting)}.`)
  if (cd?.background) bits.push(`Background: ${humanize(cd.background)}.`)
  if (cd?.mood) bits.push(`Mood: ${humanize(cd.mood)}.`)
  if (cd?.styleTheme) bits.push(`Style theme: ${humanize(cd.styleTheme)}.`)
  if (recreateNote?.trim()) {
    bits.push(`Recreate note: ${recreateNote.trim()}`)
  }
  bits.push(
    'Priority: match the reference still / product photo first for packaging and vibe, then follow the user prompt.',
  )
  return bits.join(' ')
}

export async function generateCampaignVideos(
  input: GenerateVideosInput,
): Promise<GenerateVideosResult> {
  if (!getOpenRouterApiKey()) {
    return {
      status: 503,
      body: {
        error:
          'OpenRouter is not configured. Set OPENROUTER_API_KEY (and optionally OPENROUTER_VIDEO_MODEL).',
      },
    }
  }

  const productName = String(input.productName ?? '').trim()
  if (!productName) {
    return { status: 400, body: { error: 'productName is required' } }
  }

  const assets = [
    ...new Set(
      (Array.isArray(input.assets) ? input.assets : [])
        .map(String)
        .filter(isVideoAssetKind),
    ),
  ]
  if (assets.length === 0) {
    return {
      status: 400,
      body: { error: 'assets must include at least one video format' },
    }
  }

  const productImage = input.productImage?.trim() || undefined
  const referenceFrame = input.referenceFrameImage?.trim() || undefined

  const generated: GeneratedVideoAsset[] = []
  const partialErrors: { type: VideoAssetKind; error: string }[] = []

  // Sequential — video jobs are slow and rate-limited
  for (const type of assets) {
    const promptUsed = buildPrompt(
      type,
      productName,
      input.creativeDirection,
      input.recreateNote,
    )
    try {
      // Prefer the user's reference video frame; keep product photo as packaging guide.
      const frameImages: { url: string; frameType: 'first_frame' }[] = []
      if (referenceFrame) {
        frameImages.push({ url: referenceFrame, frameType: 'first_frame' })
      } else if (productImage) {
        frameImages.push({ url: productImage, frameType: 'first_frame' })
      }

      const inputReferences =
        productImage && referenceFrame && productImage !== referenceFrame
          ? [productImage]
          : undefined

      const result = await generateVideo({
        prompt: promptUsed,
        frameImages: frameImages.length ? frameImages : undefined,
        inputReferences,
        duration: 5,
        aspectRatio: '9:16',
        resolution: '768p',
        generateAudio: true,
      })

      generated.push({
        type,
        label: LABELS[type],
        videoDataUrl: result.videoDataUrl,
        promptUsed,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Video generation failed'
      console.error(`[generate-videos] ${type} failed`, message)
      partialErrors.push({ type, error: message })
    }
  }

  if (generated.length === 0) {
    return {
      status: 502,
      body: {
        error:
          partialErrors[0]?.error ||
          'All video generations failed. Check OpenRouter video model and key.',
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
