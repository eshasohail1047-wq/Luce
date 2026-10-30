import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore'
import { getDownloadURL, listAll, ref, uploadBytes } from 'firebase/storage'
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
  compressImageDataUrl,
  deleteLocalCampaign,
  fileToDataUrl,
  isLocalCampaignId,
  listLocalCampaigns,
  resolveCampaignCover,
  resolveProductImage,
  stashProductImageSafe,
  type LocalCampaign,
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
  includeHooks?: boolean
  includeCaptions?: boolean
  includeCtas?: boolean
  includeHashtags?: boolean
  includeAdCreative?: boolean
  includeAdCopy?: boolean
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
  /** Per video format id → length in seconds (5–15) */
  videoDurations?: Partial<Record<string, number>>
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

/** Compress upload for Storage reliability; keep a small thumb for Firestore fallback. */
async function prepareProductImageUpload(file: File): Promise<{
  blob: Blob
  ext: string
  contentType: string
  thumbDataUrl?: string
}> {
  try {
    const dataUrl = await fileToDataUrl(file)
    const compressed = await compressImageDataUrl(dataUrl, 1600, 0.82)
    const thumb = await compressImageDataUrl(dataUrl, 640, 0.68)
    const res = await fetch(compressed)
    const blob = await res.blob()
    return {
      blob,
      ext: 'jpg',
      contentType: blob.type || 'image/jpeg',
      thumbDataUrl:
        thumb.startsWith('data:image/') && thumb.length < 700_000 ? thumb : undefined,
    }
  } catch {
    return {
      blob: file,
      ext: extFromFile(file),
      contentType: file.type || 'image/jpeg',
    }
  }
}

