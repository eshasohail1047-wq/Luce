import type { DeliverableId, StudioKind } from './deliverables'
import type { MockOutput } from './mockCampaign'

const PREFIX = 'luce.localCampaign.'

export type LocalCampaign = {
  id: string
  title: string
  status: string
  productName: string
  productId: string
  productUrl?: string
  mode: 'campaign' | 'studio'
  studioKind?: StudioKind
  deliverables: DeliverableId[]
  selectedAssets: string[]
  includeStrategy: boolean
  tryFree: boolean
  imageUrl?: string
  /** Per video format id → seconds */
  videoDurations?: Record<string, number>
  outputs?: MockOutput[]
  createdAt: number
}

export function newLocalId(kind: 'campaign' | 'studio' = 'campaign') {
  return `local-${kind}-${Date.now().toString(36)}`
}

/**
 * Persist campaign metadata only. Never embed large data: URLs here —
 * that blows sessionStorage quota and causes "Demo campaign not found".
 * Product photos go through stashCampaignImageSafe separately.
 */
export function saveLocalCampaign(campaign: LocalCampaign): boolean {
  const safeImage =
    campaign.imageUrl && !campaign.imageUrl.startsWith('data:')
      ? campaign.imageUrl
      : undefined
  // Outputs with embedded media are stashed separately
  const meta: LocalCampaign = {
    ...campaign,
    imageUrl: safeImage,
    outputs: undefined,
  }
  const json = JSON.stringify(meta)
  let ok = false
  try {
    sessionStorage.setItem(PREFIX + campaign.id, json)
    ok = true
  } catch (err) {
    console.error('[localDemo] sessionStorage save failed', err)
  }
  try {
    localStorage.setItem(PREFIX + campaign.id, json)
    ok = true
  } catch (err) {
    console.error('[localDemo] localStorage save failed', err)
  }
  return ok
}

export function loadLocalCampaign(id: string): LocalCampaign | null {
  try {
    const raw =
      sessionStorage.getItem(PREFIX + id) || localStorage.getItem(PREFIX + id)
    if (!raw) return null
    return JSON.parse(raw) as LocalCampaign
  } catch {
    return null
  }
}

export function updateLocalCampaign(id: string, patch: Partial<LocalCampaign>) {
  const current = loadLocalCampaign(id)
  if (!current) return null
  const next = { ...current, ...patch }
  if (!saveLocalCampaign(next)) return null
  return next
}

export function isLocalCampaignId(id: string | undefined) {
  return Boolean(id && id.startsWith('local-'))
}

const IMAGE_KEY = 'luce.campaignImage.'
const REF_KEY = 'luce.campaignRefImage.'
const OUTPUTS_KEY = 'luce.campaignOutputs.'
const DURATIONS_KEY = 'luce.campaignVideoDurations.'
const IMAGE_DB = 'luce-campaign-images'
const IMAGE_STORE = 'images'
/** Soft cache in web storage — IDB is the durable source of truth */
const WEB_CACHE_MAX_CHARS = 900_000

/**
 * Shrink large data URLs so sessionStorage (≈5MB) can hold them.
 * HTTPS URLs are returned unchanged.
 */
export async function compressImageDataUrl(
  dataUrl: string,
  maxEdge = 1280,
  quality = 0.82,
): Promise<string> {
  const src = dataUrl.trim()
  if (!src.startsWith('data:image/')) return src
  // Tiny payloads — skip work
  if (src.length < 280_000) return src

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        const w = img.naturalWidth || img.width
        const h = img.naturalHeight || img.height
        const scale = Math.min(1, maxEdge / Math.max(w, h, 1))
        const cw = Math.max(1, Math.round(w * scale))
        const ch = Math.max(1, Math.round(h * scale))
        // Already within edge and fairly small — keep original
        if (scale >= 1 && src.length < 500_000) {
          resolve(src)
          return
        }
        const canvas = document.createElement('canvas')
        canvas.width = cw
        canvas.height = ch
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(src)
          return
        }
        ctx.drawImage(img, 0, 0, cw, ch)
        const next = canvas.toDataURL('image/jpeg', quality)
        resolve(next.length < src.length ? next : src)
      } catch {
        resolve(src)
      }
    }
    img.onerror = () => resolve(src)
    img.src = src
  })
}

function openImageDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IMAGE_DB, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () =>
      reject(req.error ?? new Error('Could not open campaign image storage'))
  })
}

async function idbPutImage(campaignId: string, dataUrl: string): Promise<void> {
  const db = await openImageDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, 'readwrite')
    tx.objectStore(IMAGE_STORE).put(dataUrl, campaignId)
    tx.oncomplete = () => resolve()
    tx.onerror = () =>
      reject(tx.error ?? new Error('Could not save campaign image'))
  })
  db.close()
}

async function idbGetImage(campaignId: string): Promise<string | undefined> {
  const db = await openImageDb()
  const value = await new Promise<string | undefined>((resolve, reject) => {
    const tx = db.transaction(IMAGE_STORE, 'readonly')
    const req = tx.objectStore(IMAGE_STORE).get(campaignId)
    req.onsuccess = () => {
      const v = req.result
      resolve(typeof v === 'string' && v ? v : undefined)
    }
    req.onerror = () =>
      reject(req.error ?? new Error('Could not read campaign image'))
  })
  db.close()
  return value
}

function writeWebImageCache(campaignId: string, dataUrl: string): void {
  if (dataUrl.length > WEB_CACHE_MAX_CHARS) return
  const key = IMAGE_KEY + campaignId
  try {
    sessionStorage.setItem(key, dataUrl)
  } catch {
    /* ignore quota */
  }
  try {
    localStorage.setItem(key, dataUrl)
  } catch {
    /* ignore quota */
  }
}

/** Keep uploaded product photo available on review even if Storage is slow. */
export function stashCampaignImage(campaignId: string, dataUrl: string) {
  writeWebImageCache(campaignId, dataUrl)
  void idbPutImage(campaignId, dataUrl).catch((err) =>
    console.warn('[localDemo] IDB image stash failed', err),
  )
}

/** Compress then stash — IndexedDB is durable; web storage is a fast cache. */
export async function stashCampaignImageSafe(
  campaignId: string,
  dataUrl: string,
): Promise<string> {
  let compact = await compressImageDataUrl(dataUrl)
  if (!compact.startsWith('data:image/') && !compact.startsWith('http')) {
    throw new Error('Product photo could not be saved — try a JPG or PNG under 12MB.')
  }

  // Shrink until we can write durable IDB (always) + optional web cache
  for (const [edge, q] of [
    [1280, 0.82],
    [960, 0.72],
    [720, 0.62],
    [512, 0.55],
  ] as const) {
    if (compact.startsWith('data:image/') && compact.length > 1_200_000) {
      compact = await compressImageDataUrl(compact, edge, q)
    }
    try {
      await idbPutImage(campaignId, compact)
      writeWebImageCache(campaignId, compact)
      return compact
    } catch (err) {
      console.warn('[localDemo] image stash retry', edge, err)
      if (compact.startsWith('data:image/')) {
        compact = await compressImageDataUrl(compact, edge, q)
      }
    }
  }

  // Last resort: IDB with smallest payload
  try {
    if (compact.startsWith('data:image/')) {
      compact = await compressImageDataUrl(compact, 480, 0.5)
    }
    await idbPutImage(campaignId, compact)
    writeWebImageCache(campaignId, compact)
    return compact
  } catch {
    throw new Error(
      'Could not keep your product photo. Try a smaller JPG, then create the project again.',
    )
  }
}

/** Sync cache only — prefer resolveCampaignImage for full durability. */
export function loadStashedCampaignImage(campaignId: string): string | undefined {
  const key = IMAGE_KEY + campaignId
  try {
    const fromSession = sessionStorage.getItem(key)
    if (fromSession) return fromSession
  } catch {
    /* ignore */
  }
  try {
    const fromLocal = localStorage.getItem(key)
    if (fromLocal) {
      try {
        sessionStorage.setItem(key, fromLocal)
      } catch {
        /* ignore */
      }
      return fromLocal
    }
  } catch {
    /* ignore */
  }
  return undefined
}

