import { requireIdToken } from './firebase'
import type { CreativeDirection } from './creativeDirection'

export type CopyAssetKind =
  | 'caption'
  | 'hook'
  | 'cta'
  | 'hashtags'
  | 'ad_copy'

export const COPY_ASSET_KINDS: CopyAssetKind[] = [
  'caption',
  'hook',
  'cta',
  'hashtags',
  'ad_copy',
]

export function isCopyAssetKind(value: string): value is CopyAssetKind {
  return (COPY_ASSET_KINDS as string[]).includes(value)
}

export type GenerateCopyRequest = {
  productName: string
  brand?: string
  description?: string
  category?: string
  creativeDirection?: CreativeDirection
  assets: CopyAssetKind[]
  recreateNote?: string
}

export type GeneratedCopyAsset = {
  type: CopyAssetKind
  label: string
  text: string
  promptUsed?: string
  model?: string
}

export type GenerateCopyResponse = {
  ok: true
  assets: GeneratedCopyAsset[]
  partialErrors?: { type: CopyAssetKind; error: string }[]
}

/**
 * Authenticated POST to /api/generate-copy (OpenRouter chat — LUCE Copy Agent).
 * Throws on failure so callers can keep mock template text as fallback.
 */
export async function requestGenerateCopy(
  input: GenerateCopyRequest,
): Promise<GenerateCopyResponse> {
  const token = await requireIdToken()

  const res = await fetch('/api/generate-copy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      productName: input.productName,
      brand: input.brand,
      description: input.description,
      category: input.category,
      creativeDirection: input.creativeDirection,
      assets: input.assets,
      recreateNote: input.recreateNote,
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    error?: string
    assets?: GeneratedCopyAsset[]
    partialErrors?: { type: CopyAssetKind; error: string }[]
  }

  if (!res.ok || !data.ok || !Array.isArray(data.assets)) {
    if (res.status === 503) {
      throw new Error(
        data.error ||
          'Copy AI is not configured. Using demo captions instead.',
      )
    }
    throw new Error(data.error || `Copy generation failed (${res.status})`)
  }

  return {
    ok: true,
    assets: data.assets,
    ...(data.partialErrors?.length ? { partialErrors: data.partialErrors } : {}),
  }
}