function firstImageUrl(value: unknown): string | undefined {
  const urls = Array.isArray(value) ? value : []
  const first = typeof urls[0] === 'string' ? urls[0].trim() : ''
  if (!first) return undefined
  if (/^https?:\/\//i.test(first) || first.startsWith('data:image/')) return first
  return undefined
}

function firstImagePath(value: unknown): string | undefined {
  const paths = Array.isArray(value) ? value : []
  const first = typeof paths[0] === 'string' ? paths[0].trim() : ''
  return first || undefined
}

async function backfillProductImageFields(
  productId: string,
  fields: { imageUrls?: string[]; imagePaths?: string[] },
) {
  try {
    await updateDoc(doc(requireDb(), 'products', productId), {
      ...fields,
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.warn('[campaigns] product image backfill failed', productId, err)
  }
}

/** Prefer stored URL; heal from imagePaths or by listing the product Storage folder. */
async function healProductImageUrl(
  productId: string,
  data: { imageUrls?: unknown; imagePaths?: unknown; userId?: unknown },
): Promise<string | undefined> {
  const existing = firstImageUrl(data.imageUrls)
  if (existing) return existing

  const path = firstImagePath(data.imagePaths)
  if (path) {
    try {
      const url = await getDownloadURL(ref(requireStorage(), path))
      void backfillProductImageFields(productId, {
        imagePaths: [path],
        imageUrls: [url],
      })
      return url
    } catch (err) {
      console.warn('[campaigns] getDownloadURL failed', productId, err)
    }
  }

  // Older creates left empty imagePaths even when a file might exist under the product folder.
  const userId = typeof data.userId === 'string' ? data.userId.trim() : ''
  if (!userId) return undefined
  try {
    const folder = ref(requireStorage(), `users/${userId}/products/${productId}`)
    const listed = await listAll(folder)
    const fileRef = listed.items[0]
    if (!fileRef) return undefined
    const url = await getDownloadURL(fileRef)
    void backfillProductImageFields(productId, {
      imagePaths: [fileRef.fullPath],
      imageUrls: [url],
    })
    return url
  } catch (err) {
    console.warn('[campaigns] storage list heal failed', productId, err)
    return undefined
  }
}

/** Persist a recovered cover (HTTPS or small data thumb) onto the product doc. */
export async function backfillProductImageUrl(
  productId: string,
  imageUrl: string,
): Promise<void> {
  const id = productId.trim()
  const url = imageUrl.trim()
  if (!id || !url) return
  if (/^https?:\/\//i.test(url)) {
    await backfillProductImageFields(id, { imageUrls: [url] })
    return
  }
  if (url.startsWith('data:image/') && url.length < 700_000) {
    await backfillProductImageFields(id, { imageUrls: [url] })
  }
}

/** Replace / attach a product photo from the Products catalog. */
export async function updateProductPhoto(input: {
  userId: string
  productId: string
  imageFile: File
}): Promise<{ imageUrl: string; storageWarning?: string }> {
  const productId = input.productId.trim()
  if (!input.userId || !productId) throw new Error('Missing product.')
  assertImageFile(input.imageFile, true)

  const snap = await getDoc(doc(requireDb(), 'products', productId))
  if (!snap.exists()) throw new Error('Product not found.')
  if (String(snap.data().userId ?? '') !== input.userId) {
    throw new Error('You do not have access to this product.')
  }

  const prepared = await prepareProductImageUpload(input.imageFile)
  const path = `users/${input.userId}/products/${productId}/source.${prepared.ext}`

  try {
    const storageRef = ref(requireStorage(), path)
    await uploadBytes(storageRef, prepared.blob, {
      contentType: prepared.contentType,
      customMetadata: {
        originalName: input.imageFile.name.slice(0, 120),
      },
    })
    const url = await getDownloadURL(storageRef)
    await updateDoc(doc(requireDb(), 'products', productId), {
      imagePaths: [path],
      imageUrls: [url],
      sourceType: 'upload',
      updatedAt: serverTimestamp(),
    })
    return { imageUrl: url }
  } catch (err) {
    console.error('[campaigns] updateProductPhoto upload failed', err)
    if (prepared.thumbDataUrl) {
      await updateDoc(doc(requireDb(), 'products', productId), {
        imageUrls: [prepared.thumbDataUrl],
        sourceType: 'upload',
        updatedAt: serverTimestamp(),
      })
      return {
        imageUrl: prepared.thumbDataUrl,
        storageWarning:
          'Photo saved as a catalog thumb. Cloud storage upload failed — try again later.',
      }
    }
    throw new Error('Could not upload product photo. Try a smaller JPG or PNG.')
  }
}

/** Flat string[] only — nested arrays / objects trigger Firestore nested-entity errors. */
export function asFlatStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const out: string[] = []
  for (const item of value) {
    if (item === undefined || item === null) continue
    if (Array.isArray(item)) {
      // Flatten one level of accidental nesting; never write array-in-array.
      for (const nested of item) {
        if (nested === undefined || nested === null) continue
        const s = typeof nested === 'string' ? nested.trim() : String(nested).trim()
        if (s) out.push(s)
      }
      continue
    }
    if (typeof item === 'object') continue
    const s = typeof item === 'string' ? item.trim() : String(item).trim()
    if (s) out.push(s)
  }
  return out
}

/** User-facing message — never surface raw Firebase nested-entity text. */
export function friendlyFirestoreError(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  const lower = raw.toLowerCase()
  if (
    lower.includes('invalid nested entity') ||
    lower.includes('nested arrays') ||
    lower.includes('unsupported field value') ||
    lower.includes('custom objects') ||
    lower.includes('firebase') ||
    lower.includes('firestore')
  ) {
    return fallback
  }
  return raw.trim() || fallback
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
  // Do NOT run this payload through stripUndefinedDeep — it corrupts serverTimestamp().
  const productRef = await addDoc(collection(db, 'products'), {
    userId: input.userId,
    sourceType: input.sourceType,
    sourceUrl: input.productUrl,
    name: input.displayName,
    description: input.description?.trim() || '',
    features: [] as string[],
    category: input.category?.trim() || '',
    price: input.price?.trim() || '',
    brand: input.brand?.trim() || '',
    imagePaths: [] as string[],
    imageUrls: [] as string[],
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

  // Await upload whenever we have a photo (page-URL flow may also resolve one).
  if (input.imageFile) {
    const file = input.imageFile
    const prepared = await prepareProductImageUpload(file)
    const path = `users/${input.userId}/products/${productRef.id}/source.${prepared.ext}`
    try {
      const storageRef = ref(requireStorage(), path)
      await uploadBytes(storageRef, prepared.blob, {
        contentType: prepared.contentType,
        customMetadata: {
          originalName: file.name.slice(0, 120),
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
      storageWarning =
        'Photo could not be uploaded to cloud storage. Using a local catalog thumb when possible.'
      // Durable fallback so Products never show empty "Photo pending" for this create.
      if (prepared.thumbDataUrl) {
        imageUrls = [prepared.thumbDataUrl]
        try {
          await updateDoc(productRef, {
            imageUrls,
            updatedAt: serverTimestamp(),
          })
        } catch (thumbErr) {
          console.error('[campaigns] thumb fallback write failed', thumbErr)
        }
      }
      // Retry Storage in background; replace thumb with HTTPS URL when it lands.
      void (async () => {
        try {
          const storageRef = ref(requireStorage(), path)
          await uploadBytes(storageRef, prepared.blob, {
            contentType: prepared.contentType,
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
        } catch (retryErr) {
          console.error('[campaigns] storage retry failed', retryErr)
        }
      })()
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
  try {
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
            includeHooks: input.includeHooks,
            includeCaptions: input.includeCaptions,
            includeCtas: input.includeCtas,
            includeHashtags: input.includeHashtags,
            includeAdCreative: input.includeAdCreative,
            includeAdCopy: input.includeAdCopy,
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
      imageFile: input.imageFile ?? null,
    })

    const creativeDirection = sanitizeCreativeDirection(input.creativeDirection ?? {})

    // Never stripUndefinedDeep here — serverTimestamp() sentinels must stay intact.
    const campaignRef = await addDoc(collection(requireDb(), 'campaigns'), {
      userId: input.userId,
      productId: productRef.id,
      title: `${displayName} campaign`,
      productName: displayName,
      productUrl,
      sourceType,
      mode: 'campaign' satisfies CampaignMode,
      status: 'product_confirmed' satisfies CampaignStatus,
      deliverables: asFlatStringArray(resolved.deliverables),
      selectedAssets: asFlatStringArray(resolved.selectedAssets),
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
  } catch (err) {
    if (err instanceof Error && !/firebase|firestore|nested entity/i.test(err.message)) {
      throw err
    }
    throw new Error(
      friendlyFirestoreError(err, 'Could not create campaign in the cloud.'),
    )
  }
}

export async function createStudioProject(input: CreateStudioInput) {
  try {
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
      imageFile: input.imageFile ?? null,
    })

    const creativeDirection = sanitizeCreativeDirection(input.creativeDirection ?? {})

    // Never stripUndefinedDeep here — serverTimestamp() sentinels must stay intact.
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
      selectedAssets: asFlatStringArray(selectedAssets),
      includeStrategy: false,
      progressStep: 'product_confirmed',
      ...(input.tryFree ? { tryFree: true } : {}),
      ...(creativeDirection ? { creativeDirection } : {}),
      ...(input.kind === 'videos' &&
      input.videoDurations &&
      Object.keys(input.videoDurations).length > 0
        ? { videoDurations: input.videoDurations }
        : {}),
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
  } catch (err) {
    if (err instanceof Error && !/firebase|firestore|nested entity/i.test(err.message)) {
      throw err
    }
    throw new Error(
      friendlyFirestoreError(err, 'Could not create studio project in the cloud.'),
    )
  }
}

function millisFromTs(value: CampaignDoc['updatedAt'] | CampaignDoc['createdAt']) {
  return value?.toMillis?.() ?? 0
}

/** Adapt browser-local demo campaigns into the same shape Projects / Products list. */
function localCampaignToDoc(local: LocalCampaign, userId: string): CampaignDoc {
  const ms = Number(local.createdAt) || Date.now()
  const stamp = { toMillis: () => ms } as CampaignDoc['createdAt']
  return {
    id: local.id,
    userId,
    productId: local.productId || '',
    title: local.title || `${local.productName || 'Product'} project`,
    status: (local.status as CampaignStatus) || 'draft',
    productName: local.productName || 'Product',
    productUrl: local.productUrl,
    mode: local.mode || 'campaign',
    studioKind: local.studioKind,
    deliverables: local.deliverables,
    selectedAssets: local.selectedAssets as AssetType[] | undefined,
    tryFree: Boolean(local.tryFree),
    createdAt: stamp,
    updatedAt: stamp,
  }
}

/**
 * Cloud campaigns for this user, merged with local/demo projects from this
 * browser. Firestore failures must not hide local studio packs or hang forever.
 */
export async function listUserCampaigns(userId: string): Promise<CampaignDoc[]> {
  let cloud: CampaignDoc[] = []
  try {
    const q = query(collection(requireDb(), 'campaigns'), where('userId', '==', userId))
    const snap = await Promise.race([
      getDocs(q),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('listUserCampaigns-timeout')), 12_000)
      }),
    ])
    cloud = snap.docs.map((d) => {
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
          ? (asFlatStringArray(data.deliverables) as DeliverableId[])
          : undefined,
        selectedAssets: Array.isArray(data.selectedAssets)
          ? (asFlatStringArray(data.selectedAssets) as AssetType[])
          : undefined,
        creativeDirection: data.creativeDirection
          ? sanitizeCreativeDirection(data.creativeDirection as CreativeDirection)
          : undefined,
        tryFree: Boolean(data.tryFree),
        createdAt: data.createdAt as CampaignDoc['createdAt'],
        updatedAt: data.updatedAt as CampaignDoc['updatedAt'],
      }
    })
  } catch (err) {
    console.warn('[campaigns] listUserCampaigns cloud failed — showing local only', err)
  }

  const local = listLocalCampaigns().map((row) => localCampaignToDoc(row, userId))
  const byId = new Map<string, CampaignDoc>()
  // Cloud first; local overlays same id (demo ids never collide with Firestore).
  for (const row of cloud) byId.set(row.id, row)
  for (const row of local) byId.set(row.id, row)

  return [...byId.values()].sort((a, b) => {
    const aTime = millisFromTs(a.updatedAt) || millisFromTs(a.createdAt)
    const bTime = millisFromTs(b.updatedAt) || millisFromTs(b.createdAt)
    return bTime - aTime
  })
}

export type ProductSummary = {
  id: string
  name: string
  category: string
  brand?: string
  description?: string
  sourceType?: ProductSourceType
  sourceUrl?: string
  imageUrl?: string
  imagePath?: string
  campaignCount?: number
  updatedAt?: Timestamp
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallback), ms)
    }),
  ])
}

