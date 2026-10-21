/** Per-format quantity picks for Image / Video Studio. */

export type FormatQuantities = Partial<Record<string, number>>

/** Seconds per video format (Video Studio). */
export type FormatDurations = Partial<Record<string, number>>

export const MAX_PER_FORMAT = 6

/** Quick-pick lengths (HeyGen heygen-video-1 allows any integer 5–15s). */
export const VIDEO_DURATION_OPTIONS = [5, 8, 10, 15] as const
export const MIN_VIDEO_DURATION = 5
export const MAX_VIDEO_DURATION = 15
export const DEFAULT_VIDEO_DURATION = 5

/** Clamp to API-safe whole seconds (5–15). */
export function clampVideoDuration(raw: unknown): number {
  const n = Math.round(Number(raw))
  if (!Number.isFinite(n)) return DEFAULT_VIDEO_DURATION
  return Math.max(MIN_VIDEO_DURATION, Math.min(MAX_VIDEO_DURATION, n))
}

export function setFormatDuration(
  durations: FormatDurations,
  id: string,
  seconds: number,
): FormatDurations {
  return { ...durations, [id]: clampVideoDuration(seconds) }
}

/** When a format is deselected, drop its duration. */
export function syncDurationsToQuantities(
  quantities: FormatQuantities,
  durations: FormatDurations,
): FormatDurations {
  const next: FormatDurations = {}
  for (const [id, n] of Object.entries(quantities)) {
    if ((n || 0) > 0) {
      next[id] = clampVideoDuration(durations[id] ?? DEFAULT_VIDEO_DURATION)
    }
  }
  return next
}

export function totalQuantity(quantities: FormatQuantities): number {
  let sum = 0
  for (const n of Object.values(quantities)) {
    sum += Math.max(0, Math.floor(n || 0))
  }
  return sum
}

export function selectedFormatIds(quantities: FormatQuantities): string[] {
  return Object.entries(quantities)
    .filter(([, n]) => (n || 0) > 0)
    .map(([id]) => id)
}

/**
 * Expand { studio: 3, ugc: 1 } → ['studio','studio','studio','ugc']
 * Capped by maxTotal (plan limit).
 */
export function expandFormatQuantities(
  quantities: FormatQuantities,
  maxTotal: number,
): string[] {
  const cap = Math.max(0, maxTotal)
  const out: string[] = []
  for (const [id, raw] of Object.entries(quantities)) {
    const n = Math.max(0, Math.min(MAX_PER_FORMAT, Math.floor(raw || 0)))
    for (let i = 0; i < n; i++) {
      if (out.length >= cap) return out
      out.push(id)
    }
  }
  return out
}

export function setFormatQuantity(
  quantities: FormatQuantities,
  id: string,
  nextCount: number,
  maxTotal: number,
  maxPerFormat = MAX_PER_FORMAT,
): FormatQuantities {
  const others = totalQuantity(quantities) - Math.max(0, quantities[id] || 0)
  const room = Math.max(0, maxTotal - others)
  const clamped = Math.max(0, Math.min(maxPerFormat, room, Math.floor(nextCount)))
  const next = { ...quantities }
  if (clamped <= 0) delete next[id]
  else next[id] = clamped
  return next
}

export function toggleFormatQuantity(
  quantities: FormatQuantities,
  id: string,
  maxTotal: number,
): FormatQuantities {
  const current = quantities[id] || 0
  if (current > 0) {
    const next = { ...quantities }
    delete next[id]
    return next
  }
  return setFormatQuantity(quantities, id, 1, maxTotal)
}
