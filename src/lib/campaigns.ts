import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { requireDb, requireStorage } from './firebase'
import {
  sanitizeCreativeDirection,
  type CreativeDirection,
} from './creativeDirection'
import {
  resolveAdStyles,
  resolveCampaignFromFormats,
  resolveDeliverables,
  resolvePhotoStyles,
  resolveVideoStyles,
  type AdStyleId,
  type AssetType,
  type DeliverableId,
  type PhotoStyleId,
  type StudioKind,
  type VideoStyleId,
} from './deliverables'
import {
  clearCampaignStash,
  deleteLocalCampaign,
  isLocalCampaignId,
} from './localDemoCampaign'

export type CampaignStatus =
  | 'draft'
  | 'product_pending'
  | 'product_confirmed'
  | 'researching'
  | 'strategy_ready'
  | 'generating'
  | 'ready'
  | 'exported'
  | 'failed'

export type ProductSourceType = 'url' | 'upload'

export type CampaignMode = 'campaign' | 'studio'

export type CampaignDoc = {
  id: string
  userId: string
  productId: string
  title: string
  status: CampaignStatus
  productName: string
  productUrl?: string
  sourceType?: ProductSourceType
  mode?: CampaignMode
  studioKind?: StudioKind
  deliverables?: DeliverableId[]
  selectedAssets?: AssetType[]
  creativeDirection?: CreativeDirection
  tryFree?: boolean
  createdAt?: Timestamp
  updatedAt?: Timestamp
}

export type CreateCampaignInput = {
  userId: string
  sourceType: ProductSourceType
  productName?: string
  productUrl?: string
  description?: string
  brand?: string
  price?: string
  category?: string
  imageFile?: File | null
  /** Legacy pack checkboxes — prefer photoStyles / videoStyles */
  deliverables?: DeliverableId[]
  photoStyles?: PhotoStyleId[]
  videoStyles?: VideoStyleId[]
  includeSocial?: boolean
  includeAds?: boolean
  includeStrategy?: boolean
  creativeDirection?: CreativeDirection
}

export type CreateStudioInput = {
  userId: string
  kind: StudioKind
  sourceType?: ProductSourceType
  productUrl?: string
  productName?: string
  description?: string
  brand?: string
  imageFile?: File | null
  photoStyles?: PhotoStyleId[]
  videoStyles?: VideoStyleId[]
  adStyles?: AdStyleId[]
  creativeDirection?: CreativeDirection
  /** Landing “Try free” path — first image pack on free plan */
  tryFree?: boolean
}

function guessNameFromUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return `Product from ${host}`
  } catch {
    return 'Untitled product'
  }
}

function guessNameFromFile(file: File) {
  const base = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
  return base || 'Untitled product'
}

function extFromFile(file: File) {
  const fromName = file.name.split('.').pop()?.toLowerCase()
  if (fromName && fromName.length <= 5) return fromName
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/gif') return 'gif'
  return 'jpg'
}