function normalizeProductName(value: string | undefined): string {
  return (value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

/** Collapse repeated adds of the same product (name or URL) into one catalog row. */
function productDedupeKey(product: ProductSummary): string {
  const rawUrl = product.sourceUrl?.trim()
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl)
      const path = parsed.pathname.replace(/\/+$/, '') || '/'
      return `url:${parsed.host.toLowerCase()}${path.toLowerCase()}`
    } catch {
      return `url:${rawUrl.toLowerCase()}`
    }
  }
  const name = normalizeProductName(product.name)
  if (name) return `name:${name}`
  return `id:${product.id}`
}

function mergeDuplicateProducts(a: ProductSummary, b: ProductSummary): ProductSummary {
  const aSynth = a.id.startsWith('campaign:')
  const bSynth = b.id.startsWith('campaign:')
  const aTime = a.updatedAt?.toMillis?.() ?? 0
  const bTime = b.updatedAt?.toMillis?.() ?? 0

  let primary = a
  let secondary = b
  if (aSynth && !bSynth) {
    primary = b
    secondary = a
  } else if (!aSynth && bSynth) {
    primary = a
    secondary = b
  } else if (!a.imageUrl && b.imageUrl) {
    primary = b
    secondary = a
  } else if (bTime > aTime) {
    primary = b
    secondary = a
  }

  return {
    ...primary,
    name: primary.name || secondary.name,
    brand: primary.brand || secondary.brand,
    category: primary.category || secondary.category,
    description: primary.description || secondary.description,
    sourceType: primary.sourceType || secondary.sourceType,
    sourceUrl: primary.sourceUrl || secondary.sourceUrl,
    imageUrl: primary.imageUrl || secondary.imageUrl,
    imagePath: primary.imagePath || secondary.imagePath,
    campaignCount: (a.campaignCount ?? 0) + (b.campaignCount ?? 0),
    updatedAt: aTime >= bTime ? a.updatedAt : b.updatedAt,
  }
}

