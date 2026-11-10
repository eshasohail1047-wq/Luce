/** Shared credit costs — onboarding mix, Create studio, Plans. */

export const CREDIT_COSTS = {
  productImage: 2,
  carousel: 8,
  ugcSelfie: 20,
  sprayAsmr: 15,
  cinematic: 20,
  aiTestimonial: 30,
  story: 4,
  hookCopy: 1,
} as const

export type ContentMixId = keyof typeof CREDIT_COSTS

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
    defaultCount: 6,
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
    name: 'Spray ASMR',
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

export const TRIAL_WEEKLY_CREDITS = 60

export function mixTotalCredits(counts: Partial<Record<ContentMixId, number>>): number {
  return CONTENT_MIX_TYPES.reduce(
    (sum, row) => sum + (counts[row.id] ?? 0) * row.credits,
    0,
  )
}
