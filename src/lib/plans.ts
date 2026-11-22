export type UserPlan = 'free' | 'starter' | 'growth' | 'pro'

export type PaidPlanId = 'starter' | 'growth' | 'pro'

export type PlanOption = {
  id: UserPlan
  name: string
  tagline: string
  monthly: number
  yearly: number
  credits: number
  featured?: boolean
  cta: string
  perks: string[]
}

/**
 * Plans mirror what LUCE ships today:
 * Image Studio, Video Studio, Full Campaign (images + videos),
 * Products, Library, Brand kit, Calendar, ZIP export.
 * Not included yet: hooks, captions, CTAs, ads, strategy packs.
 *
 * COGS: Nano Banana ~$0.04/image · HeyGen ~$0.02–0.03/s (768p default).
 * 1 credit = 1 image · short video 3–8 credits.
 */
export const PLAN_OPTIONS: PlanOption[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Try Image Studio',
    monthly: 0,
    yearly: 0,
    credits: 1,
    cta: 'Start free',
    perks: [
      '1 free image trial',
      'Image Studio · photo or product URL',
      'Format presets + optional reference',
      'Browse Videos & Campaign',
      'Save to Library',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Images, videos & campaigns',
    monthly: 9,
    yearly: 7,
    credits: 80,
    cta: 'Choose Starter',
    perks: [
      '80 credits / month',
      'Image Studio + Video Studio',
      'Full Campaign · images + videos',
      'Products + Library',
      'ZIP export of your creatives',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'Ship creatives every week',
    monthly: 24,
    yearly: 19,
    credits: 250,
    featured: true,
    cta: 'Choose Growth',
    perks: [
      '250 credits / month',
      'Everything in Starter',
      'Brand kit on every generate',
      'Content calendar',
      'ZIP export of your creatives',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Higher volume for brands',
    monthly: 49,
    yearly: 39,
    credits: 600,
    cta: 'Choose Pro',
    perks: [
      '600 credits / month',
      'Everything in Growth',
      'Multi-product workflow',
      'Priority support',
    ],
  },
]

export const PLAN_CREDITS: Record<UserPlan, number> = {
  free: PLAN_OPTIONS.find((p) => p.id === 'free')!.credits,
  starter: PLAN_OPTIONS.find((p) => p.id === 'starter')!.credits,
  growth: PLAN_OPTIONS.find((p) => p.id === 'growth')!.credits,
  pro: PLAN_OPTIONS.find((p) => p.id === 'pro')!.credits,
}

export function isPaidPlan(plan: UserPlan): boolean {
  return plan === 'starter' || plan === 'growth' || plan === 'pro'
}

export function normalizeUserPlan(value: unknown): UserPlan {
  if (value === 'starter' || value === 'growth' || value === 'pro') return value
  return 'free'
}

export function planLabel(plan: UserPlan): string {
  return PLAN_OPTIONS.find((p) => p.id === plan)?.name || 'Free'
}

export function planCredits(plan: UserPlan): number {
  return PLAN_CREDITS[plan] ?? PLAN_CREDITS.free
}
