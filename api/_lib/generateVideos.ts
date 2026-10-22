import { generateImageWithProviders } from './generateImages'
import { generateHeyGenVideo, getHeyGenApiKey } from './heygen'
import {
  buildLuceSpec,
  renderVideoKeyframePrompt,
  renderVideoMotionPrompt,
} from './luceGeneration'
import { generateVideo, getOpenRouterApiKey } from './openRouter'
import { prepareFrameImage } from './prepareImage'
import { getAiProviderStatus } from './providers'

async function generateVideoWithProviders(input: {
  prompt: string
  frameImages?: { url: string; frameType: 'first_frame' }[]
  inputReferences?: string[]
  duration?: number
  aspectRatio?: '9:16'
  resolution?: '768p'
  generateAudio?: boolean
}): Promise<{ videoUrl: string; videoDataUrl: string; provider: string }> {
  const firstFrame = input.frameImages?.[0]?.url
  const refs = input.inputReferences
  const errors: string[] = []

  // 1) Direct HeyGen when HEYGEN_API_KEY is set
  if (getHeyGenApiKey()) {
    try {
      console.info('[generate-videos] trying HeyGen direct')
      const result = await generateHeyGenVideo({
        prompt: input.prompt,
        imageUrl: firstFrame,
        referenceImages: refs,
        duration: input.duration ?? 5,
        aspectRatio: input.aspectRatio ?? '9:16',
        resolution: input.resolution ?? '768p',
      })
      console.info('[generate-videos] ok via heygen')
      return {
        videoUrl: result.videoDataUrl,
        videoDataUrl: result.videoDataUrl,
        provider: 'heygen',
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`HeyGen: ${msg}`)
      console.warn('[generate-videos] HeyGen failed, trying OpenRouter', msg)
    }
  }

  // 2) OpenRouter heygen/heygen-video-1 (active path when HEYGEN_API_KEY is empty)
  if (getOpenRouterApiKey()) {
    try {
      console.info('[generate-videos] trying OpenRouter heygen-video-1')
      const result = await generateVideo({
        prompt: input.prompt,
        frameImages: input.frameImages,
        inputReferences: refs,
        duration: input.duration,
        aspectRatio: input.aspectRatio,
        resolution: input.resolution,
        generateAudio: input.generateAudio,
      })
      console.info('[generate-videos] ok via openrouter')
      return {
        videoUrl: result.videoUrl,
        videoDataUrl: result.videoDataUrl,
        provider: 'openrouter',
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`OpenRouter: ${msg}`)
      throw new Error(errors.join(' | ') || msg)
    }
  }

  throw new Error(
    errors.length
      ? errors.join(' | ')
      : 'No video provider configured. Set HEYGEN_API_KEY and/or OPENROUTER_API_KEY.',
  )
}

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

/**
 * Formats that need a PERSON on camera (talk / demo / hold product).
 * Always compose a person+product keyframe first — never animate the bottle alone.
 */
const PERSON_LED_FORMATS = new Set<VideoAssetKind>([
  'video_ugc_selfie',
  'video_table_talk',
  'video_testimonial',
  'video_howto_demo',
  'video_grwm',
  'video_hook_caption',
  'video_mirror_selfie',
  'video_winner_cut',
  'video_unboxing',
])

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
  /** Clip length in seconds — user pick (any integer 5–15) */
  durationSeconds?: number
}

/** heygen-video-1 accepts any integer duration from 5 through 15 seconds. */
const MIN_DURATION = 5
const MAX_DURATION = 15

function clampDurationSeconds(raw: unknown, fallback = 5): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) {
    return Math.max(MIN_DURATION, Math.min(MAX_DURATION, fallback))
  }
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, n))
}

