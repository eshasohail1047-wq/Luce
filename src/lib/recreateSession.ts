import type { StudioKind } from './deliverables'
import type { MockOutput } from './mockCampaign'

const KEY = 'luce.recreateSession'

export type RecreateSession = {
  campaignId: string
  assetId: string
  assetType: string
  label: string
  kind: 'image' | 'video' | 'copy'
  productName: string
  productUrl?: string
  imageUrl?: string
  studioKind: StudioKind
  note?: string
  /** Full pack so we can replace one asset and return */
  outputs: MockOutput[]
  campaignStatus?: string
}

export function studioKindForAsset(assetType: string): StudioKind {
  if (assetType.includes('video')) return 'videos'
  if (
    assetType.startsWith('ad_') ||
    assetType === 'caption' ||
    assetType === 'hook' ||
    assetType === 'cta' ||
    assetType === 'hashtags'
  ) {
    return 'ads'
  }
  return 'photos'
}

export function saveRecreateSession(session: RecreateSession) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session))
  } catch (err) {
    console.error('[recreateSession] save failed', err)
  }
}

export function loadRecreateSession(): RecreateSession | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as RecreateSession
  } catch {
    return null
  }
}

export function clearRecreateSession() {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

export function consumeRecreateSession(): RecreateSession | null {
  const session = loadRecreateSession()
  // Keep until studio submit succeeds so refresh doesn't lose context
  return session
}

export async function dataUrlToFile(
  dataUrl: string,
  filename = 'product.jpg',
): Promise<File | null> {
  try {
    const res = await fetch(dataUrl)
    const blob = await res.blob()
    const type = blob.type || 'image/jpeg'
    const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg'
    const name = filename.includes('.') ? filename : `${filename}.${ext}`
    return new File([blob], name, { type })
  } catch {
    return null
  }
}
