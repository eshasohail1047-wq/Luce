import {
  isAspectRatioId,
  type BrandKitBits,
  type CreativeDirectionBits,
} from './luceGeneration.js'

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined
  const arr = v.filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
  return arr.length ? arr : undefined
}

function parseBrandKit(raw: unknown): BrandKitBits | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const o = raw as Record<string, unknown>
  const brandName = typeof o.brandName === 'string' ? o.brandName.trim() : ''
  const colors = asStringArray(o.colors)
  const fonts = asStringArray(o.fonts)
  const voice = typeof o.voice === 'string' ? o.voice.trim() : ''
  const styleNotes = typeof o.styleNotes === 'string' ? o.styleNotes.trim() : ''
  const industry = typeof o.industry === 'string' ? o.industry.trim() : ''
  const positioning = asStringArray(o.positioning)
  const str = (k: string) =>
    typeof o[k] === 'string' ? (o[k] as string).trim() : ''
  const photographyStyle = str('photographyStyle')
  const lightingPreferences = str('lightingPreferences')
  const compositionPreferences = str('compositionPreferences')
  const packagingIdentity = str('packagingIdentity')
  const graphicDesignDirection = str('graphicDesignDirection')
  const socialMediaDirection = str('socialMediaDirection')
  const advertisingStyle = str('advertisingStyle')
  const ctaPreferences = str('ctaPreferences')
  const thingsToAvoid = asStringArray(o.thingsToAvoid)
  const brandRestrictions = asStringArray(o.brandRestrictions)
  const brandKeywords = asStringArray(o.brandKeywords)
  if (
    !brandName &&
    !colors?.length &&
    !fonts?.length &&
    !voice &&
    !styleNotes &&
    !industry &&
    !positioning?.length &&
    !photographyStyle &&
    !packagingIdentity &&
    !thingsToAvoid?.length
  ) {
    return undefined
  }
  const out: BrandKitBits = {}
  if (brandName) out.brandName = brandName
  if (colors) out.colors = colors
  if (fonts) out.fonts = fonts
  if (voice) out.voice = voice
  if (styleNotes) out.styleNotes = styleNotes
  if (industry) out.industry = industry
  if (positioning) out.positioning = positioning
  if (photographyStyle) out.photographyStyle = photographyStyle
  if (lightingPreferences) out.lightingPreferences = lightingPreferences
  if (compositionPreferences) out.compositionPreferences = compositionPreferences
  if (packagingIdentity) out.packagingIdentity = packagingIdentity
  if (graphicDesignDirection) out.graphicDesignDirection = graphicDesignDirection
  if (socialMediaDirection) out.socialMediaDirection = socialMediaDirection
  if (advertisingStyle) out.advertisingStyle = advertisingStyle
  if (ctaPreferences) out.ctaPreferences = ctaPreferences
  if (thingsToAvoid) out.thingsToAvoid = thingsToAvoid
  if (brandRestrictions) out.brandRestrictions = brandRestrictions
  if (brandKeywords) out.brandKeywords = brandKeywords
  return out
}

/** Normalize creativeDirection (+ brandKit) from API / vite proxy request bodies. */
export function parseCreativeDirectionBody(raw: unknown): CreativeDirectionBits | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const cd = raw as Record<string, unknown>
  const brandKit = parseBrandKit(cd.brandKit)
  const aspectRatio = isAspectRatioId(cd.aspectRatio) ? cd.aspectRatio : undefined
  const out: CreativeDirectionBits = {
    prompt: typeof cd.prompt === 'string' ? cd.prompt : undefined,
    lighting: typeof cd.lighting === 'string' ? cd.lighting : undefined,
    background: typeof cd.background === 'string' ? cd.background : undefined,
    mood: typeof cd.mood === 'string' ? cd.mood : undefined,
    styleTheme: typeof cd.styleTheme === 'string' ? cd.styleTheme : undefined,
  }
  if (aspectRatio) out.aspectRatio = aspectRatio
  if (brandKit) out.brandKit = brandKit
  if (
    !out.prompt &&
    !out.lighting &&
    !out.background &&
    !out.mood &&
    !out.styleTheme &&
    !out.aspectRatio &&
    !out.brandKit
  ) {
    return undefined
  }
  return out
}
