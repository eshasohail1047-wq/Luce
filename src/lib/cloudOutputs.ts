import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { requireAuth, requireStorage } from './firebase'
import type { MockOutput } from './mockCampaign'

/**
 * Durable copy of a campaign's generated outputs.
 * Media goes to Storage as files; a small JSON manifest (with download URLs instead of
 * data URLs) sits next to them. Firestore is not used, so there are no nested-array
 * write problems and storage.rules already scope everything to the owner.
 */

const MAX_MEDIA_BYTES = 14 * 1024 * 1024
const SAVE_DEBOUNCE_MS = 800

const timers = new Map<string, ReturnType<typeof setTimeout>>()
/** campaignId -> `${assetKey}` -> already-uploaded download URL (avoids re-uploading unchanged media). */
const uploaded = new Map<string, Map<string, string>>()

function isCloudCampaignId(id: string): boolean {
  return Boolean(id) && !id.startsWith('local-')
}

function currentUid(): string | null {
  try {
    return requireAuth().currentUser?.uid ?? null
  } catch {
    return null
  }
}

function manifestPath(uid: string, campaignId: string) {
  return `users/${uid}/campaigns/${campaignId}/outputs.json`
}

function extFor(contentType: string): string {
  if (contentType.includes('png')) return 'png'
  if (contentType.includes('webp')) return 'webp'
  if (contentType.includes('gif')) return 'gif'
  if (contentType.includes('mp4')) return 'mp4'
  if (contentType.includes('webm')) return 'webm'
  if (contentType.startsWith('video/')) return 'mp4'
  return 'jpg'
}

function safeSegment(value: string): string {
  return value.replace(/[^\w-]/g, '_').slice(0, 80) || 'asset'
}

/** Upload one media value (data: URL or fetchable URL). Returns a durable URL, or the input on failure. */
async function persistMedia(
  uid: string,
  campaignId: string,
  output: MockOutput,
  field: 'imageUrl' | 'videoUrl',
  value: string,
): Promise<string> {
  // Already durable.
  if (/^https:\/\/firebasestorage\.googleapis\.com\//.test(value)) return value

  const cache = uploaded.get(campaignId) ?? new Map<string, string>()
  uploaded.set(campaignId, cache)
  const cacheKey = `${output.id}:${field}:${value.length}:${value.slice(-48)}`
  const hit = cache.get(cacheKey)
  if (hit) return hit

  try {
    const res = await fetch(value)
    if (!res.ok) return value
    const blob = await res.blob()
    if (blob.size > MAX_MEDIA_BYTES || blob.size < 64) return value
    const type = blob.type || (field === 'videoUrl' ? 'video/mp4' : 'image/jpeg')
    if (!type.startsWith('image/') && !type.startsWith('video/')) return value
    if (type.startsWith('image/svg')) return value
    const path = `users/${uid}/campaigns/${campaignId}/outputs/${safeSegment(
      output.id,
    )}-${field === 'videoUrl' ? 'video' : 'image'}.${extFor(type)}`
    const storageRef = ref(requireStorage(), path)
    await uploadBytes(storageRef, blob, { contentType: type })
    const url = await getDownloadURL(storageRef)
    cache.set(cacheKey, url)
    return url
  } catch (err) {
    // Remote provider URLs without CORS, quota, offline… keep the original reference.
    console.warn('[cloudOutputs] media upload skipped', output.id, field, err)
    return value
  }
}

export async function saveCampaignOutputsToCloud(
  campaignId: string,
  outputs: MockOutput[],
): Promise<void> {
  const uid = currentUid()
  if (!uid || !isCloudCampaignId(campaignId) || !Array.isArray(outputs)) return

  const durable: MockOutput[] = []
  for (const output of outputs) {
    const next: MockOutput = { ...output }
    if (typeof next.imageUrl === 'string' && next.imageUrl) {
      next.imageUrl = await persistMedia(uid, campaignId, output, 'imageUrl', next.imageUrl)
    }
    if (typeof next.videoUrl === 'string' && next.videoUrl) {
      next.videoUrl = await persistMedia(uid, campaignId, output, 'videoUrl', next.videoUrl)
    }
    durable.push(next)
  }

  const blob = new Blob([JSON.stringify({ v: 1, outputs: durable })], {
    type: 'application/json',
  })
  await uploadBytes(ref(requireStorage(), manifestPath(uid, campaignId)), blob, {
    contentType: 'application/json',
  })
}

/** Debounced, fire-and-forget; safe to call on every stash. */
export function queueCampaignOutputsSave(campaignId: string, outputs: unknown) {
  if (!isCloudCampaignId(campaignId) || !Array.isArray(outputs)) return
  const existing = timers.get(campaignId)
  if (existing) clearTimeout(existing)
  timers.set(
    campaignId,
    setTimeout(() => {
      timers.delete(campaignId)
      void saveCampaignOutputsToCloud(campaignId, outputs as MockOutput[]).catch((err) =>
        console.warn('[cloudOutputs] save failed', err),
      )
    }, SAVE_DEBOUNCE_MS),
  )
}

export async function loadCampaignOutputsFromCloud(
  campaignId: string,
): Promise<MockOutput[] | undefined> {
  const uid = currentUid()
  if (!uid || !isCloudCampaignId(campaignId)) return undefined
  try {
    const url = await getDownloadURL(ref(requireStorage(), manifestPath(uid, campaignId)))
    const res = await fetch(url)
    if (!res.ok) return undefined
    const data = (await res.json()) as { outputs?: unknown }
    if (!Array.isArray(data.outputs) || !data.outputs.length) return undefined
    return data.outputs as MockOutput[]
  } catch {
    // No manifest yet (object-not-found) or offline.
    return undefined
  }
}