function dedupeProducts(rows: ProductSummary[]): ProductSummary[] {
  const byKey = new Map<string, ProductSummary>()
  for (const row of rows) {
    const key = productDedupeKey(row)
    const existing = byKey.get(key)
    byKey.set(key, existing ? mergeDuplicateProducts(existing, row) : row)
  }
  return [...byKey.values()]
}

export async function listUserProducts(userId: string): Promise<ProductSummary[]> {
  const campaigns = await listUserCampaigns(userId)
  const campaignsByProduct = new Map<string, CampaignDoc[]>()
  for (const c of campaigns) {
    const key = c.productId?.trim() || `campaign:${c.id}`
    const list = campaignsByProduct.get(key) ?? []
    list.push(c)
    campaignsByProduct.set(key, list)
  }

  const byId = new Map<string, ProductSummary>()

  try {
    const q = query(collection(requireDb(), 'products'), where('userId', '==', userId))
    const snap = await withTimeout(
      getDocs(q),
      10_000,
      null as Awaited<ReturnType<typeof getDocs>> | null,
    )
    if (snap) {
      for (const d of snap.docs) {
        const data = d.data()
        // Fast path only — Storage heal can hang and was freezing Products on "Loading…".
        const imageUrl = firstImageUrl(data.imageUrls)
        byId.set(d.id, {
          id: d.id,
          name: String(data.name ?? 'Product'),
          category: String(data.category ?? '').trim(),
          brand: String(data.brand ?? '').trim() || undefined,
          description: String(data.description ?? '').trim() || undefined,
          sourceType: data.sourceType === 'url' ? 'url' : 'upload',
          sourceUrl: data.sourceUrl ? String(data.sourceUrl) : undefined,
          imageUrl,
          imagePath: firstImagePath(data.imagePaths),
          campaignCount: campaignsByProduct.get(d.id)?.length ?? 0,
          updatedAt: data.updatedAt as Timestamp | undefined,
        })
        if (!imageUrl) {
          void healProductImageUrl(d.id, data).then((healed) => {
            if (healed) void stashProductImageSafe(d.id, healed)
          })
        }
      }
    }
  } catch (err) {
    console.warn('[campaigns] listUserProducts cloud failed — deriving from projects', err)
  }

  // Surface every product the user entered via studio / campaigns, even when the
  // Firestore products doc is missing or imageUrls never backfilled.
  for (const [key, linked] of campaignsByProduct) {
    const newest = linked[0]
    const existing = byId.get(key)
    if (existing) {
      byId.set(key, {
        ...existing,
        campaignCount: linked.length,
        name: existing.name || newest?.productName || 'Product',
        sourceType: existing.sourceType || newest?.sourceType,
        sourceUrl: existing.sourceUrl || newest?.productUrl,
      })
      continue
    }

    byId.set(key, {
      id: key,
      name: newest?.productName || newest?.title || 'Product',
      category: '',
      sourceType: newest?.sourceType || (newest?.productUrl ? 'url' : 'upload'),
      sourceUrl: newest?.productUrl,
      campaignCount: linked.length,
      updatedAt: newest?.updatedAt || newest?.createdAt,
    })
  }

  // Same cover pipeline as Projects, but each resolve is time-boxed so the page
  // cannot stay on "Loading…" if IndexedDB / Storage stalls.
  const coverByCampaignId = new Map<string, string>()
  const coverByProductId = new Map<string, string>()
  const coverByName = new Map<string, string>()
  await Promise.all(
    campaigns.map(async (campaign) => {
      const url = await withTimeout(resolveCampaignCover(campaign.id), 2500, undefined)
      if (!url) return
      coverByCampaignId.set(campaign.id, url)
      const pid = campaign.productId?.trim()
      if (pid && !coverByProductId.has(pid)) coverByProductId.set(pid, url)
      const nameKey = normalizeProductName(campaign.productName || campaign.title)
      if (nameKey && !coverByName.has(nameKey)) coverByName.set(nameKey, url)
    }),
  )

  const rows = await Promise.all(
    [...byId.values()].map(async (product) => {
      let imageUrl = await withTimeout(
        resolveProductImage(product.id, product.imageUrl),
        2000,
        product.imageUrl,
      )

      if (!imageUrl) imageUrl = coverByProductId.get(product.id)

      if (!imageUrl) {
        const linked = campaignsByProduct.get(product.id) ?? []
        for (const campaign of linked) {
          imageUrl = coverByCampaignId.get(campaign.id)
          if (imageUrl) break
        }
      }

      if (!imageUrl && product.id.startsWith('campaign:')) {
        imageUrl = coverByCampaignId.get(product.id.slice('campaign:'.length))
      }

      if (!imageUrl) {
        imageUrl = coverByName.get(normalizeProductName(product.name))
      }

      if (imageUrl) {
        void stashProductImageSafe(product.id, imageUrl)
        if (
          !product.id.startsWith('campaign:') &&
          (!product.imageUrl || product.imageUrl !== imageUrl)
        ) {
          void backfillProductImageUrl(product.id, imageUrl)
        }
        return { ...product, imageUrl }
      }
      return product
    }),
  )

  return dedupeProducts(rows).sort((a, b) => {
    const aTime = a.updatedAt?.toMillis?.() ?? 0
    const bTime = b.updatedAt?.toMillis?.() ?? 0
    return bTime - aTime
  })
}

