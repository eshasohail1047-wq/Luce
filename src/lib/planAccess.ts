import type { UserPlan } from './userSettings'
import type { StudioKind } from './deliverables'

/** Free plan: Image Studio only. Everything else needs Pro. */
export function canAccessStudio(plan: UserPlan, kind: StudioKind): boolean {
  if (plan === 'pro') return true
  return kind === 'photos'
}

export function canAccessFullCampaign(plan: UserPlan): boolean {
  return plan === 'pro'
}

export function isProFeature(path: string): boolean {
  if (path.startsWith('/app/studio/videos')) return true
  if (path.startsWith('/app/studio/ads')) return true
  if (path === '/app/campaigns/new') return true
  return false
}

export const PRO_UPGRADE_COPY =
  'Free includes product images only. Upgrade to Pro for video, ads, and full campaigns.'
