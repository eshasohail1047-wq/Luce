import {
  addDoc,
  collection,
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
  resolveAdStyles,
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
  mode?: CampaignMode
  studioKind?: StudioKind
  deliverables?: DeliverableId[]
  selectedAssets?: AssetType[]
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
  /** Empty / omitted = full default pack */
  deliverables?: DeliverableId[]
}

export type CreateStudioInput = {
  userId: string
  kind: StudioKind
  productName?: string
  description?: string
  brand?: string
  imageFile: File
  photoStyles?: PhotoStyleId[]
  videoStyles?: VideoStyleId[]
  adStyles?: AdStyleId[]
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

  if (input.sourceType === 'upload' && input.imageFile) {
    const path = `users/${input.userId}/products/${productRef.id}/source.${extFromFile(input.imageFile)}`
    try {
      const storageRef = ref(requireStorage(), path)
      await uploadBytes(storageRef, input.imageFile, {
        contentType: input.imageFile.type || 'image/jpeg',
        customMetadata: {
          originalName: input.imageFile.name.slice(0, 120),
        },
      })
      const url = await getDownloadURL(storageRef)
      imagePaths = [path]
      imageUrls = [url]
      await updateDoc(productRef, {
        imagePaths,
        imageUrls,
        updatedAt: serverTimestamp(),
      })
    } catch (err) {
      console.error('[campaigns] storage upload failed', err)
      const code =
        typeof err === 'object' && err && 'code' in err
          ? String((err as { code?: string }).code ?? '')
          : ''
      storageWarning =
        code.includes('unauthorized') || code.includes('permission')
          ? 'Saved, but the photo could not be uploaded yet.'
          : 'Saved, but the photo could not be uploaded.'
    }
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

  const resolved = resolveDeliverables(input.deliverables ?? [])

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
  assertImageFile(input.imageFile, true)

  const displayName =
    input.productName?.trim() || guessNameFromFile(input.imageFile)

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
    sourceType: 'upload',
    productUrl: '',
    displayName,
    description: input.description,
    brand: input.brand,
    imageFile: input.imageFile,
  })

  const campaignRef = await addDoc(collection(requireDb(), 'campaigns'), {
    userId: input.userId,
    productId: productRef.id,
    title: `${displayName} — ${titleSuffix}`,
    productName: displayName,
    productUrl: '',
    sourceType: 'upload',
    mode: 'studio' satisfies CampaignMode,
    studioKind: input.kind,
    status: 'product_confirmed' satisfies CampaignStatus,
    selectedAssets,
    includeStrategy: false,
    progressStep: 'product_confirmed',
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
      mode: (data.mode as CampaignMode) || 'campaign',
      studioKind: data.studioKind as StudioKind | undefined,
      deliverables: Array.isArray(data.deliverables)
        ? (data.deliverables as DeliverableId[])
        : undefined,
      selectedAssets: Array.isArray(data.selectedAssets)
        ? (data.selectedAssets as AssetType[])
        : undefined,
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
  imageUrl?: string
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