/** Load one product for Studio / Full Campaign reuse from Products CTAs. */
export async function getProductById(
  productId: string,
  userId?: string,
): Promise<ProductSummary | null> {
  const id = productId.trim()
  if (!id) return null
  try {
    const snap = await getDoc(doc(requireDb(), 'products', id))
    if (!snap.exists()) return null
    const data = snap.data()
    if (userId && String(data.userId ?? '') !== userId) return null
    const imageUrl = await healProductImageUrl(id, data)
    return {
      id,
      name: String(data.name ?? 'Product'),
      category: String(data.category ?? '').trim(),
      brand: String(data.brand ?? '').trim() || undefined,
      description: String(data.description ?? '').trim() || undefined,
      sourceType: data.sourceType === 'url' ? 'url' : 'upload',
      sourceUrl: data.sourceUrl ? String(data.sourceUrl) : undefined,
      imageUrl,
      imagePath: firstImagePath(data.imagePaths),
      updatedAt: data.updatedAt as Timestamp | undefined,
    }
  } catch (err) {
    console.error('[campaigns] getProductById failed', id, err)
    return null
  }
}

/** Firestore sentinels / special objects must not be walked with Object.entries. */
function isFirestoreSpecial(value: object): boolean {
  // FieldValue, Timestamp, GeoPoint, DocumentReference, Bytes, etc.
  const ctor = value.constructor?.name || ''
  if (
    ctor === 'FieldValue' ||
    ctor === 'Timestamp' ||
    ctor === 'GeoPoint' ||
    ctor === 'DocumentReference' ||
    ctor === 'Bytes' ||
    ctor === 'VectorValue' ||
    /FieldValue|Timestamp|GeoPoint|DocumentReference|Bytes|Vector/i.test(ctor)
  ) {
    return true
  }
  // Firebase v9+ FieldValue sentinel (serverTimestamp, deleteField, …)
  if ('_methodName' in value) return true
  return false
}

