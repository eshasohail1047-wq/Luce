import type { StudioKind } from './deliverables'
import {
  AD_STYLES,
  DEFAULT_PHOTO_STYLES,
  DEFAULT_VIDEO_STYLES,
  formatLabel,
  PHOTO_STYLES,
  VIDEO_STYLES,
  videoUrlForAsset,
} from './deliverables'

export type MockOutput = {
  id: string
  assetType: string
  label: string
  kind: 'image' | 'video' | 'copy'
  imageUrl?: string
  /** Playable MP4 for video formats */
  videoUrl?: string
  /** Requested clip length in seconds (Video Studio) */
  durationSeconds?: number
  text?: string
  note?: string
  version?: number
}

function labelFor(assetType: string) {
  return (
    formatLabel(assetType) ||
    PHOTO_STYLES.find((s) => s.id === assetType)?.label ||
    VIDEO_STYLES.find((s) => s.id === assetType)?.label ||
    AD_STYLES.find((s) => s.id === assetType)?.label ||
    assetType.replaceAll('_', ' ')
  )
}

function copyFor(assetType: string, productName: string, version = 1): string {
  const variants: Record<string, string[]> = {
    caption: [
      `Meet ${productName} — made for everyday rituals that still feel elevated. Soft light. True packaging. Ready for your grid.`,
      `${productName} looks like this in real life — clean, true-to-packaging, ready to post.`,
      `Your shelf, elevated. ${productName} in natural light with packaging locked.`,
    ],
    hook: [
      `The ${productName} glow everyone keeps asking about…`,
      `POV: you finally found ${productName} that photographs true.`,
      `Stop scrolling — this is ${productName} done right.`,
    ],
    cta: [
      `Shop ${productName} → link in bio`,
      `Get ${productName} today — limited offer`,
      `Tap to shop ${productName}`,
    ],
    hashtags: [
      `#${productName.replace(/\s+/g, '')} #DTC #ProductPhotography #UGC #Shopify`,
      `#${productName.replace(/\s+/g, '')} #Ecommerce #BrandVisuals #SocialAds`,
      `#${productName.replace(/\s+/g, '')} #CreatorContent #ProductShoot #Ads`,
    ],
    ad_copy: [
      `${productName}: packaging-true creatives that convert. Studio · lifestyle · social — one consistent look.`,
      `Launch ${productName} with fidelity-first ads. Same bottle. Stronger scroll-stop.`,
      `${productName} creatives built for Meta & TikTok — product authenticity first.`,
    ],
  }
  const list = variants[assetType]
  if (!list) return ''
  return list[(Math.max(version, 1) - 1) % list.length]!
}

function isCopyAsset(assetType: string) {
  return ['caption', 'hook', 'cta', 'hashtags', 'ad_copy'].includes(assetType)
}

function isVideoAsset(assetType: string) {
  return assetType.startsWith('video_') || assetType.includes('video')
}

function pickImage(
  assetType: string,
  version: number,
  productImageUrl?: string,
): string | undefined {
  // Never swap the user's product for stock demo perfume / lifestyle stills.
  // Demo packs show the uploaded product until real AI replaces the frame.
  if (productImageUrl && !productImageUrl.startsWith('/images/')) {
    return productImageUrl
  }
  // No real product photo → leave empty (UI shows missing state). Never invent a jar.
  void assetType
  void version
  return undefined
}

function buildOne(
  assetType: string,
  index: number,
  productName: string,
  productImageUrl: string | undefined,
  version: number,
  durationSeconds?: number,
): MockOutput {
  const baseLabel = labelFor(assetType)
  const label = version > 1 ? `${baseLabel} · ${version}` : baseLabel
  const id = `${assetType}-${index}-v${version}`

  if (isCopyAsset(assetType)) {
    return {
      id,
      assetType,
      label,
      kind: 'copy',
      text: copyFor(assetType, productName, version),
      imageUrl: productImageUrl || pickImage(assetType, version),
      note: version > 1 ? `Recreated copy · v${version}` : 'Demo copy — recreate anytime',
      version,
    }
  }

  const imageUrl = pickImage(assetType, version, productImageUrl)
  const usingProduct = Boolean(productImageUrl && imageUrl === productImageUrl)
  const video = isVideoAsset(assetType)
  // With a product photo: never attach stock demo MP4s (wrong product).
  // AI generate fills videoUrl; until then show the product still as the poster.
  const videoUrl =
    video && !productImageUrl ? videoUrlForAsset(assetType) : undefined
  const secs = video && durationSeconds ? durationSeconds : undefined

  return {
    id,
    assetType,
    label: secs ? `${label} · ${secs}s` : label,
    kind: video ? 'video' : 'image',
    imageUrl,
    ...(videoUrl ? { videoUrl } : {}),
    ...(secs ? { durationSeconds: secs } : {}),
    note: video
      ? productImageUrl
        ? version > 1
          ? `Your product · ${secs || 5}s · waiting for AI · v${version}`
          : `Your product · ${secs || 5}s — AI will build this format`
        : version > 1
          ? `Demo format clip · v${version}`
          : 'Demo format clip'
      : usingProduct
        ? version > 1
          ? `Recreated with your product photo · v${version}`
          : 'Uses your uploaded product photo'
        : version > 1
          ? `Recreated visual · v${version}`
          : 'Format still — recreate if you want another option',
    version,
  }
}

