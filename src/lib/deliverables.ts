/** Campaign pack options shown as checkboxes. Empty selection = full default pack. */

export type DeliverableId = 'visuals' | 'videos' | 'social' | 'ads' | 'strategy'

export type AssetType =
  | 'product_image'
  | 'lifestyle_image'
  | 'promo_creative'
  | 'ugc_video'
  | 'reels_video'
  | 'marketing_video'
  | 'caption'
  | 'hook'
  | 'cta'
  | 'hashtags'
  | 'ad_creative'
  | 'ad_copy'

export type DeliverableOption = {
  id: DeliverableId
  label: string
  description: string
  assets: AssetType[]
}

export const CAMPAIGN_DELIVERABLES: DeliverableOption[] = [
  {
    id: 'visuals',
    label: 'Product visuals',
    description: 'Professional product, lifestyle, and promo images',
    assets: ['product_image', 'lifestyle_image', 'promo_creative'],
  },
  {
    id: 'videos',
    label: 'Videos',
    description: 'UGC-style shorts, Reels, and product video',
    assets: ['ugc_video', 'reels_video', 'marketing_video'],
  },
  {
    id: 'social',
    label: 'Social content',
    description: 'Captions, hooks, CTAs, and hashtags',
    assets: ['caption', 'hook', 'cta', 'hashtags'],
  },
  {
    id: 'ads',
    label: 'Advertising',
    description: 'Ad creatives and ad copy',
    assets: ['ad_creative', 'ad_copy'],
  },
  {
    id: 'strategy',
    label: 'Strategy & research',
    description: 'Audience, positioning, and creative direction',
    assets: [],
  },
]

export const DEFAULT_DELIVERABLE_IDS: DeliverableId[] = CAMPAIGN_DELIVERABLES.map((d) => d.id)

export const DEFAULT_SELECTED_ASSETS: AssetType[] = CAMPAIGN_DELIVERABLES.flatMap((d) => d.assets)

export function resolveDeliverables(selected: DeliverableId[]): {
  deliverables: DeliverableId[]
  selectedAssets: AssetType[]
  includeStrategy: boolean
} {
  const deliverables =
    selected.length === 0 ? [...DEFAULT_DELIVERABLE_IDS] : [...new Set(selected)]
  const selectedAssets = CAMPAIGN_DELIVERABLES.filter((d) => deliverables.includes(d.id)).flatMap(
    (d) => d.assets,
  )
  return {
    deliverables,
    selectedAssets:
      selectedAssets.length > 0 ? selectedAssets : [...DEFAULT_SELECTED_ASSETS],
    includeStrategy: deliverables.includes('strategy'),
  }
}

/** Studio: professional photos only */
export type PhotoStyleId = 'product_image' | 'lifestyle_image' | 'promo_creative'

export const PHOTO_STYLES: { id: PhotoStyleId; label: string; description: string }[] = [
  {
    id: 'product_image',
    label: 'Professional product shot',
    description: 'Clean studio lighting that keeps packaging true',
  },
  {
    id: 'lifestyle_image',
    label: 'Lifestyle scene',
    description: 'In-context imagery for social and site',
  },
  {
    id: 'promo_creative',
    label: 'Promotional creative',
    description: 'Campaign-ready visual with space for offer',
  },
]

export const DEFAULT_PHOTO_STYLES: PhotoStyleId[] = PHOTO_STYLES.map((s) => s.id)

export function resolvePhotoStyles(selected: PhotoStyleId[]): PhotoStyleId[] {
  return selected.length === 0 ? [...DEFAULT_PHOTO_STYLES] : [...new Set(selected)]
}

/** Studio: videos */
export type VideoStyleId = 'ugc_video' | 'reels_video' | 'marketing_video'

export const VIDEO_STYLES: { id: VideoStyleId; label: string; description: string }[] = [
  {
    id: 'ugc_video',
    label: 'UGC-style short',
    description: 'Creator-feel clip for social proof',
  },
  {
    id: 'reels_video',
    label: 'Reels / short-form',
    description: 'Vertical cut for Instagram and TikTok',
  },
  {
    id: 'marketing_video',
    label: 'Product marketing video',
    description: 'Polished product-led spot',
  },
]

export const DEFAULT_VIDEO_STYLES: VideoStyleId[] = VIDEO_STYLES.map((s) => s.id)

export function resolveVideoStyles(selected: VideoStyleId[]): VideoStyleId[] {
  return selected.length === 0 ? [...DEFAULT_VIDEO_STYLES] : [...new Set(selected)]
}

/** Studio: ads */
export type AdStyleId = 'ad_creative' | 'ad_copy'

export const AD_STYLES: { id: AdStyleId; label: string; description: string }[] = [
  {
    id: 'ad_creative',
    label: 'Ad creative',
    description: 'Visuals sized for paid placements',
  },
  {
    id: 'ad_copy',
    label: 'Ad copy',
    description: 'Headlines, primary text, and CTAs',
  },
]

export const DEFAULT_AD_STYLES: AdStyleId[] = AD_STYLES.map((s) => s.id)

export function resolveAdStyles(selected: AdStyleId[]): AdStyleId[] {
  return selected.length === 0 ? [...DEFAULT_AD_STYLES] : [...new Set(selected)]
}

export type StudioKind = 'photos' | 'videos' | 'ads'

export function studioTitle(kind: StudioKind) {
  if (kind === 'photos') return 'Professional photos'
  if (kind === 'videos') return 'Videos'
  return 'Ads'
}
