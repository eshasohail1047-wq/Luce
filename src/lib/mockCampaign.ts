import type { AssetType, StudioKind } from './deliverables'
import { PHOTO_STYLES, VIDEO_STYLES, AD_STYLES } from './deliverables'

export type MockOutput = {
  id: string
  assetType: string
  label: string
  kind: 'image' | 'video' | 'copy'
  imageUrl?: string
  text?: string
  note?: string
  version?: number
}

const IMAGE_BY_ASSET: Record<string, string[]> = {
  product_image: [
    '/images/fidelity-studio.jpg',
    '/images/moisturizer-studio.jpg',
    '/images/fidelity-daylight.jpg',
  ],
  lifestyle_image: [
    '/images/campaign-home-lifestyle.jpg',
    '/images/campaign-beauty-flatlay.jpg',
    '/images/fidelity-evening.jpg',
  ],
  promo_creative: [
    '/images/campaign-beauty-flatlay.jpg',
    '/images/moisturizer-ad-hero.jpg',
    '/images/campaign-social-flatlay.jpg',
  ],
  ugc_video: [
    '/images/campaign-ugc-serum.jpg',
    '/images/ugc-makeup-lipstick.jpg',
    '/images/ugc-man-skincare.jpg',
  ],
  reels_video: [
    '/images/ugc-makeup-lipstick.jpg',
    '/images/ugc-makeup-blush.jpg',
    '/images/output-ugc.jpg',
  ],
  marketing_video: [
    '/images/campaign-ad-handbag.jpg',
    '/images/moisturizer-ad-product.jpg',
    '/images/moisturizer-ad-glow.jpg',
  ],
  ad_creative: [
    '/images/output-ads.jpg',
    '/images/moisturizer-ad-hero.jpg',
    '/images/campaign-ad-handbag.jpg',
  ],
  ad_copy: ['/images/output-social.jpg', '/images/campaign-social-flatlay.jpg'],
  caption: ['/images/output-social.jpg', '/images/campaign-social-flatlay.jpg'],
  hook: ['/images/output-ugc.jpg', '/images/campaign-ugc-serum.jpg'],
  cta: ['/images/moisturizer-ad-hero.jpg', '/images/output-ads.jpg'],
  hashtags: ['/images/campaign-social-flatlay.jpg', '/images/output-social.jpg'],
}

