export type UserPlan = 'free' | 'starter' | 'growth' | 'pro'

export type PaidPlanId = 'starter' | 'growth' | 'pro'

export type PlanOption = {
  id: UserPlan
  name: string
  tagline: string
  monthly: number
  yearly: number
  featured?: boolean
  perks: string[]
}

export const PLAN_OPTIONS: PlanOption[] = [
  {
    id: 'free',
    name: 'Free',
    tagline: 'Try one image pack',
    monthly: 0,
    yearly: 0,
    perks: [
      '1 free product image pack',
      'Browse all studios & campaign flow',
      'Upgrade to generate video, ads & more',
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Launch your first campaigns',
    monthly: 29,
    yearly: 23,
    perks: [
      '5 campaigns / month',
      'Studio + lifestyle photos',
      '3 UGC videos / campaign',
      'Social captions & hooks',
      'ZIP export, no watermark',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    tagline: 'Scale creative output',
    monthly: 79,
    yearly: 63,
    featured: true,
    perks: [
      '20 campaigns / month',
      'Full image + video studios',
      'Ads & social creatives',
      'Priority generation queue',
      'Brand workspace settings',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Unlimited for serious brands',
    monthly: 149,
    yearly: 119,
    perks: [
      'Unlimited campaigns',
      'All studios unlocked',
      'Team seats ready',
      'Priority support',
      'Advanced brand controls',
    ],
  },
]

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