/** Build preview assets for the results UI (no AI — demo pack). */
export function buildMockOutputs(input: {
  productName: string
  productImageUrl?: string
  selectedAssets: string[]
  studioKind?: StudioKind
  mode?: 'campaign' | 'studio'
  /** Per-format seconds for Video Studio */
  videoDurations?: Partial<Record<string, number>>
}): MockOutput[] {
  let assets = input.selectedAssets.filter(Boolean)

  if (assets.length === 0) {
    if (input.studioKind === 'photos') {
      assets = [...DEFAULT_PHOTO_STYLES]
    } else if (input.studioKind === 'videos') {
      assets = [...DEFAULT_VIDEO_STYLES]
    } else if (input.studioKind === 'ads') {
      assets = ['ad_creative', 'ad_copy']
    } else {
      assets = [
        'photo_studio_packshot',
        'photo_hand_model',
        'photo_flatlay',
        'video_table_talk',
        'caption',
        'hook',
        'ad_creative',
        'ad_copy',
      ]
    }
  }

  const occurrence: Record<string, number> = {}
  return assets.map((assetType, index) => {
    occurrence[assetType] = (occurrence[assetType] || 0) + 1
    const dur = input.videoDurations?.[assetType]
    return buildOne(
      assetType,
      index,
      input.productName,
      input.productImageUrl,
      occurrence[assetType],
      typeof dur === 'number' ? dur : undefined,
    )
  })
}

/** Recreate a single asset with the next variant (still demo / no API). */
export function recreateMockOutput(
  item: MockOutput,
  index: number,
  productName: string,
  productImageUrl?: string,
): MockOutput {
  const nextVersion = (item.version || 1) + 1
  return buildOne(item.assetType, index, productName, productImageUrl, nextVersion)
}

export async function downloadMockOutput(item: MockOutput, productName: string) {
  const safe = (productName || 'luce').replace(/[^\w.-]+/g, '_').slice(0, 40)
  if (item.kind === 'copy' && item.text) {
    const blob = new Blob([item.text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${safe}-${item.assetType}.txt`
    a.click()
    URL.revokeObjectURL(url)
    return
  }
  const mediaUrl = item.kind === 'video' && item.videoUrl ? item.videoUrl : item.imageUrl
  if (!mediaUrl) throw new Error('Nothing to download')
  const res = await fetch(mediaUrl)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const ext = blob.type.includes('mp4')
    ? 'mp4'
    : blob.type.includes('webm')
      ? 'webm'
      : blob.type.includes('png')
        ? 'png'
        : 'jpg'
  a.download = `${safe}-${item.assetType}.${ext}`
  a.click()
  URL.revokeObjectURL(url)
}

export async function downloadMockPack(
  outputs: MockOutput[],
  productName: string,
): Promise<void> {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const safe = (productName || 'luce').replace(/[^\w.-]+/g, '_').slice(0, 40)
  const folder = zip.folder(`${safe}-pack`) || zip

  await Promise.all(
    outputs.map(async (item, i) => {
      const base = `${String(i + 1).padStart(2, '0')}-${item.assetType}`
      if (item.kind === 'copy' && item.text) {
        folder.file(`${base}.txt`, item.text)
        return
      }
      const mediaUrl =
        item.kind === 'video' && item.videoUrl ? item.videoUrl : item.imageUrl
      if (!mediaUrl) return
      try {
        const res = await fetch(mediaUrl)
        const blob = await res.blob()
        const ext = blob.type.includes('mp4')
          ? 'mp4'
          : blob.type.includes('webm')
            ? 'webm'
            : blob.type.includes('png')
              ? 'png'
              : 'jpg'
        folder.file(`${base}.${ext}`, blob)
      } catch {
        /* skip failed fetch */
      }
    }),
  )

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  const url = URL.createObjectURL(zipBlob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safe}-luce-pack.zip`
  a.click()
  URL.revokeObjectURL(url)
}