/** Durable load: web cache → IndexedDB. Use on campaign page mount. */
export async function resolveCampaignImage(
  campaignId: string,
): Promise<string | undefined> {
  const cached = loadStashedCampaignImage(campaignId)
  if (cached) return cached
  try {
    const fromIdb = await idbGetImage(campaignId)
    if (fromIdb) {
      writeWebImageCache(campaignId, fromIdb)
      return fromIdb
    }
  } catch (err) {
    console.warn('[localDemo] IDB image load failed', err)
  }
  return undefined
}

/** Product-library thumb — survives even when Firestore imageUrls stayed empty. */
export async function stashProductImageSafe(
  productId: string,
  dataUrl: string,
): Promise<string | undefined> {
  const id = productId.trim()
  if (!id) return undefined
  const src = dataUrl.trim()
  if (!src) return undefined
  if (/^https?:\/\//i.test(src)) {
    try {
      await idbPutImage(`product:${id}`, src)
    } catch (err) {
      console.warn('[localDemo] product URL stash failed', err)
    }
    return src
  }
  if (!src.startsWith('data:image/')) return undefined
  try {
    const compact = await compressImageDataUrl(src, 720, 0.72)
    await idbPutImage(`product:${id}`, compact)
    return compact
  } catch (err) {
    console.warn('[localDemo] product image stash failed', err)
    return undefined
  }
}

export async function resolveProductImage(
  productId: string,
  firestoreUrl?: string,
): Promise<string | undefined> {
  const https = firestoreUrl?.trim()
  if (https && /^https?:\/\//i.test(https)) return https

  const id = productId.trim()
  if (!id) return https?.startsWith('data:image/') ? https : undefined

  try {
    const fromIdb = await idbGetImage(`product:${id}`)
    if (fromIdb) return fromIdb
  } catch (err) {
    console.warn('[localDemo] product image load failed', err)
  }

  if (https?.startsWith('data:image/')) return https
  return undefined
}

function writeWebRefCache(campaignId: string, dataUrl: string): void {
  if (dataUrl.length > WEB_CACHE_MAX_CHARS) return
  const key = REF_KEY + campaignId
  try {
    sessionStorage.setItem(key, dataUrl)
  } catch {
    /* ignore */
  }
  try {
    localStorage.setItem(key, dataUrl)
  } catch {
    /* ignore */
  }
}

/** Optional shoot/style reference — durable like product photo. */
export function stashCampaignRefImage(campaignId: string, dataUrl: string) {
  writeWebRefCache(campaignId, dataUrl)
  void idbPutImage(`ref:${campaignId}`, dataUrl).catch((err) =>
    console.warn('[localDemo] IDB ref stash failed', err),
  )
}

export async function stashCampaignRefImageSafe(
  campaignId: string,
  dataUrl: string,
): Promise<string> {
  const compact = await compressImageDataUrl(dataUrl, 1024, 0.8)
  if (!compact.startsWith('data:image/') && !compact.startsWith('http')) {
    throw new Error('Style reference could not be saved.')
  }
  try {
    await idbPutImage(`ref:${campaignId}`, compact)
  } catch (err) {
    console.warn('[localDemo] IDB ref put failed', err)
  }
  writeWebRefCache(campaignId, compact)
  return compact
}

export function loadStashedCampaignRefImage(campaignId: string): string | undefined {
  const key = REF_KEY + campaignId
  try {
    const fromSession = sessionStorage.getItem(key)
    if (fromSession) return fromSession
  } catch {
    /* ignore */
  }
  try {
    const fromLocal = localStorage.getItem(key)
    if (fromLocal) {
      try {
        sessionStorage.setItem(key, fromLocal)
      } catch {
        /* ignore */
      }
      return fromLocal
    }
  } catch {
    /* ignore */
  }
  return undefined
}

export async function resolveCampaignRefImage(
  campaignId: string,
): Promise<string | undefined> {
  const cached = loadStashedCampaignRefImage(campaignId)
  if (cached) return cached
  try {
    const fromIdb = await idbGetImage(`ref:${campaignId}`)
    if (fromIdb) {
      writeWebRefCache(campaignId, fromIdb)
      return fromIdb
    }
  } catch (err) {
    console.warn('[localDemo] IDB ref load failed', err)
  }
  return undefined
}

export function stashCampaignVideoDurations(
  campaignId: string,
  durations: Record<string, number>,
) {
  try {
    sessionStorage.setItem(DURATIONS_KEY + campaignId, JSON.stringify(durations))
  } catch (err) {
    console.error('[localDemo] video durations stash failed', err)
  }
}

export function loadStashedCampaignVideoDurations(
  campaignId: string,
): Record<string, number> | undefined {
  try {
    const raw = sessionStorage.getItem(DURATIONS_KEY + campaignId)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    const out: Record<string, number> = {}
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = Number(v)
      if (Number.isFinite(n) && n > 0) out[k] = n
    }
    return Object.keys(out).length ? out : undefined
  } catch {
    return undefined
  }
}