function labelFor(assetType: string) {
  return (
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
  return assetType.includes('video')
}

function pickImage(
  assetType: string,
  version: number,
  productImageUrl?: string,
): string | undefined {
  const pool = [...(IMAGE_BY_ASSET[assetType] || ['/images/output-visuals.jpg'])]
  // Always prefer the user's product photo as the first option for product shots,
  // and include it in the recreate cycle for every visual/video asset.
  if (productImageUrl) {
    if (assetType === 'product_image' || assetType === 'ad_creative') {
      return version <= 1
        ? productImageUrl
        : pool[(version - 2) % pool.length] || productImageUrl
    }
    // For other styles: v1 uses scene stock, recreate can land on product photo
    const withProduct = [...pool, productImageUrl]
    return withProduct[(version - 1) % withProduct.length]
  }
  return pool[(version - 1) % pool.length]
}

function buildOne(
  assetType: string,
  index: number,
  productName: string,
  productImageUrl: string | undefined,
  version: number,
): MockOutput {
  const label = labelFor(assetType)
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

  return {
    id,
    assetType,
    label,
    kind: isVideoAsset(assetType) ? 'video' : 'image',
    imageUrl,
    note: usingProduct
      ? version > 1
        ? `Recreated with your product photo · v${version}`
        : 'Uses your uploaded product photo'
      : isVideoAsset(assetType)
        ? version > 1
          ? `Recreated video still · v${version}`
          : 'Demo video still — recreate for another look'
        : version > 1
          ? `Recreated visual · v${version}`
          : 'Demo visual — recreate if you want another option',
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
}): MockOutput[] {
  let assets = input.selectedAssets.filter(Boolean)

  if (assets.length === 0) {
    if (input.studioKind === 'photos') {
      assets = ['product_image', 'lifestyle_image', 'promo_creative']
    } else if (input.studioKind === 'videos') {
      assets = ['ugc_video', 'reels_video', 'marketing_video']
    } else if (input.studioKind === 'ads') {
      assets = ['ad_creative', 'ad_copy']
    } else {
      assets = [
        'product_image',
        'lifestyle_image',
        'promo_creative',
        'ugc_video',
        'caption',
        'hook',
        'ad_creative',
        'ad_copy',
      ]
    }
  }

  return assets.map((assetType, index) =>
    buildOne(assetType, index, input.productName, input.productImageUrl, 1),
  )
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

function safeProductSlug(productName: string) {
  return productName.replace(/[^\w\-]+/g, '_').slice(0, 40) || 'luce-pack'
}

function itemBaseName(item: MockOutput, productName: string) {
  const safe = safeProductSlug(productName)
  return `${safe}-${item.assetType}-v${item.version || 1}`
}

function triggerBrowserDownload(blobOrUrl: Blob | string, filename: string) {
  const created = typeof blobOrUrl !== 'string'
  const url = created ? URL.createObjectURL(blobOrUrl) : blobOrUrl
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  if (created) {
    // Defer revoke so the browser can start the download
    setTimeout(() => URL.revokeObjectURL(url), 1500)
  }
}

function extFromMime(mime: string, fallback = 'jpg') {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg'
  if (mime.includes('gif')) return 'gif'
  return fallback
}

/** Resolve image/video still to a Blob — works for data: URLs and same-origin /images/... */
async function resolveAssetBlob(url: string): Promise<{ blob: Blob; ext: string }> {
  if (url.startsWith('data:')) {
    const match = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(url)
    if (!match) throw new Error('Invalid data URL')
    const mime = match[1] || 'image/png'
    const isBase64 = Boolean(match[2])
    const data = match[3] || ''
    let blob: Blob
    if (isBase64) {
      const binary = atob(data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      blob = new Blob([bytes], { type: mime })
    } else {
      blob = new Blob([decodeURIComponent(data)], { type: mime })
    }
    return { blob, ext: extFromMime(mime, 'png') }
  }

  // Absolute same-origin path or relative /images/...
  const resolved =
    url.startsWith('/') || url.startsWith('./')
      ? new URL(url, window.location.origin).href
      : url

  const res = await fetch(resolved)
  if (!res.ok) throw new Error(`Failed to fetch asset (${res.status})`)
  const blob = await res.blob()
  const mime = blob.type || res.headers.get('content-type') || 'image/jpeg'
  return { blob, ext: extFromMime(mime) }
}

/** Download a single result asset (image/video still → file; copy → .txt). */
export async function downloadMockOutput(item: MockOutput, productName: string) {
  const base = itemBaseName(item, productName)

  if (item.kind === 'copy' && item.text) {
    const blob = new Blob([item.text], { type: 'text/plain;charset=utf-8' })
    triggerBrowserDownload(blob, `${base}.txt`)
    return
  }

  if (!item.imageUrl) throw new Error('No file available for this asset')
  const { blob, ext } = await resolveAssetBlob(item.imageUrl)
  triggerBrowserDownload(blob, `${base}.${ext}`)
}

/** Download the full pack as a single ZIP (avoids multi-download browser blocks). */
export async function downloadMockPack(
  outputs: MockOutput[],
  productName: string,
) {
  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const safe = safeProductSlug(productName)
  const copyParts: string[] = [`LUCE demo export — ${productName}`, '']
  let added = 0

  for (const item of outputs) {
    if (item.kind === 'copy' && item.text) {
      const base = itemBaseName(item, productName)
      zip.file(`${base}.txt`, item.text)
      copyParts.push(`## ${item.label}`, item.text, '')
      added += 1
      continue
    }
    if (!item.imageUrl) continue
    try {
      const { blob, ext } = await resolveAssetBlob(item.imageUrl)
      zip.file(`${itemBaseName(item, productName)}.${ext}`, blob)
      added += 1
    } catch (err) {
      console.warn('Skipping asset in pack export:', item.id, err)
    }
  }

  if (copyParts.length > 2) {
    zip.file(`${safe}-copy.txt`, copyParts.join('\n'))
  }

  if (added === 0 && copyParts.length <= 2) {
    throw new Error('Nothing to export')
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  triggerBrowserDownload(zipBlob, `${safe}-pack.zip`)
}

export type { AssetType }
