import type { UserPlan } from './plans'

/** Soft caps per campaign / studio generate. */
export type PlanGenerateLimits = {
  maxImages: number
  maxVideos: number
  label: string
}

/**
 * Paid plans: effectively unlimited for MVP Full Campaign
 * (capped only by available format catalog size in the UI).
 * Free: still 1 image / no video for studio try.
 */
export const PLAN_GENERATE_LIMITS: Record<UserPlan, PlanGenerateLimits> = {
  free: {
    maxImages: 1,
    maxVideos: 0,
    label: 'Free: 1 image · no video',
  },
  starter: {
    maxImages: 99,
    maxVideos: 99,
    label: 'Starter: choose as many image & video formats as you need',
  },
  growth: {
    maxImages: 99,
    maxVideos: 99,
    label: 'Growth: choose as many image & video formats as you need',
  },
  pro: {
    maxImages: 99,
    maxVideos: 99,
    label: 'Pro: choose as many image & video formats as you need',
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
