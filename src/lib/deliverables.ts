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
    assets: ['video_table_talk', 'video_howto_demo', 'video_unboxing', 'video_ugc_selfie'],
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
    label: 'Promo / ad frame',
    description: 'Like a Meta ad: product on one side, blank space for “20% off” or Shop',
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

/**
 * Video Studio formats — HeyGen-quality demos for the same rose-gold perfume.
 * Your two uploaded clips power table talk + cinematic; others are matching AI format videos.
 */
export type VideoStyleId =
  | 'video_table_talk'
  | 'video_cinematic'
  | 'video_howto_demo'
  | 'video_unboxing'
  | 'video_ugc_selfie'
  | 'video_testimonial'
  | 'video_grwm'
  | 'video_asmr_spray'

const HERO_VIDEO = {
  talk: '/videos/formats/table-talk.mp4',
  cinematic: '/videos/formats/cinematic.mp4',
  howto: '/videos/formats/howto.mp4',
  unbox: '/videos/formats/unboxing.mp4',
  ugc: '/videos/formats/ugc.mp4',
  proof: '/videos/formats/testimonial.mp4',
  grwm: '/videos/formats/grwm.mp4',
  asmr: '/videos/formats/asmr.mp4',
} as const

export const VIDEO_STYLES: FormatOption<VideoStyleId>[] = [
  {
    id: 'video_table_talk',
    label: 'Table talk',
    description: 'Creator at a table talking about the perfume',
    thumb: '/images/video-poster-table-talk.jpg',
    tag: 'Talk',
    videoUrl: HERO_VIDEO.talk,
  },
  {
    id: 'video_cinematic',
    label: 'Cinematic',
    description: 'Premium product spot with mist and motion',
    thumb: '/images/video-poster-spin.jpg',
    tag: 'Hero',
    videoUrl: HERO_VIDEO.cinematic,
  },
  {
    id: 'video_howto_demo',
    label: 'How to use',
    description: 'Person spraying / applying the product',
    thumb: '/images/video-poster-howto.jpg',
    tag: 'How-to',
    videoUrl: HERO_VIDEO.howto,
  },
  {
    id: 'video_unboxing',
    label: 'Unboxing',
    description: 'Opening packaging and revealing the bottle',
    thumb: '/images/video-poster-unbox.jpg',
    tag: 'Unbox',
    videoUrl: HERO_VIDEO.unbox,
  },
  {
    id: 'video_ugc_selfie',
    label: 'UGC selfie',
    description: 'Creator-style clip of someone using it',
    thumb: '/images/video-poster-ugc.jpg',
    tag: 'UGC',
    videoUrl: HERO_VIDEO.ugc,
  },
  {
    id: 'video_testimonial',
    label: 'Testimonial',
    description: 'Holding the product while reviewing it',
    thumb: '/images/video-poster-testimonial.jpg',
    tag: 'Proof',
    videoUrl: HERO_VIDEO.proof,
  },
  {
    id: 'video_grwm',
    label: 'GRWM',
    description: 'Get-ready-with-me morning scent routine',
    thumb: '/images/video-poster-grwm.jpg',
    tag: 'GRWM',
    videoUrl: HERO_VIDEO.grwm,
  },
  {
    id: 'video_asmr_spray',
    label: 'Spray ASMR',
    description: 'Close-up nozzle press and mist detail',
    thumb: '/images/video-poster-asmr.jpg',
    tag: 'ASMR',
    videoUrl: HERO_VIDEO.asmr,
  },
]

export const DEFAULT_VIDEO_STYLES: VideoStyleId[] = [
  'video_table_talk',
  'video_cinematic',
  'video_howto_demo',
  'video_ugc_selfie',
]

export function resolveVideoStyles(selected: VideoStyleId[]): VideoStyleId[] {
  return selected.length === 0 ? [...DEFAULT_VIDEO_STYLES] : [...new Set(selected)]
}

export function videoUrlForAsset(assetType: string): string | undefined {
  const direct = VIDEO_STYLES.find((s) => s.id === assetType)?.videoUrl
  if (direct) return direct
  const mapped = LEGACY_VIDEO[assetType]
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
  reels_video: 'video_ugc_selfie',
  marketing_video: 'video_howto_demo',
  video_asmr_detail: 'video_asmr_spray',
  video_before_after: 'video_table_talk',
  video_street_stop: 'video_ugc_selfie',
  video_product_spin: 'video_cinematic',
  video_hook_caption: 'video_ugc_selfie',
  video_mirror_selfie: 'video_ugc_selfie',
  video_flatlay_reveal: 'video_unboxing',
  video_winner_cut: 'video_testimonial',
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