/**
 * Strip undefined from plain JSON-like values only.
 * NEVER pass objects that contain serverTimestamp()/deleteField() — use
 * buildCampaignStatusUpdate instead. Walking FieldValue corrupts sentinels and
 * can produce "Property array contains an invalid nested entity."
 */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined) return value
  if (value === null || typeof value !== 'object') return value
  if (isFirestoreSpecial(value)) return value
  if (Array.isArray(value)) {
    // Firestore forbids nested arrays — keep only scalars / plain maps.
    return value
      .filter((item) => item !== undefined && item !== null)
      .map((item) => {
        if (Array.isArray(item)) return String(item)
        if (item && typeof item === 'object' && isFirestoreSpecial(item)) {
          // FieldValue must never appear inside arrays
          return null
        }
        return stripUndefinedDeep(item)
      })
      .filter((item) => item !== null) as T
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue
    out[k] = stripUndefinedDeep(v)
  }
  return out as T
}

/**
 * Cloud status metadata only — never write output arrays / labels.
 * Arrays of maps (even "safe" ones) have caused nested-entity write failures.
 */
export function firestoreOutputSummary(outputs: unknown[]): {
  demoPack: true
  outputsLocal: true
  outputCount: number
} {
  return {
    demoPack: true,
    outputsLocal: true,
    outputCount: Array.isArray(outputs) ? outputs.length : 0,
  }
}