export type GeneratedVideoAsset = {
  type: VideoAssetKind
  label: string
  /** Playable HTTPS or data URL */
  videoUrl: string
  /** Alias kept for older clients */
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

/**
 * Format-specific KEYFRAME still — built from the user's product photo first,
 * then animated. This is what makes "How to use" look like a how-to of THEIR product.
 */
const KEYFRAME_SCENES: Record<VideoAssetKind, string> = {
  video_ugc_selfie:
    'Vertical 9:16 candid smartphone selfie of a real young adult creator holding the exact product near their face, mouth slightly open mid-sentence as if talking to camera about the product, casual indoor background, natural phone light, true UGC energy.',
  video_table_talk:
    'Vertical 9:16 medium shot of a creator seated at a clean table facing camera, holding the exact product toward the lens, mid-conversation expression, natural daylight.',
  video_testimonial:
    'Vertical 9:16 sincere review: person facing camera holding the exact product at chest height, friendly talking expression.',
  video_howto_demo:
    'Vertical 9:16 instructional how-to-use frame: a real person clearly demonstrates using the exact product — e.g. lifting the bottle to spray on wrist/neck or applying it the correct way — tutorial pose, product packaging fully readable, clean bright background, looks like a step-by-step demo still.',
  video_grwm:
    'Vertical 9:16 vanity get-ready-with-me: person in frame with the exact product as the scent/finishing step, talking to camera in mirror light.',
  video_hook_caption:
    'Vertical 9:16 energetic talking-head social ad: person holding the exact product, strong eye contact, mouth mid-hook line.',
  video_mirror_selfie:
    'Vertical 9:16 bathroom mirror selfie: person holding the exact product, bright vanity light, casual talk-to-camera vibe.',
  video_winner_cut:
    'Vertical 9:16 winning ad still: smiling creator presenting the exact product to camera, mid-speech.',
  video_unboxing:
    'Vertical 9:16 unboxing reveal: hands/person at a table opening a box with the exact product clearly visible as the hero reveal, packaging exact.',
  video_cinematic:
    'Vertical 9:16 luxury cinematic hero still of the exact product centered on a premium surface, soft volumetric light / mist atmosphere, high-end commercial photography — product only, no person needed.',
  video_product_spin:
    'Vertical 9:16 clean hero packshot of the exact product centered on a seamless surface, studio lighting, ready for a slow turntable orbit — product only.',
  video_asmr_spray:
    'Vertical 9:16 extreme close-up of the exact product nozzle / top ready to press, shallow depth of field, ASMR beauty detail — packaging identity still readable.',
  video_flatlay_reveal:
    'Vertical 9:16 overhead flatlay of the exact product on a styled surface with minimal complementary props, balanced composition, packaging fully legible.',
}

/** What the VIDEO motion must do after the keyframe (format = behavior). */
const FORMAT_BEATS: Record<VideoAssetKind, string> = {
  video_table_talk:
    'FORMAT = TABLE TALK: The person talks to camera about this product — natural speech, small gestures, product stays in frame and packaging readable the whole time.',
  video_cinematic:
    'FORMAT = CINEMATIC: Slow camera push / drift around the product, soft mist or light bloom, luxury commercial hero motion. Keep packaging exact.',
  video_howto_demo:
    'FORMAT = HOW TO USE: Clear instructional demo of THIS product. Show the correct use motion (spray on wrist/neck, dab, apply, or open-and-use as fits the product type). Person may briefly narrate steps. Packaging stays exact and readable. Must feel like a tutorial of the user\'s product — not a random bottle.',
  video_unboxing:
    'FORMAT = UNBOXING: Hands open packaging and reveal THIS exact product; slow premium reveal motion; packaging stays exact.',
  video_ugc_selfie:
    'FORMAT = UGC SELFIE: Handheld creator selfie — person speaks casually to camera about why they love THIS product, natural lip motion, product held near the face, candid phone energy, with spoken audio.',
  video_testimonial:
    'FORMAT = TESTIMONIAL: Person faces camera, holds THIS product, speaks a short sincere review with natural lip sync.',
  video_grwm:
    'FORMAT = GRWM: Person talks through a vanity routine and uses / shows THIS product as the scent or finishing step.',
  video_asmr_spray:
    'FORMAT = SPRAY ASMR: Close-up of the nozzle press with visible mist / detail motion, satisfying ASMR pacing. Keep THIS product identity exact.',
  video_product_spin:
    'FORMAT = PRODUCT SPIN: Slow orbit / turntable rotation of THIS exact product on a clean surface.',
  video_hook_caption:
    'FORMAT = HOOK: Talking-head hook — person says a bold opening line while holding THIS product, energetic social ad, spoken audio.',
  video_mirror_selfie:
    'FORMAT = MIRROR SELFIE: Bathroom mirror selfie — person talks to their reflection while holding THIS product.',
  video_flatlay_reveal:
    'FORMAT = FLATLAY REVEAL: Overhead flatlay with a gentle reveal / prop settle around THIS exact product.',
  video_winner_cut:
    'FORMAT = WINNER CUT: Smiling creator presents and briefly talks about THIS product like a winning ad.',
}

function humanize(id: string | undefined): string {
  if (!id) return ''
  return id.replaceAll('_', ' ')
}

function buildKeyframePrompt(
  type: VideoAssetKind,
  productName: string,
  cd?: CreativeDirectionSummary,
  hasReferenceFrame = false,
): string {
  const personLed = PERSON_LED_FORMATS.has(type)
  const scene = KEYFRAME_SCENES[type]
  const personNote = personLed
    ? 'A real person must be clearly visible using / holding / presenting that exact product for this format.'
    : 'Product is the hero of the frame; match the format scene while keeping packaging exact.'

  const spec = buildLuceSpec({
    modality: 'video',
    assetType: type,
    assetLabel: LABELS[type],
    productName,
    formatContractBody: `${scene}\n\n${personNote}`,
    creativeDirection: cd
      ? {
          prompt: cd.prompt,
          lighting: cd.lighting ? humanize(cd.lighting) : undefined,
          background: cd.background ? humanize(cd.background) : undefined,
          mood: cd.mood ? humanize(cd.mood) : undefined,
          styleTheme: cd.styleTheme ? humanize(cd.styleTheme) : undefined,
        }
      : undefined,
    hasProductImage: true,
    hasReferenceVideoFrame: hasReferenceFrame,
  })
  return renderVideoKeyframePrompt(spec)
}

function buildMotionPrompt(
  type: VideoAssetKind,
  productName: string,
  cd: CreativeDirectionSummary | undefined,
  recreateNote?: string,
  personLed?: boolean,
  durationSeconds?: number,
): string {
  const motionExtras: string[] = []
  if (personLed) {
    motionExtras.push(
      'Keep the same person and exact product packaging. Add natural format motion (gestures, talking mouth movement, hands using the product).',
    )
  } else {
    motionExtras.push(
      'Animate the first-frame product with format motion. Packaging EXACT — same label, logo, shape, colors.',
    )
  }
  if (type === 'video_howto_demo') {
    motionExtras.push(
      'Show a clear how-to-use motion (apply, spray, open, or demonstrate) — not just a static hold.',
    )
  }
  if (type === 'video_cinematic') {
    motionExtras.push(
      'Slow luxury camera push-in or gentle orbit, soft volumetric light, premium commercial energy.',
    )
  }
  if (type === 'video_product_spin') {
    motionExtras.push('Slow continuous turntable / orbit rotation of the product.')
  }

  const spec = buildLuceSpec({
    modality: 'video',
    assetType: type,
    assetLabel: LABELS[type],
    productName,
    formatContractBody: motionExtras.join(' '),
    structureBeat: FORMAT_BEATS[type],
    durationSeconds,
    creativeDirection: cd
      ? {
          prompt: cd.prompt,
          lighting: cd.lighting ? humanize(cd.lighting) : undefined,
          background: cd.background ? humanize(cd.background) : undefined,
          mood: cd.mood ? humanize(cd.mood) : undefined,
          styleTheme: cd.styleTheme ? humanize(cd.styleTheme) : undefined,
        }
      : undefined,
    recreateNote,
    hasProductImage: true,
  })
  return renderVideoMotionPrompt(spec)
}

/** Compose a format-specific still from the user's product, then video animates it. */
async function composeFormatKeyframe(input: {
  type: VideoAssetKind
  productName: string
  productImage: string
  referenceFrame?: string
  creativeDirection?: CreativeDirectionSummary
}): Promise<string> {
  const refs = [input.productImage]
  if (input.referenceFrame && input.referenceFrame !== input.productImage) {
    refs.push(input.referenceFrame)
  }
  const prompt = buildKeyframePrompt(
    input.type,
    input.productName,
    input.creativeDirection,
    Boolean(input.referenceFrame),
  )
  const still = await generateImageWithProviders({
    prompt,
    inputReferences: refs,
  })
  return still.imageDataUrl
}

export async function generateCampaignVideos(
  input: GenerateVideosInput,
): Promise<GenerateVideosResult> {
  const providerStatus = getAiProviderStatus()
  console.info('[generate-videos]', providerStatus.summary)

  if (!getHeyGenApiKey() && !getOpenRouterApiKey()) {
    return {
      status: 503,
      body: {
        error:
          'Video AI is not configured. Set HEYGEN_API_KEY and/or OPENROUTER_API_KEY.',
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

  const rawProductImage = input.productImage?.trim() || undefined
  if (!rawProductImage) {
    return {
      status: 400,
      body: {
        error:
          'productImage is required. Upload your product photo so videos keep packaging true.',
      },
    }
  }
  const productImage = await prepareFrameImage(rawProductImage)
  const referenceFrameRaw = input.referenceFrameImage?.trim() || undefined
  const referenceFrame = referenceFrameRaw
    ? await prepareFrameImage(referenceFrameRaw)
    : undefined

  const generated: GeneratedVideoAsset[] = []
  const partialErrors: { type: VideoAssetKind; error: string }[] = []

  // Sequential — person formats: keyframe → video; product formats: photo → video
  for (const type of assets) {
    const personLed = PERSON_LED_FORMATS.has(type)
    try {
      let firstFrame = productImage
      // Only person-on-camera formats need a composed keyframe. Product-led
      // formats (cinematic / spin / ASMR / flatlay) animate the product photo
      // directly — faster and fewer failure points for large uploads.
      if (personLed) {
        console.info(
          `[generate-videos] ${type}: composing person+product keyframe`,
        )
        try {
          firstFrame = await composeFormatKeyframe({
            type,
            productName,
            productImage,
            referenceFrame,
            creativeDirection: input.creativeDirection,
          })
          firstFrame = await prepareFrameImage(firstFrame)
        } catch (keyErr) {
          console.warn(
            `[generate-videos] ${type}: keyframe failed, falling back to product still`,
            keyErr instanceof Error ? keyErr.message : keyErr,
          )
          firstFrame = productImage
        }
      } else {
        console.info(
          `[generate-videos] ${type}: using product photo as first frame`,
        )
      }

      const duration = clampDurationSeconds(
        input.durationSeconds,
        personLed || type === 'video_howto_demo' ? 8 : 5,
      )

      const promptUsed = buildMotionPrompt(
        type,
        productName,
        input.creativeDirection,
        input.recreateNote,
        personLed,
        duration,
      )

      // Format → explicit model params (LUCE §4 / §13 — never let the model guess)
      const result = await generateVideoWithProviders({
        prompt: promptUsed,
        frameImages: [{ url: firstFrame, frameType: 'first_frame' }],
        inputReferences: undefined,
        duration,
        aspectRatio: '9:16',
        resolution: '768p',
      })

      const playable = result.videoUrl || result.videoDataUrl
      if (!playable) {
        throw new Error('Video provider returned an empty clip URL')
      }

      console.info(
        `[generate-videos] ${type} ok via ${result.provider} · ${playable.slice(0, 48)}…`,
      )

      generated.push({
        type,
        label: LABELS[type],
        videoUrl: playable,
        videoDataUrl: playable,
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
          'All video generations failed. Check HeyGen / OpenRouter keys and models.',
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
