/**
 * LUCE AI provider routing status.
 *
 * Images: OpenRouter Nano Banana / Gemini 2.5 Flash Image (~$0.03–0.04)
 * Videos: HeyGen direct → OpenRouter (heygen/heygen-video-1)
 */

import { getHeyGenApiKey } from './heygen.js'
import { getMuseApiKey, getMuseImageModel } from './muse.js'
import {
  getOpenRouterApiKey,
  getOpenRouterImageModel,
  getOpenRouterVideoModel,
} from './openRouter.js'

export type AiProviderStatus = {
  images: {
    primary: 'openrouter' | 'muse-direct' | 'none'
    museConfigured: boolean
    openRouterConfigured: boolean
    imageModel: string
  }
  videos: {
    primary: 'heygen' | 'openrouter' | 'none'
    heygenConfigured: boolean
    openRouterConfigured: boolean
    openRouterModel: string
  }
  summary: string
}

export function getAiProviderStatus(): AiProviderStatus {
  const museConfigured = Boolean(getMuseApiKey())
  const heygenConfigured = Boolean(getHeyGenApiKey())
  const openRouterConfigured = Boolean(getOpenRouterApiKey())

  const imagesPrimary: AiProviderStatus['images']['primary'] =
    openRouterConfigured
      ? 'openrouter'
      : museConfigured
        ? 'muse-direct'
        : 'none'

  const videosPrimary: AiProviderStatus['videos']['primary'] = heygenConfigured
    ? 'heygen'
    : openRouterConfigured
      ? 'openrouter'
      : 'none'

  const imageModel = openRouterConfigured
    ? getOpenRouterImageModel()
    : getMuseImageModel()

  const bits: string[] = []
  if (imagesPrimary === 'openrouter') {
    bits.push(`Images: ${imageModel} via OpenRouter ~$0.03–0.04/image`)
  } else if (imagesPrimary === 'muse-direct') {
    bits.push(`Images: Meta Muse direct (${getMuseImageModel()}) ~$0.01/image`)
  } else {
    bits.push('Images: NOT CONFIGURED — set OPENROUTER_API_KEY')
  }

  if (videosPrimary === 'heygen') {
    bits.push('Videos: HeyGen direct → OpenRouter fallback')
  } else if (videosPrimary === 'openrouter') {
    bits.push(
      `Videos: OpenRouter (${getOpenRouterVideoModel()}) — set HEYGEN_API_KEY for direct HeyGen`,
    )
  } else {
    bits.push('Videos: NOT CONFIGURED')
  }

  return {
    images: {
      primary: imagesPrimary,
      museConfigured,
      openRouterConfigured,
      imageModel,
    },
    videos: {
      primary: videosPrimary,
      heygenConfigured,
      openRouterConfigured,
      openRouterModel: getOpenRouterVideoModel(),
    },
    summary: bits.join(' · '),
  }
}

/** Map LUCE aspect ratios to Muse `size` (ratio hint). */
export function museSizeForAspect(aspectRatio?: string): string {
  switch (aspectRatio) {
    case '1:1':
      return '1024x1024'
    case '4:5':
    case '3:4':
      return '1024x1280'
    case '9:16':
      return '1024x1792'
    case '16:9':
      return '1792x1024'
    default:
      return '1024x1280'
  }
}
