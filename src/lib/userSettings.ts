import { updateProfile, type User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { requireDb } from './firebase'
import { isOwnerEmail, OWNER_PLAN } from './ownerAccess'
import { normalizeUserPlan, type UserPlan } from './plans'

export type { UserPlan } from './plans'

/** Lightweight product found during website scan — shown on ready dashboard. */
export type ScannedProduct = {
  id: string
  name: string
  imageUrl: string
  sourceUrl?: string
}

/** Brand workspace profile — filled by onboarding, shown in app shell + Brand kit. */
export type WorkspaceSettings = {
  brandName: string
  brandTone: string
  /** Voice/tone id used in generation prompts (mirrors brandTone when unset). */
  brandVoice: string
  brandWebsite: string
  brandIndustry: string
  brandPitch: string
  brandLogoUrl: string
  brandColors: string[]
  brandFonts: string[]
  brandStyleNotes: string
  brandSellType: string
  brandMarkets: string[]
  brandPositioning: string[]
  /** Channel ids from onboarding goals step (ig, tt, meta, …). */
  brandChannels: string[]
  /** Primary campaign goal id (sales, awareness, …). */
  brandGoal: string
  brandAudience: string
  brandVoiceTags: string[]
  brandScannedProducts: ScannedProduct[]
  brandScannedAt: string
  brandPhotographyStyle: string
  brandLighting: string
  brandComposition: string
  brandPackagingIdentity: string
  brandGraphicDirection: string
  brandSocialDirection: string
  brandAdvertisingStyle: string
  brandCtaPreferences: string
  brandThingsToAvoid: string[]
  brandRestrictions: string[]
  brandKeywords: string[]
  notifyExports: boolean
}

export const DEFAULT_WORKSPACE: WorkspaceSettings = {
  brandName: '',
  brandTone: 'premium',
  brandVoice: 'premium',
  brandWebsite: '',
  brandIndustry: '',
  brandPitch: '',
  brandLogoUrl: '',
  brandColors: ['#0A0A0A', '#71717A', '#D4D4D8', '#FAFAFA'],
  brandFonts: ['Geist', 'Inter'],
  brandStyleNotes: '',
  brandSellType: '',
  brandMarkets: [],
  brandPositioning: [],
  brandChannels: [],
  brandGoal: '',
  brandAudience: '',
  brandVoiceTags: [],
  brandScannedProducts: [],
  brandScannedAt: '',
  brandPhotographyStyle: '',
  brandLighting: '',
  brandComposition: '',
  brandPackagingIdentity: '',
  brandGraphicDirection: '',
  brandSocialDirection: '',
  brandAdvertisingStyle: '',
  brandCtaPreferences: '',
  brandThingsToAvoid: [],
  brandRestrictions: [],
  brandKeywords: [],
  notifyExports: true,
}

export const BRAND_TONE_OPTIONS = [
  { id: 'premium', label: 'Premium / refined' },
  { id: 'playful', label: 'Playful / bold' },
  { id: 'minimal', label: 'Minimal / clean' },
  { id: 'clinical', label: 'Clinical / trusted' },
] as const

function asString(v: unknown, fallback: string) {
  return typeof v === 'string' ? v : fallback
}

function asStringArray(v: unknown, fallback: string[]) {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : fallback
}

/** Prefer top-level brand fields; fall back to onboarding.data for older saves. */
export function workspaceFromUserDoc(data: Record<string, unknown>): WorkspaceSettings {
  const onboarding =
    data.onboarding && typeof data.onboarding === 'object'
      ? (data.onboarding as Record<string, unknown>)
      : null
  const obData =
    onboarding?.data && typeof onboarding.data === 'object'
      ? (onboarding.data as Record<string, unknown>)
      : {}

  const brandName =
    asString(data.brandName, '') ||
    asString(obData.businessName, '') ||
    asString(obData.fullName, '')

  const brandTone = asString(data.brandTone, DEFAULT_WORKSPACE.brandTone)
  const brandVoice =
    asString(data.brandVoice, '') ||
    asString(obData.brandVoice, '') ||
    brandTone

  const scannedFromOb = Array.isArray(obData.scannedProducts)
    ? (obData.scannedProducts as ScannedProduct[])
    : []

  return {
    brandName,
    brandTone,
    brandVoice,
    brandWebsite:
      asString(data.brandWebsite, '') || asString(obData.websiteUrl, ''),
    brandIndustry:
      asString(data.brandIndustry, '') ||
      asString(obData.category, '') ||
      asString(obData.industry, ''),
    brandPitch: asString(data.brandPitch, '') || asString(obData.pitch, ''),
    brandLogoUrl:
      asString(data.brandLogoUrl, '') || asString(obData.logoUrl, ''),
    brandColors: asStringArray(
      data.brandColors,
      asStringArray(obData.brandColors, DEFAULT_WORKSPACE.brandColors),
    ),
    brandFonts: asStringArray(
      data.brandFonts,
      asStringArray(obData.brandFonts, DEFAULT_WORKSPACE.brandFonts),
    ),
    brandStyleNotes:
      asString(data.brandStyleNotes, '') || asString(obData.styleNotes, ''),
    brandSellType:
      asString(data.brandSellType, '') || asString(obData.sellType, ''),
    brandMarkets: asStringArray(
      data.brandMarkets,
      asStringArray(obData.markets, []),
    ),
    brandPositioning: asStringArray(
      data.brandPositioning,
      asStringArray(obData.positioning, []),
    ),
    brandChannels: asStringArray(
      data.brandChannels,
      asStringArray(obData.channels, []),
    ),
    brandGoal: asString(data.brandGoal, '') || asString(obData.goal, ''),
    brandAudience:
      asString(data.brandAudience, '') || asString(obData.audienceSummary, ''),
    brandVoiceTags: asStringArray(
      data.brandVoiceTags,
      asStringArray(obData.voiceTags, []),
    ),
    brandScannedProducts: (() => {
      const raw = data.brandScannedProducts
      if (Array.isArray(raw) && raw.length) {
        return raw.filter(
          (p): p is ScannedProduct =>
            Boolean(p) &&
            typeof p === 'object' &&
            typeof (p as ScannedProduct).name === 'string',
        )
      }
      return scannedFromOb
    })(),
    brandScannedAt:
      asString(data.brandScannedAt, '') || asString(obData.scannedAt, ''),
    brandPhotographyStyle:
      asString(data.brandPhotographyStyle, '') ||
      asString(obData.photographyStyle, ''),
    brandLighting:
      asString(data.brandLighting, '') ||
      asString(obData.lightingPreferences, ''),
    brandComposition:
      asString(data.brandComposition, '') ||
      asString(obData.compositionPreferences, ''),
    brandPackagingIdentity:
      asString(data.brandPackagingIdentity, '') ||
      asString(obData.packagingIdentity, ''),
    brandGraphicDirection:
      asString(data.brandGraphicDirection, '') ||
      asString(obData.graphicDesignDirection, ''),
    brandSocialDirection:
      asString(data.brandSocialDirection, '') ||
      asString(obData.socialMediaDirection, ''),
    brandAdvertisingStyle:
      asString(data.brandAdvertisingStyle, '') ||
      asString(obData.advertisingStyle, ''),
    brandCtaPreferences:
      asString(data.brandCtaPreferences, '') ||
      asString(obData.ctaPreferences, ''),
    brandThingsToAvoid: asStringArray(
      data.brandThingsToAvoid,
      asStringArray(obData.thingsToAvoid, []),
    ),
    brandRestrictions: asStringArray(
      data.brandRestrictions,
      asStringArray(obData.brandRestrictions, []),
    ),
    brandKeywords: asStringArray(
      data.brandKeywords,
      asStringArray(obData.brandKeywords, []),
    ),
    notifyExports:
      typeof data.notifyExports === 'boolean'
        ? data.notifyExports
        : DEFAULT_WORKSPACE.notifyExports,
  }
}

export async function loadUserSettings(
  userId: string,
  email?: string | null,
): Promise<{
  plan: UserPlan
  freeImageUsed: boolean
  workspace: WorkspaceSettings
}> {
  const snap = await getDoc(doc(requireDb(), 'users', userId))
  const data = (snap.data() || {}) as Record<string, unknown>
  const docEmail = typeof data.email === 'string' ? data.email : email
  if (isOwnerEmail(email) || isOwnerEmail(docEmail)) {
    return {
      plan: OWNER_PLAN,
      freeImageUsed: false,
      workspace: workspaceFromUserDoc(data),
    }
  }
  return {
    plan: normalizeUserPlan(data.plan),
    freeImageUsed: Boolean(data.freeImageUsed),
    workspace: workspaceFromUserDoc(data),
  }
}

export async function saveDisplayName(user: User, name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Enter a display name.')
  await updateProfile(user, { displayName: trimmed })
  await setDoc(
    doc(requireDb(), 'users', user.uid),
    {
      displayName: trimmed,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function saveUserPlan(userId: string, plan: UserPlan) {
  await setDoc(
    doc(requireDb(), 'users', userId),
    {
      plan,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function markFreeImageUsed(userId: string) {
  await setDoc(
    doc(requireDb(), 'users', userId),
    {
      freeImageUsed: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as T
  }
  if ('_methodName' in (value as object)) return value
  const ctor = (value as object).constructor?.name || ''
  if (/FieldValue|Timestamp|GeoPoint|DocumentReference|Bytes|Vector/i.test(ctor)) {
    return value
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue
    out[k] = stripUndefinedDeep(v)
  }
  return out as T
}

export async function saveWorkspaceSettings(
  userId: string,
  workspace: Partial<WorkspaceSettings>,
) {
  await setDoc(
    doc(requireDb(), 'users', userId),
    {
      ...stripUndefinedDeep(workspace),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/** Strip domain crumbs from storefront names: "Miss Rose Com Pk" → "Miss Rose". */
export function formatBrandDisplayName(brandName: string): string {
  const tld =
    /^(com|co|net|org|io|app|shop|store|online|official|pk|uk|us|in|ae|ca|au|nz|de|fr|it|es|nl|sg|my|id|ph|bd|lk)$/i
  let name = brandName.split(/[|–—•·]/)[0]?.replace(/\s+/g, ' ').trim() || ''
  const parts = name.split(/\s+/).filter(Boolean)
  while (parts.length >= 2 && tld.test(parts[parts.length - 1]!)) parts.pop()
  name = parts.join(' ').trim()
  return name || brandName.trim() || 'Your brand'
}

export function workspaceInitials(brandName: string) {
  const parts = formatBrandDisplayName(brandName).split(/\s+/).filter(Boolean)
  if (!parts.length) return 'L'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase()
}

export function sellTypeLabel(sellType: string) {
  if (sellType === 'physical') return 'Physical products'
  if (sellType === 'services') return 'Services'
  if (sellType === 'local') return 'Local business'
  return sellType || 'Brand'
}
