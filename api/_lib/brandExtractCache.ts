/**
 * Short-lived in-memory cache for brand extraction results (per server instance).
 */

type CacheEntry = { expires: number; value: unknown }

const store = new Map<string, CacheEntry>()
const DEFAULT_TTL_MS = 10 * 60 * 1000
const MAX_ENTRIES = 40

export function brandCacheGet<T>(key: string): T | undefined {
  const hit = store.get(key)
  if (!hit) return undefined
  if (Date.now() > hit.expires) {
    store.delete(key)
    return undefined
  }
  return hit.value as T
}

export function brandCacheSet(key: string, value: unknown, ttlMs = DEFAULT_TTL_MS): void {
  if (store.size >= MAX_ENTRIES) {
    // Drop oldest
    const first = store.keys().next().value
    if (first) store.delete(first)
  }
  store.set(key, { expires: Date.now() + ttlMs, value })
}

export function brandCacheKey(url: string): string {
  try {
    const u = new URL(url)
    u.hash = ''
    u.search = ''
    return `brand:${u.origin}${u.pathname}`.toLowerCase()
  } catch {
    return `brand:${url.trim().toLowerCase()}`
  }
}
