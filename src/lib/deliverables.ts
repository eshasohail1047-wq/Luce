/** Campaign pack options + Fastlane-style studio format galleries. */

export type DeliverableId = 'visuals' | 'videos' | 'social' | 'ads' | 'strategy'

export type AssetType =
  | PhotoStyleId
  | VideoStyleId
  | 'caption'
  | 'hook'
  | 'cta'
  | 'hashtags'
  | 'ad_creative'
  | 'ad_copy'
  /** Legacy IDs kept so older campaigns still resolve labels */
  | 'product_image'
  | 'lifestyle_image'
  | 'promo_creative'
  | 'ugc_video'
  | 'reels_video'
  | 'marketing_video'

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
    description: 'Studio, lifestyle, and promo formats',
    assets: ['photo_studio_packshot', 'photo_hand_model', 'photo_promo_offer'],
  },
  {
    id: 'videos',
    label: 'Videos',
    description: 'Talking-head, UGC, demo, and product clips',
    assets: ['video_table_talk', 'video_howto_demo', 'video_product_spin'],
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

export type FormatOption<T extends string> = {
  id: T
  label: string
  description: string
  /** Preview thumbnail for the format gallery */
  thumb: string
  /** Short overlay tag on the card */
  tag?: string
  /** Playable demo / format sample (videos) */
  videoUrl?: string
}

/** Studio: distinct photo formats only (no repeated looks). */
export type PhotoStyleId =
  | 'photo_studio_packshot'
  | 'photo_window_daylight'
  | 'photo_moody_editorial'
  | 'photo_hand_model'
  | 'photo_flatlay'
  | 'photo_promo_offer'

/**
 * Demo thumbs use ONE hero SKU (pink perfume) — each card is a real different scene.
 */
const HERO_PRODUCT = {
  studio: '/images/fidelity-studio.jpg',
  daylight: '/images/fidelity-daylight.jpg',
  evening: '/images/fidelity-evening.jpg',
  hand: '/images/format-perfume-in-hand.jpg',
  flatlay: '/images/format-perfume-flatlay.jpg',
  promo: '/images/format-perfume-promo.jpg',
} as const

export const PHOTO_STYLES: FormatOption<PhotoStyleId>[] = [
  {
    id: 'photo_studio_packshot',
    label: 'Studio packshot',
    description: 'Clean hero on seamless backdrop',
    thumb: HERO_PRODUCT.studio,
    tag: 'Studio',
  },
  {
    id: 'photo_window_daylight',
    label: 'Window light',
    description: 'Soft daylight by a window',
    thumb: HERO_PRODUCT.daylight,
    tag: 'Daylight',
  },
  {
    id: 'photo_moody_editorial',
    label: 'Moody editorial',
    description: 'Dark, dramatic brand still',
    thumb: HERO_PRODUCT.evening,
    tag: 'Editorial',
  },
  {
    id: 'photo_hand_model',
    label: 'In hand',
    description: 'Product held naturally in hand',
    thumb: HERO_PRODUCT.hand,
    tag: 'Hand',
  },
  {
    id: 'photo_flatlay',
    label: 'Flatlay',
    description: 'Overhead styled surface',
    thumb: HERO_PRODUCT.flatlay,
    tag: 'Flatlay',
  },
  {
    id: 'photo_promo_offer',
    label: 'Promo offer',
    description: 'Ad-ready frame with room for a price, badge, or Shop CTA',
    thumb: HERO_PRODUCT.promo,
    tag: 'Promo',
  },
]

/** When nothing is checked, generate this starter set. */
export const DEFAULT_PHOTO_STYLES: PhotoStyleId[] = [
  'photo_studio_packshot',
  'photo_hand_model',
  'photo_window_daylight',
]

export function resolvePhotoStyles(selected: PhotoStyleId[]): PhotoStyleId[] {
  return selected.length === 0 ? [...DEFAULT_PHOTO_STYLES] : [...new Set(selected)]
}

/** Studio: ~10 video formats */
export type VideoStyleId =
  | 'video_table_talk'
  | 'video_ugc_selfie'
  | 'video_unboxing'
  | 'video_howto_demo'
  | 'video_grwm'
  | 'video_product_spin'
  | 'video_testimonial'
  | 'video_asmr_detail'
  | 'video_before_after'
  | 'video_street_stop'

/** Same hero perfume SKU for every video format sample (perfume-1…5). */
const HERO_VIDEO = {
  a: '/videos/perfume-1.mp4',
  b: '/videos/perfume-2.mp4',
  c: '/videos/perfume-3.mp4',
  d: '/videos/perfume-4.mp4',
  e: '/videos/perfume-5.mp4',
} as const

export const VIDEO_STYLES: FormatOption<VideoStyleId>[] = [
  {
    id: 'video_table_talk',
    label: 'Table talk',
    description: 'Creator at a table reviewing this bottle',
    thumb: HERO_PRODUCT.daylight,
    tag: 'Talk',
    videoUrl: HERO_VIDEO.a,
  },
  {
    id: 'video_howto_demo',
    label: 'How to use',
    description: 'Spray / pulse-point demo with this bottle',
    thumb: HERO_PRODUCT.studio,
    tag: 'How-to',
    videoUrl: HERO_VIDEO.b,
  },
  {
    id: 'video_ugc_selfie',
    label: 'UGC selfie',
    description: 'Handheld vertical clip featuring the bottle',
    thumb: HERO_PRODUCT.evening,
    tag: 'UGC',
    videoUrl: HERO_VIDEO.c,
  },
  {
    id: 'video_unboxing',
    label: 'Unboxing',
    description: 'First reveal of the same bottle',
    thumb: HERO_PRODUCT.studio,
    tag: 'Unbox',
    videoUrl: HERO_VIDEO.d,
  },
  {
    id: 'video_product_spin',
    label: 'Product spin',
    description: 'Slow hero turn of the bottle',
    thumb: HERO_PRODUCT.daylight,
    tag: '360°',
    videoUrl: HERO_VIDEO.e,
  },
  {
    id: 'video_grwm',
    label: 'Vanity ritual',
    description: 'Getting-ready moment with this scent',
    thumb: HERO_PRODUCT.evening,
    tag: 'Ritual',
    videoUrl: HERO_VIDEO.a,
  },
  {
    id: 'video_testimonial',
    label: 'Testimonial',
    description: 'Talking-head review holding the bottle',
    thumb: HERO_PRODUCT.daylight,
    tag: 'Proof',
    videoUrl: HERO_VIDEO.c,
  },
  {
    id: 'video_asmr_detail',
    label: 'ASMR detail',
    description: 'Close-up glass, cap, and mist',
    thumb: HERO_PRODUCT.studio,
    tag: 'ASMR',
    videoUrl: HERO_VIDEO.b,
  },
  {
    id: 'video_before_after',
    label: 'Day to night',
    description: 'Same bottle across day → evening energy',
    thumb: HERO_PRODUCT.evening,
    tag: 'Day/Night',
    videoUrl: HERO_VIDEO.d,
  },
  {
    id: 'video_street_stop',
    label: 'On the go',
    description: 'Pocket / bag moment with this bottle',
    thumb: HERO_PRODUCT.daylight,
    tag: 'Go',
    videoUrl: HERO_VIDEO.e,
  },
]

export const DEFAULT_VIDEO_STYLES: VideoStyleId[] = [
  'video_table_talk',
  'video_howto_demo',
  'video_product_spin',
]

export function resolveVideoStyles(selected: VideoStyleId[]): VideoStyleId[] {
  return selected.length === 0 ? [...DEFAULT_VIDEO_STYLES] : [...new Set(selected)]
}

export function videoUrlForAsset(assetType: string): string | undefined {
  const direct = VIDEO_STYLES.find((s) => s.id === assetType)?.videoUrl
  if (direct) return direct
  const legacy: Record<string, VideoStyleId> = {
    ugc_video: 'video_ugc_selfie',
    reels_video: 'video_grwm',
    marketing_video: 'video_product_spin',
  }
  const mapped = legacy[assetType]
  return mapped ? VIDEO_STYLES.find((s) => s.id === mapped)?.videoUrl : undefined
}

/** Build campaign selectedAssets from explicit format picks (not deliverable guesswork). */
export function resolveCampaignFromFormats(input: {
  photoStyles: PhotoStyleId[]
  videoStyles: VideoStyleId[]
  includeSocial?: boolean
  includeAds?: boolean
  includeStrategy?: boolean
}): {
  deliverables: DeliverableId[]
  selectedAssets: AssetType[]
  includeStrategy: boolean
} {
  const photos =
    input.photoStyles.length > 0
      ? [...new Set(input.photoStyles)]
      : [...DEFAULT_PHOTO_STYLES]
  const videos =
    input.videoStyles.length > 0
      ? [...new Set(input.videoStyles)]
      : [...DEFAULT_VIDEO_STYLES]

  const selectedAssets: AssetType[] = [...photos, ...videos]
  const deliverables: DeliverableId[] = []
  if (photos.length) deliverables.push('visuals')
  if (videos.length) deliverables.push('videos')

  if (input.includeSocial !== false) {
    deliverables.push('social')
    selectedAssets.push('caption', 'hook', 'cta', 'hashtags')
  }
  if (input.includeAds) {
    deliverables.push('ads')
    selectedAssets.push('ad_creative', 'ad_copy')
  }
  if (input.includeStrategy) {
    deliverables.push('strategy')
  }

  return {
    deliverables,
    selectedAssets,
    includeStrategy: Boolean(input.includeStrategy),
  }
}

/** Studio: ads */
export type AdStyleId = 'ad_creative' | 'ad_copy'

export const AD_STYLES: FormatOption<AdStyleId>[] = [
  {
    id: 'ad_creative',
    label: 'Ad creative',
    description: 'Visuals sized for paid placements',
    thumb: '/images/output-ads.jpg',
    tag: 'Visual',
  },
  {
    id: 'ad_copy',
    label: 'Ad copy',
    description: 'Headlines, primary text, and CTAs',
    thumb: '/images/output-social.jpg',
    tag: 'Copy',
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

/** Map legacy asset IDs from older campaigns onto current format catalogs. */
const LEGACY_PHOTO: Record<string, PhotoStyleId> = {
  product_image: 'photo_studio_packshot',
  lifestyle_image: 'photo_window_daylight',
  promo_creative: 'photo_promo_offer',
  photo_lifestyle_home: 'photo_window_daylight',
  photo_shelf_context: 'photo_moody_editorial',
  photo_detail_macro: 'photo_studio_packshot',
  photo_social_feed: 'photo_flatlay',
}

const LEGACY_VIDEO: Record<string, VideoStyleId> = {
  ugc_video: 'video_ugc_selfie',
  reels_video: 'video_grwm',
  marketing_video: 'video_product_spin',
}

export function normalizePhotoStyleId(id: string): PhotoStyleId | null {
  if (PHOTO_STYLES.some((s) => s.id === id)) return id as PhotoStyleId
  return LEGACY_PHOTO[id] ?? null
}

export function normalizeVideoStyleId(id: string): VideoStyleId | null {
  if (VIDEO_STYLES.some((s) => s.id === id)) return id as VideoStyleId
  return LEGACY_VIDEO[id] ?? null
}

export function formatLabel(assetType: string): string | undefined {
  const photo = PHOTO_STYLES.find((s) => s.id === assetType)
  if (photo) return photo.label
  const video = VIDEO_STYLES.find((s) => s.id === assetType)
  if (video) return video.label
  const ad = AD_STYLES.find((s) => s.id === assetType)
  if (ad) return ad.label
  const legacyPhoto = LEGACY_PHOTO[assetType]
  if (legacyPhoto) return PHOTO_STYLES.find((s) => s.id === legacyPhoto)?.label
  const legacyVideo = LEGACY_VIDEO[assetType]
  if (legacyVideo) return VIDEO_STYLES.find((s) => s.id === legacyVideo)?.label
  return undefined
}
