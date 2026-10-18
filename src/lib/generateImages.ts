import { requireAuth } from './firebase'
import type { CreativeDirection } from './creativeDirection'
import type { PhotoStyleId } from './deliverables'
import { PHOTO_STYLES } from './deliverables'

export type ImageAssetKind = PhotoStyleId | 'ad_creative' | 'product_image' | 'lifestyle_image' | 'promo_creative'

export const IMAGE_ASSET_KINDS: ImageAssetKind[] = [
  ...PHOTO_STYLES.map((s) => s.id),
  'ad_creative',
  'product_image',
  'lifestyle_image',
  'promo_creative',
]

export function isImageAssetKind(value: string): value is ImageAssetKind {
  return (IMAGE_ASSET_KINDS as string[]).includes(value)
}

export type GenerateImagesRequest = {
  productName: string
  productImage?: string
  /** Style/mood reference photo (optional) */
  referenceImage?: string
  creativeDirection?: CreativeDirection
  assets: ImageAssetKind[]
  recreateNote?: string
}

export type GeneratedImageAsset = {
  type: ImageAssetKind
  label: string
  imageDataUrl: string
  promptUsed?: string
}

export type GenerateImagesResponse = {
  ok: true
  assets: GeneratedImageAsset[]
  partialErrors?: { type: ImageAssetKind; error: string }[]
}

/**
 * Authenticated POST to /api/generate-images (OpenRouter).
 * Throws with a helpful message on 4xx/5xx so callers can fall back to mock.
 */
export async function requestGenerateImages(
  input: GenerateImagesRequest,
): Promise<GenerateImagesResponse> {
  const user = requireAuth().currentUser
  if (!user) {
    throw new Error('Sign in required to generate images.')
  }

  const token = await user.getIdToken()
  const res = await fetch('/api/generate-images', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      productName: input.productName,
      productImage: input.productImage,
      referenceImage: input.referenceImage,
      creativeDirection: input.creativeDirection,
      assets: input.assets,
      recreateNote: input.recreateNote,
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    assets?: GeneratedImageAsset[]
    partialErrors?: { type: ImageAssetKind; error: string }[]
  }

  if (!res.ok || !data.ok || !Array.isArray(data.assets)) {
    if (res.status === 503) {
      throw new Error(
        data.error ||
          'Image AI is not configured. Using demo visuals instead.',
      )
    }
    throw new Error(data.error || `Image generation failed (${res.status})`)
  }

  return {
    ok: true,
    assets: data.assets,
    ...(data.partialErrors?.length ? { partialErrors: data.partialErrors } : {}),
  }
}
