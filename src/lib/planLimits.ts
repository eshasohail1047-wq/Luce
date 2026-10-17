import type { UserPlan } from './plans'

/** Soft caps per campaign / studio generate. */
export type PlanGenerateLimits = {
  maxImages: number
  maxVideos: number
  label: string
}

export const PLAN_GENERATE_LIMITS: Record<UserPlan, PlanGenerateLimits> = {
  free: {
    maxImages: 1,
    maxVideos: 0,
    label: 'Free: 1 image · no video',
  },
  starter: {
    maxImages: 5,
    maxVideos: 3,
    label: 'Starter: up to 5 images + 3 videos / campaign',
  },
  growth: {
    maxImages: 8,
    maxVideos: 5,
    label: 'Growth: up to 8 images + 5 videos / campaign',
  },
  pro: {
    maxImages: 12,
    maxVideos: 8,
    label: 'Pro: up to 12 images + 8 videos / campaign',
  },
}

export function getPlanLimits(plan: UserPlan): PlanGenerateLimits {
  return PLAN_GENERATE_LIMITS[plan] ?? PLAN_GENERATE_LIMITS.free
}

export function clampPhotoSelection<T>(selected: T[], plan: UserPlan): T[] {
  const max = getPlanLimits(plan).maxImages
  return selected.slice(0, Math.max(0, max))
}

export function clampVideoSelection<T>(selected: T[], plan: UserPlan): T[] {
  const max = getPlanLimits(plan).maxVideos
  return selected.slice(0, Math.max(0, max))
}

export function canAddPhoto(currentCount: number, plan: UserPlan): boolean {
  return currentCount < getPlanLimits(plan).maxImages
}

export function canAddVideo(currentCount: number, plan: UserPlan): boolean {
  return currentCount < getPlanLimits(plan).maxVideos
}
