/** Recently used brand-catalog products for the dashboard (local only). */

export type RecentBrandProduct = {
  id: string
  name: string
  imageUrl: string
  sourceUrl?: string
  usedAt: number
}

const MAX_RECENTS = 8

function storageKey(userId: string) {
  return `luce:recentBrandProducts:${userId}`
}

export function loadRecentBrandProducts(userId: string): RecentBrandProduct[] {
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (row): row is RecentBrandProduct =>
          Boolean(row) &&
          typeof row === 'object' &&
          typeof (row as RecentBrandProduct).id === 'string' &&
          typeof (row as RecentBrandProduct).name === 'string' &&
          typeof (row as RecentBrandProduct).imageUrl === 'string',
      )
      .sort((a, b) => (b.usedAt || 0) - (a.usedAt || 0))
      .slice(0, MAX_RECENTS)
  } catch {
    return []
  }
}

export function rememberBrandProduct(
  userId: string,
  product: {
    id: string
    name: string
    imageUrl: string
    sourceUrl?: string
  },
): RecentBrandProduct[] {
  const next: RecentBrandProduct = {
    id: product.id,
    name: product.name,
    imageUrl: product.imageUrl,
    sourceUrl: product.sourceUrl,
    usedAt: Date.now(),
  }
  const prev = loadRecentBrandProducts(userId).filter((p) => p.id !== product.id)
  const merged = [next, ...prev].slice(0, MAX_RECENTS)
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(merged))
  } catch {
    /* quota — ignore */
  }
  return merged
}
