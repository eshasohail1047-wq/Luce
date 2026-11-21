/**
 * LUCE credit economy
 * Backend COGS (see api/_lib/providers.ts):
 * - Images: OpenRouter google/gemini-2.5-flash-image (Nano Banana) ~$0.039–0.04
 * - Videos: HeyGen heygen-video-1 — ~$0.02/s at 480p; app defaults to 768p (~$0.03/s)
 * 1 credit ≈ 1 product image. Videos cost more by length.
 */

export const CREDIT_COSTS = {
  /** One product still / format variation */
  productImage: 1,
  /** ~5-slide carousel with copy */
  carousel: 5,
  /** Creator-style talking / GRWM clip */
  ugcSelfie: 10,
  /** ASMR / spray / sensory motion ≤15s */
  sprayAsmr: 8,
  /** Cinematic product reveal ≤15s */
  cinematic: 8,
  /** AI avatar testimonial */
  aiTestimonial: 12,
  /** Single story / vertical frame */
  story: 1,
  /** Hook, caption, or CTA line */
  hookCopy: 1,
} as const

export type ContentMixId = keyof typeof CREDIT_COSTS

/** Credits for a Video Studio clip by length (5–15s). */
export function videoCreditsForDuration(seconds: number): number {
  const s = Math.round(Number(seconds))
  if (!Number.isFinite(s) || s <= 5) return 3
  if (s <= 8) return 5
  if (s <= 10) return 6
  return 8
}

export const CONTENT_MIX_TYPES: {
  id: ContentMixId
  name: string
  description: string
  credits: number
  defaultCount: number
}[] = [
  {
    id: 'productImage',
    name: 'Product images',
    description: 'Studio and lifestyle stills',
    credits: CREDIT_COSTS.productImage,
    defaultCount: 8,
  },
  {
    id: 'carousel',
    name: 'Carousels',
    description: 'Multi-slide product stories',
    credits: CREDIT_COSTS.carousel,
    defaultCount: 1,
  },
  {
    id: 'ugcSelfie',
    name: 'UGC selfie videos',
    description: 'Creator-style talking clips',
    credits: CREDIT_COSTS.ugcSelfie,
    defaultCount: 1,
  },
  {
    id: 'sprayAsmr',
    name: 'ASMR',
    description: 'Sensory product motion',
    credits: CREDIT_COSTS.sprayAsmr,
    defaultCount: 1,
  },
  {
    id: 'cinematic',
    name: 'Cinematic reveals',
    description: 'Hero product films',
    credits: CREDIT_COSTS.cinematic,
    defaultCount: 0,
  },
  {
    id: 'aiTestimonial',
    name: 'AI avatar testimonial',
    description: 'Spoken product proof',
    credits: CREDIT_COSTS.aiTestimonial,
    defaultCount: 0,
  },
  {
    id: 'story',
    name: 'Stories',
    description: 'Vertical story frames',
    credits: CREDIT_COSTS.story,
    defaultCount: 0,
  },
  {
    id: 'hookCopy',
    name: 'Hooks and ad copy',
    description: 'Captions and CTAs',
    credits: CREDIT_COSTS.hookCopy,
    defaultCount: 5,
  },
]

/** Free trial / first-week soft allotment for onboarding mix UI */
export const TRIAL_WEEKLY_CREDITS = 20

export function mixTotalCredits(counts: Partial<Record<ContentMixId, number>>): number {
  return CONTENT_MIX_TYPES.reduce(
    (sum, row) => sum + (counts[row.id] ?? 0) * row.credits,
    0,
  )
}

/** Optional top-ups (checkout later) */
export const CREDIT_ADDONS = [
  { credits: 50, price: 5, label: '50 credits' },
  { credits: 150, price: 12, label: '150 credits' },
  { credits: 500, price: 35, label: '500 credits' },
] as const
