import type { StudioKind } from './deliverables'
import { isPaidPlan, type UserPlan } from './plans'

export type GenerateAction =
  | 'photos'
  | 'videos'
  | 'ads'
  | 'campaign'
  | 'recreate-photos'
  | 'recreate-videos'
  | 'recreate-ads'

/** Everyone can open studios / campaign builder and explore the UI. */
export function canBrowseFeature(_plan: UserPlan, _kind?: StudioKind | 'campaign'): boolean {
  return true
}

/**
 * Free: first image generate only.
 * Paid plans: full generate access.
 */
export function canGenerate(input: {
  plan: UserPlan
  action: GenerateAction
  freeImageUsed: boolean
}): { allowed: boolean; reason?: string; needsPaywall: boolean } {
  if (isPaidPlan(input.plan)) {
    return { allowed: true, needsPaywall: false }
  }

  const isFreeImage =
    input.action === 'photos' || input.action === 'recreate-photos'

  if (isFreeImage && !input.freeImageUsed) {
    return { allowed: true, needsPaywall: false }
  }

  if (isFreeImage && input.freeImageUsed) {
    return {
      allowed: false,
      needsPaywall: true,
      reason:
        'Your free image trial is finished. Upgrade for more credits plus video and campaigns.',
    }
  }

  const labels: Record<GenerateAction, string> = {
    photos: 'more images',
    videos: 'videos',
    ads: 'ads & social',
    campaign: 'full campaigns',
    'recreate-photos': 'image recreates',
    'recreate-videos': 'video recreates',
    'recreate-ads': 'ad recreates',
  }

  return {
    allowed: false,
    needsPaywall: true,
    reason: `Free includes 1 image trial only. Upgrade to generate ${labels[input.action]}.`,
  }
}

/** @deprecated Prefer canGenerate — kept for older call sites */
export function canAccessStudio(plan: UserPlan, kind: StudioKind): boolean {
  if (isPaidPlan(plan)) return true
  return kind === 'photos'
}

export function canAccessFullCampaign(plan: UserPlan): boolean {
  return isPaidPlan(plan)
}

export function isProFeature(path: string): boolean {
  if (path.startsWith('/app/studio/videos')) return true
  if (path.startsWith('/app/studio/ads')) return true
  if (path === '/app/campaigns/new') return true
  return false
}

export const PRO_UPGRADE_COPY =
  'Free includes 1 image trial. Upgrade for more credits plus video and full campaigns.'

/** True when an API/UI error means free credits / trial are exhausted. */
export function isCreditsExhaustedMessage(message: string): boolean {
  return /free image|credits? (are |is )?used|credits? finished|trial (is )?finished|upgrade to a paid plan for more/i.test(
    message,
  )
}