async function createProductRecord(input: {
  userId: string
  sourceType: ProductSourceType
  productUrl: string
  displayName: string
  description?: string
  brand?: string
  price?: string
  category?: string
  imageFile?: File | null
}) {
  const db = requireDb()
  const productRef = await addDoc(collection(db, 'products'), {
    userId: input.userId,
    sourceType: input.sourceType,
    sourceUrl: input.productUrl,
    name: input.displayName,
    description: input.description?.trim() || '',
    features: [],
    category: input.category?.trim() || '',
    price: input.price?.trim() || '',
    brand: input.brand?.trim() || '',
    imagePaths: [],
    imageUrls: [],
    confirmed: true,
    detailsProvided: Boolean(
      input.description?.trim() ||
        input.brand?.trim() ||
        input.price?.trim() ||
        input.category?.trim(),
    ),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  let imagePaths: string[] = []
  let imageUrls: string[] = []
  let storageWarning: string | null = null

  // Never block campaign create on Storage — upload in the background.
  if (input.sourceType === 'upload' && input.imageFile) {
    const path = `users/${input.userId}/products/${productRef.id}/source.${extFromFile(input.imageFile)}`
    const file = input.imageFile
    storageWarning = 'Photo uploads in the background. You can generate the demo pack now.'
    void (async () => {
      try {
        const storageRef = ref(requireStorage(), path)
        await uploadBytes(storageRef, file, {
          contentType: file.type || 'image/jpeg',
          customMetadata: {
            originalName: file.name.slice(0, 120),
          },
        })
        const url = await getDownloadURL(storageRef)
        await updateDoc(productRef, {
          imagePaths: [path],
          imageUrls: [url],
          updatedAt: serverTimestamp(),
        })
      } catch (err) {
        console.error('[campaigns] background storage upload failed', err)
      }
    })()
  }

  return { productRef, imagePaths, imageUrls, storageWarning }
}

function assertImageFile(file: File | null | undefined, required: boolean) {
  if (!file) {
    if (required) throw new Error('Add a product photo to continue.')
    return
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file (JPG, PNG, or WebP).')
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('Image must be under 12MB.')
  }
}

export async function createCampaignWithProduct(input: CreateCampaignInput) {
  const sourceType = input.sourceType
  const productUrl = input.productUrl?.trim() || ''
  const displayName =
    input.productName?.trim() ||
    (sourceType === 'url' && productUrl
      ? guessNameFromUrl(productUrl)
      : input.imageFile
        ? guessNameFromFile(input.imageFile)
        : 'Untitled product')

  if (sourceType === 'url' && !productUrl) {
    throw new Error('Enter a product URL, or switch to photo upload.')
  }
  if (sourceType === 'upload') {
    assertImageFile(input.imageFile, true)
  } else if (input.imageFile) {
    assertImageFile(input.imageFile, false)
  }

  const resolved =
    input.photoStyles !== undefined || input.videoStyles !== undefined
      ? resolveCampaignFromFormats({
          photoStyles: input.photoStyles ?? [],
          videoStyles: input.videoStyles ?? [],
          includeSocial: input.includeSocial,
          includeAds: input.includeAds,
          includeStrategy: input.includeStrategy,
        })
      : resolveDeliverables(input.deliverables ?? [])

  const { productRef, imagePaths, imageUrls, storageWarning } = await createProductRecord({
    userId: input.userId,
    sourceType,
    productUrl,
    displayName,
    description: input.description,
    brand: input.brand,
    price: input.price,
    category: input.category,
    imageFile: sourceType === 'upload' ? input.imageFile : null,
  })

  const creativeDirection = sanitizeCreativeDirection(input.creativeDirection ?? {})

  const campaignRef = await addDoc(collection(requireDb(), 'campaigns'), {
    userId: input.userId,
    productId: productRef.id,
    title: `${displayName} campaign`,
    productName: displayName,
    productUrl,
    sourceType,
    mode: 'campaign' satisfies CampaignMode,
    status: 'product_confirmed' satisfies CampaignStatus,
    deliverables: resolved.deliverables,
    selectedAssets: resolved.selectedAssets,
    includeStrategy: resolved.includeStrategy,
    progressStep: 'product_confirmed',
    ...(creativeDirection ? { creativeDirection } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return {
    productId: productRef.id,
    campaignId: campaignRef.id,
    imagePaths,
    imageUrls,
    storageWarning,
  }
}

export async function createStudioProject(input: CreateStudioInput) {
  const sourceType: ProductSourceType =
    input.sourceType === 'url' || (input.productUrl?.trim() && !input.imageFile)
      ? 'url'
      : 'upload'
  const productUrl = input.productUrl?.trim() || ''

  if (sourceType === 'url') {
    if (!productUrl) throw new Error('Add a product URL to continue.')
    try {
      const parsed = new URL(productUrl)
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('invalid')
      }
    } catch {
      throw new Error('Enter a valid product URL (including https://).')
    }
  } else {
    assertImageFile(input.imageFile, true)
  }

  const displayName =
    input.productName?.trim() ||
    (sourceType === 'upload' && input.imageFile
      ? guessNameFromFile(input.imageFile)
      : guessNameFromUrl(productUrl))

  let selectedAssets: AssetType[]
  let titleSuffix: string

  if (input.kind === 'photos') {
    selectedAssets = resolvePhotoStyles(input.photoStyles ?? [])
    titleSuffix = 'Photos'
  } else if (input.kind === 'videos') {
    selectedAssets = resolveVideoStyles(input.videoStyles ?? [])
    titleSuffix = 'Videos'
  } else {
    selectedAssets = resolveAdStyles(input.adStyles ?? [])
    titleSuffix = 'Ads'
  }

  const { productRef, imagePaths, imageUrls, storageWarning } = await createProductRecord({
    userId: input.userId,
    sourceType,
    productUrl,
    displayName,
    description: input.description,
    brand: input.brand,
    imageFile: sourceType === 'upload' ? input.imageFile : null,
  })

  const creativeDirection = sanitizeCreativeDirection(input.creativeDirection ?? {})

  const campaignRef = await addDoc(collection(requireDb(), 'campaigns'), {
    userId: input.userId,
    productId: productRef.id,
    title: `${displayName} — ${titleSuffix}`,
    productName: displayName,
    productUrl: productUrl || '',
    sourceType,
    mode: 'studio' satisfies CampaignMode,
    studioKind: input.kind,
    status: 'product_confirmed' satisfies CampaignStatus,
    selectedAssets,
    includeStrategy: false,
    progressStep: 'product_confirmed',
    ...(input.tryFree ? { tryFree: true } : {}),
    ...(creativeDirection ? { creativeDirection } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })

  return {
    productId: productRef.id,
    campaignId: campaignRef.id,
    imagePaths,
    imageUrls,
    storageWarning,
  }
}

export async function listUserCampaigns(userId: string): Promise<CampaignDoc[]> {
  const q = query(collection(requireDb(), 'campaigns'), where('userId', '==', userId))
  const snap = await getDocs(q)
  const rows = snap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      userId: String(data.userId ?? ''),
      productId: String(data.productId ?? ''),
      title: String(data.title ?? 'Campaign'),
      status: (data.status as CampaignStatus) || 'draft',
      productName: String(data.productName ?? 'Product'),
      productUrl: data.productUrl ? String(data.productUrl) : undefined,
      sourceType:
        data.sourceType === 'url' || data.sourceType === 'upload'
          ? (data.sourceType as ProductSourceType)
          : undefined,
      mode: (data.mode as CampaignMode) || 'campaign',
      studioKind: data.studioKind as StudioKind | undefined,
      deliverables: Array.isArray(data.deliverables)
        ? (data.deliverables as DeliverableId[])
        : undefined,
      selectedAssets: Array.isArray(data.selectedAssets)
        ? (data.selectedAssets as AssetType[])
        : undefined,
      creativeDirection: data.creativeDirection
        ? sanitizeCreativeDirection(data.creativeDirection as CreativeDirection)
        : undefined,
      tryFree: Boolean(data.tryFree),
      createdAt: data.createdAt as CampaignDoc['createdAt'],
      updatedAt: data.updatedAt as CampaignDoc['updatedAt'],
    }
  })

  return rows.sort((a, b) => {
    const aTime = a.updatedAt?.toMillis?.() ?? 0
    const bTime = b.updatedAt?.toMillis?.() ?? 0
    return bTime - aTime
  })
}

export type ProductSummary = {
  id: string
  name: string
  category: string
  brand?: string
  sourceType?: ProductSourceType
  sourceUrl?: string
  imageUrl?: string
  campaignCount?: number
  updatedAt?: Timestamp
}

export async function listUserProducts(userId: string): Promise<ProductSummary[]> {
  const q = query(collection(requireDb(), 'products'), where('userId', '==', userId))
  const snap = await getDocs(q)
  const campaigns = await listUserCampaigns(userId)
  const countByProduct = new Map<string, number>()
  for (const c of campaigns) {
    if (!c.productId) continue
    countByProduct.set(c.productId, (countByProduct.get(c.productId) ?? 0) + 1)
  }

  const rows: ProductSummary[] = snap.docs.map((d) => {
    const data = d.data()
    const urls = Array.isArray(data.imageUrls) ? data.imageUrls : []
    const firstUrl = typeof urls[0] === 'string' ? urls[0] : undefined
    return {
      id: d.id,
      name: String(data.name ?? 'Product'),
      category: String(data.category ?? '').trim(),
      brand: String(data.brand ?? '').trim() || undefined,
      sourceType: data.sourceType === 'url' ? 'url' : 'upload',
      sourceUrl: data.sourceUrl ? String(data.sourceUrl) : undefined,
      imageUrl: firstUrl,
      campaignCount: countByProduct.get(d.id) ?? 0,
      updatedAt: data.updatedAt as Timestamp | undefined,
    }
  })

  return rows.sort((a, b) => {
    const aTime = a.updatedAt?.toMillis?.() ?? 0
    const bTime = b.updatedAt?.toMillis?.() ?? 0
    return bTime - aTime
  })
}

/** Strip undefined / nested-array-unsafe values so Firestore accepts the payload. */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) return value
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue
    out[k] = stripUndefinedDeep(v)
  }
  return out as T
}

