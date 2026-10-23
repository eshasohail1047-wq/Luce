import type { MockOutput } from './mockCampaign'

const DB_NAME = 'luce-saved-assets'
const STORE = 'assets'
const DB_VERSION = 1

export type SavedAsset = {
  id: string
  userId: string
  campaignId: string
  outputId: string
  productName: string
  label: string
  kind: 'image' | 'video' | 'copy'
  assetType: string
  /** Preview / still */
  imageUrl?: string
  videoUrl?: string
  text?: string
  savedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('userId', 'userId', { unique: false })
        store.createIndex('userCampaignOutput', ['userId', 'campaignId', 'outputId'], {
          unique: true,
        })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () =>
      reject(req.error ?? new Error('Could not open saved assets storage'))
  })
}

function savedId(userId: string, campaignId: string, outputId: string) {
  return `${userId}:${campaignId}:${outputId}`
}

export async function isAssetSaved(
  userId: string,
  campaignId: string,
  outputId: string,
): Promise<boolean> {
  const db = await openDb()
  try {
    const id = savedId(userId, campaignId, outputId)
    const row = await new Promise<SavedAsset | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(id)
      req.onsuccess = () => resolve(req.result as SavedAsset | undefined)
      req.onerror = () => reject(req.error)
    })
    return Boolean(row)
  } finally {
    db.close()
  }
}

export async function saveAssetToLibrary(input: {
  userId: string
  campaignId: string
  productName: string
  output: MockOutput
}): Promise<SavedAsset> {
  const { userId, campaignId, productName, output } = input
  if (!output.imageUrl && !output.videoUrl && !output.text) {
    throw new Error('Nothing to save on this asset.')
  }
  const row: SavedAsset = {
    id: savedId(userId, campaignId, output.id),
    userId,
    campaignId,
    outputId: output.id,
    productName,
    label: output.label,
    kind: output.kind,
    assetType: output.assetType,
    imageUrl: output.imageUrl,
    videoUrl: output.videoUrl,
    text: output.text,
    savedAt: Date.now(),
  }
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put(row)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
  return row
}

export async function unsaveAsset(
  userId: string,
  campaignId: string,
  outputId: string,
): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(savedId(userId, campaignId, outputId))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function listSavedAssets(userId: string): Promise<SavedAsset[]> {
  const db = await openDb()
  try {
    const rows = await new Promise<SavedAsset[]>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const idx = tx.objectStore(STORE).index('userId')
      const req = idx.getAll(userId)
      req.onsuccess = () => resolve((req.result as SavedAsset[]) || [])
      req.onerror = () => reject(req.error)
    })
    return rows.sort((a, b) => b.savedAt - a.savedAt)
  } finally {
    db.close()
  }
}

export async function removeSavedAsset(id: string): Promise<void> {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}
