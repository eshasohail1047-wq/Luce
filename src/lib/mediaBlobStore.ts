/**
 * Durable blob cache for generated videos/images.
 * sessionStorage cannot hold MP4 data URLs (quota ~5MB) — IndexedDB can.
 */

const DB_NAME = 'luce-media-blobs'
const DB_VERSION = 1
const STORE = 'blobs'

type StoredBlob = {
  blob: Blob
  mime: string
  sourceUrl?: string
  updatedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE)
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () =>
      reject(req.error ?? new Error('Could not open media blob storage'))
  })
}

async function idbPut(key: string, value: StoredBlob): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () =>
        reject(tx.error ?? new Error('Could not save media blob'))
    })
  } finally {
    db.close()
  }
}

async function idbGet(key: string): Promise<StoredBlob | undefined> {
  const db = await openDb()
  try {
    return await new Promise<StoredBlob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(key)
      req.onsuccess = () => {
        const v = req.result as StoredBlob | undefined
        resolve(v?.blob instanceof Blob ? v : undefined)
      }
      req.onerror = () =>
        reject(req.error ?? new Error('Could not read media blob'))
    })
  } finally {
    db.close()
  }
}

/** sessionStorage-safe marker so we can revive blobs after reload */
export function mediaBlobRef(key: string): string {
  return `luce-blob:${key}`
}

export function isMediaBlobRef(url: string | undefined): boolean {
  return Boolean(url?.startsWith('luce-blob:'))
}

export function mediaBlobKeyFromRef(url: string): string | undefined {
  if (!url.startsWith('luce-blob:')) return undefined
  return url.slice('luce-blob:'.length) || undefined
}

function dataUrlToBlob(dataUrl: string): Blob {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataUrl)
  if (!match) throw new Error('Invalid data URL')
  const mime = match[1] || 'application/octet-stream'
  const isBase64 = Boolean(match[2])
  const data = match[3] || ''
  if (isBase64) {
    const bin = atob(data.replace(/\s/g, ''))
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type: mime })
  }
  return new Blob([decodeURIComponent(data)], { type: mime })
}

async function fetchAsBlob(url: string, timeoutMs = 90_000): Promise<Blob> {
  const ctrl = new AbortController()
  const timer = window.setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'same-origin' })
    if (!res.ok) {
      throw new Error(`Media download failed (${res.status})`)
    }
    const blob = await res.blob()
    if (blob.size < 500) {
      // Likely HTML/JSON error body mistaken for media
      const text = await blob.text().catch(() => '')
      if (/^\s*[<{]/.test(text) || /error/i.test(text)) {
        throw new Error('Media URL returned an error page, not a video file')
      }
    }
    return blob
  } finally {
    window.clearTimeout(timer)
  }
}

const objectUrlCache = new Map<string, string>()

/**
 * Resolve any playable URL to a browser-friendly object URL when needed,
 * and persist the bytes in IndexedDB under `cacheKey`.
 */
export async function materializePlayableUrl(
  url: string,
  cacheKey: string,
): Promise<string> {
  const trimmed = url.trim()
  if (!trimmed) throw new Error('Empty media URL')

  if (objectUrlCache.has(cacheKey)) {
    return objectUrlCache.get(cacheKey)!
  }

  // Already a blob ref — revive from IDB
  const fromRef = mediaBlobKeyFromRef(trimmed)
  if (fromRef) {
    const stored = await idbGet(fromRef)
    if (!stored) throw new Error('Saved video expired in this browser')
    const obj = URL.createObjectURL(stored.blob)
    objectUrlCache.set(cacheKey, obj)
    return obj
  }

  // Cached under this key already
  try {
    const stored = await idbGet(cacheKey)
    if (stored) {
      const obj = URL.createObjectURL(stored.blob)
      objectUrlCache.set(cacheKey, obj)
      return obj
    }
  } catch {
    /* continue */
  }

  let blob: Blob
  if (trimmed.startsWith('data:')) {
    blob = dataUrlToBlob(trimmed)
  } else if (
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/') ||
    /^https?:\/\//i.test(trimmed)
  ) {
    // External HTTPS may fail CORS — fall through to using the URL directly
    try {
      blob = await fetchAsBlob(trimmed)
    } catch (err) {
      if (/^https?:\/\//i.test(trimmed) && !trimmed.includes(window.location.host)) {
        // Cross-origin without CORS: play from original URL
        return trimmed
      }
      throw err
    }
  } else {
    throw new Error('Unsupported media URL')
  }

  const mime = blob.type || 'video/mp4'
  await idbPut(cacheKey, {
    blob,
    mime,
    sourceUrl: trimmed.startsWith('data:') ? undefined : trimmed,
    updatedAt: Date.now(),
  })
  const obj = URL.createObjectURL(blob)
  objectUrlCache.set(cacheKey, obj)
  return obj
}

/** Lightweight URL to persist in sessionStorage (avoids quota blow-ups). */
export function stashableVideoUrl(cacheKey: string, originalUrl: string): string {
  if (originalUrl.startsWith('data:') || originalUrl.startsWith('blob:')) {
    return mediaBlobRef(cacheKey)
  }
  // Same-origin proxy / relative — keep original; also keep blob ref as backup key
  if (originalUrl.startsWith('/')) return originalUrl
  if (/^https?:\/\//i.test(originalUrl)) return originalUrl
  return mediaBlobRef(cacheKey)
}

export async function getStoredMediaBlob(cacheKey: string): Promise<Blob | undefined> {
  const stored = await idbGet(cacheKey)
  return stored?.blob
}

export function videoCacheKey(campaignId: string, outputId: string): string {
  return `video:${campaignId}:${outputId}`
}
