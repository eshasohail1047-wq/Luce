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
  outputs?: MockOutput[]
  createdAt: number
}

export function newLocalId(kind: 'campaign' | 'studio' = 'campaign') {
  return `local-${kind}-${Date.now().toString(36)}`
}

export function saveLocalCampaign(campaign: LocalCampaign) {
  try {
    sessionStorage.setItem(PREFIX + campaign.id, JSON.stringify(campaign))
  } catch (err) {
    console.error('[localDemo] save failed', err)
  }
}

export function loadLocalCampaign(id: string): LocalCampaign | null {
  try {
    const raw = sessionStorage.getItem(PREFIX + id)
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
  saveLocalCampaign(next)
  return next
}

export function isLocalCampaignId(id: string | undefined) {
  return Boolean(id && id.startsWith('local-'))
}

const IMAGE_KEY = 'luce.campaignImage.'
const OUTPUTS_KEY = 'luce.campaignOutputs.'

/** Keep uploaded product photo available on review even if Storage is slow. */
export function stashCampaignImage(campaignId: string, dataUrl: string) {
  try {
    sessionStorage.setItem(IMAGE_KEY + campaignId, dataUrl)
  } catch (err) {
    console.error('[localDemo] image stash failed', err)
  }
}

export function loadStashedCampaignImage(campaignId: string): string | undefined {
  try {
    return sessionStorage.getItem(IMAGE_KEY + campaignId) || undefined
  } catch {
    return undefined
  }
}

export function stashCampaignOutputs(campaignId: string, outputs: unknown) {
  try {
    sessionStorage.setItem(OUTPUTS_KEY + campaignId, JSON.stringify(outputs))
  } catch (err) {
    console.error('[localDemo] outputs stash failed', err)
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