/**
 * Firestore-safe campaign outputs: no undefined fields, no giant data:/blob: media.
 * Full AI assets stay in sessionStorage via stashCampaignOutputs.
 */
export function firestoreSafeOutputs(
  outputs: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return outputs.map((raw) => {
    const row: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw)) {
      if (v === undefined || v === null) continue
      if (typeof v === 'string' && (v.startsWith('data:') || v.startsWith('blob:'))) {
        if (k === 'imageUrl') row.imageUrlStoredLocally = true
        else if (k === 'videoUrl') row.videoUrlStoredLocally = true
        continue
      }
      if (Array.isArray(v)) {
        // Firestore forbids nested arrays; flatten to strings only
        row[k] = v.map(String)
        continue
      }
      row[k] = v
    }
    return row
  })
}

export async function updateCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
  extra: Record<string, unknown> = {},
) {
  const safeExtra = stripUndefinedDeep(extra)
  await updateDoc(doc(requireDb(), 'campaigns', campaignId), {
    status,
    progressStep: status,
    updatedAt: serverTimestamp(),
    ...safeExtra,
  })
}

/** Deletes a campaign owned by `userId` (Firestore or local demo). Clears stashed media. */
export async function deleteUserCampaign(userId: string, campaignId: string) {
  const id = campaignId.trim()
  if (!userId || !id) throw new Error('Missing campaign.')

  if (isLocalCampaignId(id)) {
    deleteLocalCampaign(id)
    return
  }

  const ref = doc(requireDb(), 'campaigns', id)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    clearCampaignStash(id)
    throw new Error('Campaign not found.')
  }
  if (String(snap.data().userId ?? '') !== userId) {
    throw new Error('You do not have access to this campaign.')
  }

  await deleteDoc(ref)
  clearCampaignStash(id)
}

/** Loads real product records — no placeholder images. */
export async function getProductsByIds(ids: string[]): Promise<Map<string, ProductSummary>> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  const map = new Map<string, ProductSummary>()

  await Promise.all(
    unique.map(async (id) => {
      try {
        const snap = await getDoc(doc(requireDb(), 'products', id))
        if (!snap.exists()) return
        const data = snap.data()
        const urls = Array.isArray(data.imageUrls) ? data.imageUrls : []
        const firstUrl = typeof urls[0] === 'string' ? urls[0] : undefined
        map.set(id, {
          id,
          name: String(data.name ?? 'Product'),
          category: String(data.category ?? '').trim(),
          imageUrl: firstUrl,
        })
      } catch (err) {
        console.error('[campaigns] product load failed', id, err)
      }
    }),
  )

  return map
}