/** @deprecated Never write output object arrays to Firestore. */
export function firestoreSafeOutputs(
  _outputs: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  void _outputs
  return []
}

/** Scalars allowed on campaign status sync — no arrays of maps, no FieldValues. */
function pickSafeStatusExtra(extra: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(extra)) {
    if (
      key === 'outputs' ||
      key === 'outputLabels' ||
      key === 'selectedAssets' ||
      key === 'deliverables' ||
      key === 'imageUrls' ||
      key === 'imagePaths' ||
      key === 'features' ||
      key === 'createdAt' ||
      key === 'updatedAt'
    ) {
      continue
    }
    if (value === undefined) continue
    if (value === null) continue
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
      continue
    }
    // Ignore objects/arrays — status sync must stay scalar-only.
  }
  return out
}

export async function updateCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
  extra: Record<string, unknown> = {},
) {
  const safeExtra = pickSafeStatusExtra(extra)
  // Build payload without stripUndefinedDeep so serverTimestamp/deleteField stay valid.
  await updateDoc(doc(requireDb(), 'campaigns', campaignId), {
    status,
    progressStep: status,
    updatedAt: serverTimestamp(),
    // Remove any legacy corrupt outputs arrays from earlier buggy writes.
    outputs: deleteField(),
    outputLabels: deleteField(),
    ...safeExtra,
  })
}

/** Best-effort cleanup of legacy corrupt array fields on a campaign doc. */
export async function purgeCorruptCampaignOutputs(campaignId: string): Promise<void> {
  if (!campaignId || isLocalCampaignId(campaignId)) return
  try {
    await updateDoc(doc(requireDb(), 'campaigns', campaignId), {
      outputs: deleteField(),
      outputLabels: deleteField(),
      updatedAt: serverTimestamp(),
    })
  } catch (err) {
    console.warn('[campaigns] purge corrupt outputs skipped', err)
  }
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
        const imageUrl = await healProductImageUrl(id, data)
        map.set(id, {
          id,
          name: String(data.name ?? 'Product'),
          category: String(data.category ?? '').trim(),
          brand: String(data.brand ?? '').trim() || undefined,
          imageUrl,
          imagePath: firstImagePath(data.imagePaths),
        })
      } catch (err) {
        console.error('[campaigns] product load failed', id, err)
      }
    }),
  )

  return map
}