function firstOutputImageUrl(outputs: unknown): string | undefined {
  if (!Array.isArray(outputs)) return undefined
  for (const item of outputs) {
    if (!item || typeof item !== 'object') continue
    const row = item as { kind?: string; imageUrl?: string }
    const url = typeof row.imageUrl === 'string' ? row.imageUrl.trim() : ''
    if (!url) continue
    if (url.startsWith('data:image/') || /^https?:\/\//i.test(url)) return url
  }
  return undefined
}

/** Small durable list/grid cover (generated still or product photo). */
export async function stashCampaignCoverSafe(
  campaignId: string,
  dataUrl: string,
): Promise<string | undefined> {
  const src = dataUrl.trim()
  if (!src) return undefined
  if (/^https?:\/\//i.test(src)) {
    try {
      await idbPutImage(`cover:${campaignId}`, src)
    } catch (err) {
      console.warn('[localDemo] cover URL stash failed', err)
    }
    return src
  }
  if (!src.startsWith('data:image/')) return undefined
  try {
    const compact = await compressImageDataUrl(src, 640, 0.72)
    await idbPutImage(`cover:${campaignId}`, compact)
    return compact
  } catch (err) {
    console.warn('[localDemo] cover stash failed', err)
    return undefined
  }
}

export async function resolveCampaignCover(
  campaignId: string,
  productImageUrl?: string,
): Promise<string | undefined> {
  // 1) Generated pack still (same session)
  const fromOutputs = firstOutputImageUrl(
    loadStashedCampaignOutputs<unknown>(campaignId),
  )
  if (fromOutputs) {
    void stashCampaignCoverSafe(campaignId, fromOutputs)
    return fromOutputs
  }

  // 2) Durable cover from a previous generate in this browser
  try {
    const fromIdb = await idbGetImage(`cover:${campaignId}`)
    if (fromIdb) return fromIdb
  } catch (err) {
    console.warn('[localDemo] cover load failed', err)
  }

  // 3) Product photo on Firestore / CDN
  const product = productImageUrl?.trim()
  if (product && /^https?:\/\//i.test(product)) return product

  // 4) Local product photo stash for this campaign
  const stashedProduct = await resolveCampaignImage(campaignId)
  if (stashedProduct) return stashedProduct

  if (product?.startsWith('data:image/')) return product
  return undefined
}

export function stashCampaignOutputs(campaignId: string, outputs: unknown) {
  try {
    sessionStorage.setItem(OUTPUTS_KEY + campaignId, JSON.stringify(outputs))
  } catch (err) {
    console.error('[localDemo] outputs stash failed', err)
  }
  const cover = firstOutputImageUrl(outputs)
  if (cover) {
    void stashCampaignCoverSafe(campaignId, cover)
  }
}

export function loadStashedCampaignOutputs<T>(campaignId: string): T | undefined {
  try {
    const raw = sessionStorage.getItem(OUTPUTS_KEY + campaignId)
    if (!raw) return undefined
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

export function clearCampaignStash(campaignId: string) {
  try {
    sessionStorage.removeItem(IMAGE_KEY + campaignId)
    sessionStorage.removeItem(REF_KEY + campaignId)
    sessionStorage.removeItem(OUTPUTS_KEY + campaignId)
  } catch {
    /* ignore */
  }
}

export function deleteLocalCampaign(id: string) {
  try {
    sessionStorage.removeItem(PREFIX + id)
  } catch (err) {
    console.error('[localDemo] delete failed', err)
  }
  clearCampaignStash(id)
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('Could not read image'))
    reader.readAsDataURL(file)
  })
}

export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}-timeout`)), ms)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
