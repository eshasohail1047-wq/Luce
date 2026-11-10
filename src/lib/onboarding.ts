import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { CONTENT_MIX_TYPES, type ContentMixId } from '../config/credits'
import { requireDb } from './firebase'
import {
  DEFAULT_CHANNELS,
  DEFAULT_SCHEDULE_DAYS,
  defaultMixCounts,
  INDUSTRIES,
  type ChannelId,
  type FreedomId,
  type IndustryId,
  type PlanId,
  type StrategyId,
  type VisualStyleId,
} from './onboardingOptions'
import type { ScannedProduct, WorkspaceSettings } from './userSettings'

/**
 * Sign-in → about you → website scan → confirm kit → channels/goal → plan → dashboard.
 * Scanning is the bridge after website; Launch is the plan / trial step.
 */
export const ONBOARDING_STEPS = [
  'personal',
  'website',
  'scanning',
  'brand',
  'goals',
  'plan',
] as const

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]

export const ONBOARDING_GROUPS = [
  { id: 'you', label: 'About you', steps: ['personal'] as const },
  { id: 'business', label: 'Your business', steps: ['website', 'scanning'] as const },
  { id: 'brand', label: 'Review brand', steps: ['brand'] as const },
  { id: 'goals', label: 'Goals', steps: ['goals'] as const },
  { id: 'launch', label: 'Launch', steps: ['plan'] as const },
] as const

export const STEP_LABELS: Record<OnboardingStepId, string> = {
  personal: 'About you',
  website: 'Website',
  scanning: 'Scanning',
  brand: 'Review brand',
  goals: 'Channels & goals',
  plan: 'Choose a plan',
}

export type SellType = 'physical' | 'services' | 'local'

export type SetupMode = 'scan' | 'manual'

export type RoleId = 'founder' | 'marketer' | 'freelancer' | 'agency' | 'other'

export type GoalId = 'sales' | 'awareness' | 'launch' | 'community'

export const SELL_TYPE_OPTIONS: { id: SellType; label: string; desc: string }[] = [
  { id: 'physical', label: 'Physical products', desc: 'Ship goods to customers' },
  { id: 'services', label: 'Services', desc: 'Bookings, retainers, or digital work' },
  { id: 'local', label: 'Local business', desc: 'Storefront, clinic, or venue' },
]

export const ROLE_OPTIONS: { id: RoleId; label: string; desc: string }[] = [
  { id: 'founder', label: 'Founder or owner', desc: 'Running the brand yourself' },
  { id: 'marketer', label: 'Marketer', desc: 'In-house growth or content' },
  { id: 'freelancer', label: 'Freelancer', desc: 'Creating for clients' },
  { id: 'agency', label: 'Agency', desc: 'Managing multiple brands' },
  { id: 'other', label: 'Other', desc: 'Something else' },
]

export const GOAL_OPTIONS: { id: GoalId; label: string; desc: string }[] = [
  { id: 'sales', label: 'Get more sales', desc: 'Convert traffic into orders' },
  { id: 'awareness', label: 'Grow awareness', desc: 'Reach new audiences' },
  { id: 'launch', label: 'Launch a product', desc: 'Introduce something new' },
  { id: 'community', label: 'Build community', desc: 'Engage and retain fans' },
]

export const HEAR_OPTIONS = [
  'Google / search',
  'Instagram',
  'TikTok',
  'Friend or colleague',
  'Newsletter',
  'Other',
] as const

export type OnboardingData = {
  fullName: string
  firstName: string
  lastName: string
  role: RoleId | ''
  howHeard: string
  industry: IndustryId | ''
  category: string
  websiteUrl: string
  setupMode: SetupMode | ''
  businessName: string
  sellType: SellType | ''
  pitch: string
  logoUrl: string
  brandColors: string[]
  brandFonts: string[]
  /** Evidence meta aligned with brandColors (verified/estimated). */
  brandColorMeta: Array<{
    hex: string
    role?: string
    verified?: boolean
    estimated?: boolean
    confidence?: number
    source?: string
    property?: string
    cssVariable?: string
    usageContext?: string
    themeKind?: string
    occurrences?: number
    evidence?: string
    verificationStatus?: string
  }>
  /** Evidence meta aligned with brandFonts. */
  brandFontMeta: Array<{
    name: string
    usage?: string
    verified?: boolean
    estimated?: boolean
    confidence?: number
    source?: string
    property?: string
    cssVariable?: string
    usageContext?: string
    fontFileLoaded?: boolean
    computedStack?: string
    evidence?: string
    verificationStatus?: string
  }>
  brandKeywords: string[]
  extractionMethod: string
  extractionConfidence: number
  paletteIncomplete: boolean
  /** Structured kit fields with verified / ai-inferred / unknown. */
  completeBrandKit: Record<
    string,
    { value: unknown; status: string; evidence?: string; source?: string }
  > | null
  aiWarning: string
  photographyStyle: string
  lightingPreferences: string
  compositionPreferences: string
  graphicDesignDirection: string
  socialMediaDirection: string
  advertisingStyle: string
  messagingThemes: string[]
  ctaPreferences: string
  brandRestrictions: string[]
  thingsToAvoid: string[]
  brandPersonality: string[]
  niche: string
  packagingIdentity: string
  brandVoice: string
  voiceTags: string[]
  styleNotes: string
  positioning: string[]
  previewImages: string[]
  scannedProducts: ScannedProduct[]
  foundFields: string[]
  scannedAt: string
  audienceAgeFrom: string
  audienceAgeTo: string
  audienceGender: string
  audienceSummary: string
  markets: string[]
  modelAge: string
  modelGender: string
  modelEthnicity: string
  modelLanguage: string
  strategy: StrategyId | ''
  goal: GoalId | ''
  channels: ChannelId[]
  scheduleDays: string[]
  mix: Record<ContentMixId, number>
  visualStyle: VisualStyleId | ''
  freedom: FreedomId | ''
  lockProduct: boolean
  plan: PlanId
  billingYearly: boolean
  budget: string
}

export type OnboardingState = {
  completed: boolean
  step: OnboardingStepId
  data: OnboardingData
  skipped?: boolean
}

/** Map older IDs onto the tightened flow. */
const LEGACY_STEP_MAP: Record<string, OnboardingStepId> = {
  welcome: 'personal',
  industry: 'personal',
  business: 'personal',
  learning: 'scanning',
  audience: 'brand',
  review: 'brand',
  strategy: 'goals',
  channels: 'goals',
  mix: 'goals',
  style: 'goals',
  freedom: 'goals',
  paywall: 'plan',
  building: 'plan',
  ready: 'plan',
}

export function emptyOnboardingData(): OnboardingData {
  return {
    fullName: '',
    firstName: '',
    lastName: '',
    role: '',
    howHeard: '',
    industry: '',
    category: '',
    websiteUrl: '',
    setupMode: '',
    businessName: '',
    sellType: '',
    pitch: '',
    logoUrl: '',
    brandColors: [],
    brandFonts: [],
    brandColorMeta: [],
    brandFontMeta: [],
    brandKeywords: [],
    extractionMethod: '',
    extractionConfidence: 0,
    paletteIncomplete: false,
    completeBrandKit: null,
    aiWarning: '',
    photographyStyle: '',
    lightingPreferences: '',
    compositionPreferences: '',
    graphicDesignDirection: '',
    socialMediaDirection: '',
    advertisingStyle: '',
    messagingThemes: [],
    ctaPreferences: '',
    brandRestrictions: [],
    thingsToAvoid: [],
    brandPersonality: [],
    niche: '',
    packagingIdentity: '',
    brandVoice: 'premium',
    voiceTags: ['Premium', 'Minimal', 'Clean'],
    styleNotes: '',
    positioning: [],
    previewImages: [],
    scannedProducts: [],
    foundFields: [],
    scannedAt: '',
    audienceAgeFrom: '18',
    audienceAgeTo: '44',
    audienceGender: 'all',
    audienceSummary: '',
    markets: ['United States'],
    modelAge: '25-34',
    modelGender: 'any',
    modelEthnicity: 'diverse',
    modelLanguage: 'English (US)',
    strategy: 'life',
    goal: 'sales',
    channels: [...DEFAULT_CHANNELS],
    scheduleDays: [...DEFAULT_SCHEDULE_DAYS],
    mix: defaultMixCounts(),
    visualStyle: 'soft',
    freedom: 'bal',
    lockProduct: true,
    plan: 'growth',
    billingYearly: false,
    budget: '',
  }
}

function asString(v: unknown, fallback: string) {
  return typeof v === 'string' ? v : fallback
}

function asStringArray(v: unknown, fallback: string[]) {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : fallback
}

function parseMix(raw: unknown): Record<ContentMixId, number> {
  const base = defaultMixCounts()
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  for (const row of CONTENT_MIX_TYPES) {
    const n = obj[row.id]
    if (typeof n === 'number' && Number.isFinite(n)) {
      base[row.id] = Math.max(0, Math.min(20, Math.round(n)))
    }
  }
  return base
}

function parseScannedProducts(raw: unknown): ScannedProduct[] {
  if (!Array.isArray(raw)) return []
  const out: ScannedProduct[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const name = asString(o.name, '').trim()
    const imageUrl = asString(o.imageUrl, '').trim()
    if (!name && !imageUrl) continue
    out.push({
      id: asString(o.id, `scan-${out.length}`),
      name: name || `Product ${out.length + 1}`,
      imageUrl,
      sourceUrl: asString(o.sourceUrl, '') || undefined,
    })
  }
  return out
}

function mapCategoryToIndustry(category: string): IndustryId {
  const c = category.toLowerCase()
  if (c.includes('frag') || c.includes('perfume')) return 'frag'
  if (c.includes('skin') || c.includes('beauty') || c.includes('makeup') || c.includes('hair'))
    return 'beauty'
  if (c.includes('fashion') || c.includes('apparel') || c.includes('groom')) return 'fashion'
  if (c.includes('jewel')) return 'jewel'
  if (c.includes('food') || c.includes('beverage') || c.includes('drink')) return 'food'
  if (c.includes('health') || c.includes('well')) return 'well'
  if (c.includes('home') || c.includes('lifestyle') || c.includes('decor')) return 'home'
  if (c.includes('electr') || c.includes('tech')) return 'tech'
  const hit = INDUSTRIES.find((i) => i.name.toLowerCase() === c)
  return hit?.id ?? 'other'
}

export function guessCategoryFromText(text: string): string {
  const t = text.toLowerCase()
  if (/groom|beard|shave|moustache|mustache|men'?s care|barber/.test(t))
    return "Men's grooming"
  if (/perfume|fragrance|scent|oud|cologne/.test(t)) return 'Fragrance'
  if (/skin|beauty|makeup|cosmetic|serum|skincare/.test(t)) return 'Beauty and skincare'
  if (/fashion|apparel|clothing|wear|dress/.test(t)) return 'Fashion'
  if (/jewel|ring|necklace|gold|silver/.test(t)) return 'Jewelry'
  if (/food|coffee|drink|beverage|restaurant/.test(t)) return 'Food and drink'
  if (/wellness|health|fitness|yoga/.test(t)) return 'Wellness'
  if (/home|decor|furniture|interior/.test(t)) return 'Home and decor'
  if (/tech|electronic|gadget|phone/.test(t)) return 'Electronics'
  return 'Something else'
}

function composeFullName(first: string, last: string, fallback: string) {
  const joined = `${first.trim()} ${last.trim()}`.trim()
  return joined || fallback.trim()
}

function voiceTagsFromTone(voice: string): string[] {
  const v = voice.toLowerCase()
  if (v.includes('play')) return ['Playful', 'Bold', 'Fresh']
  if (v.includes('minimal')) return ['Minimal', 'Clean', 'Quiet']
  if (v.includes('clinic')) return ['Clinical', 'Trusted', 'Clear']
  return ['Premium', 'Warm', 'Luxe']
}

export function goalLabel(goal: string) {
  return GOAL_OPTIONS.find((g) => g.id === goal)?.label || goal || 'Get more sales'
}

export function parseOnboarding(raw: unknown): OnboardingState {
  const empty = emptyOnboardingData()
  const base: OnboardingState = { completed: false, step: 'personal', data: empty }
  if (!raw || typeof raw !== 'object') return base
  const obj = raw as Record<string, unknown>
  const dataRaw =
    obj.data && typeof obj.data === 'object' ? (obj.data as Record<string, unknown>) : {}

  let stepRaw = typeof obj.step === 'string' ? obj.step : 'personal'
  if (LEGACY_STEP_MAP[stepRaw]) stepRaw = LEGACY_STEP_MAP[stepRaw]!
  const step = ONBOARDING_STEPS.includes(stepRaw as OnboardingStepId)
    ? (stepRaw as OnboardingStepId)
    : 'personal'

  const industry =
    (asString(dataRaw.industry, '') as IndustryId | '') ||
    (asString(dataRaw.category, '')
      ? mapCategoryToIndustry(asString(dataRaw.category, ''))
      : empty.industry)

  const firstName = asString(dataRaw.firstName, empty.firstName)
  const lastName = asString(dataRaw.lastName, empty.lastName)
  const fullName =
    asString(dataRaw.fullName, '') ||
    composeFullName(firstName, lastName, empty.fullName)

  const brandVoice =
    asString(dataRaw.brandVoice, '') ||
    asString(dataRaw.brandTone, empty.brandVoice) ||
    empty.brandVoice

  return {
    completed: Boolean(obj.completed),
    skipped: Boolean(obj.skipped),
    step,
    data: {
      ...empty,
      fullName,
      firstName: firstName || fullName.split(/\s+/)[0] || '',
      lastName: lastName || fullName.split(/\s+/).slice(1).join(' '),
      role: (asString(dataRaw.role, empty.role) as RoleId | '') || empty.role,
      howHeard: asString(dataRaw.howHeard, empty.howHeard),
      industry: industry || empty.industry,
      category:
        asString(dataRaw.category, empty.category) ||
        INDUSTRIES.find((i) => i.id === industry)?.name ||
        empty.category,
      websiteUrl: asString(dataRaw.websiteUrl, empty.websiteUrl),
      setupMode:
        asString(dataRaw.setupMode, '') === 'manual' || asString(dataRaw.setupMode, '') === 'scan'
          ? (asString(dataRaw.setupMode, '') as SetupMode)
          : empty.setupMode,
      businessName: asString(dataRaw.businessName, empty.businessName),
      sellType: (asString(dataRaw.sellType, empty.sellType) as SellType | '') || empty.sellType,
      pitch: asString(dataRaw.pitch, empty.pitch),
      logoUrl: asString(dataRaw.logoUrl, empty.logoUrl),
      brandColors: asStringArray(dataRaw.brandColors, empty.brandColors),
      brandFonts: asStringArray(dataRaw.brandFonts, empty.brandFonts),
      brandColorMeta: Array.isArray(dataRaw.brandColorMeta)
        ? (dataRaw.brandColorMeta as OnboardingData['brandColorMeta']).filter(
            (c) => c && typeof c === 'object' && typeof c.hex === 'string',
          )
        : empty.brandColorMeta,
      brandFontMeta: Array.isArray(dataRaw.brandFontMeta)
        ? (dataRaw.brandFontMeta as OnboardingData['brandFontMeta']).filter(
            (f) => f && typeof f === 'object' && typeof f.name === 'string',
          )
        : empty.brandFontMeta,
      brandKeywords: asStringArray(dataRaw.brandKeywords, empty.brandKeywords),
      extractionMethod: asString(dataRaw.extractionMethod, empty.extractionMethod),
      extractionConfidence:
        typeof dataRaw.extractionConfidence === 'number'
          ? dataRaw.extractionConfidence
          : empty.extractionConfidence,
      paletteIncomplete: dataRaw.paletteIncomplete === true,
      completeBrandKit:
        dataRaw.completeBrandKit && typeof dataRaw.completeBrandKit === 'object'
          ? (dataRaw.completeBrandKit as OnboardingData['completeBrandKit'])
          : empty.completeBrandKit,
      aiWarning: asString(dataRaw.aiWarning, empty.aiWarning),
      photographyStyle: asString(dataRaw.photographyStyle, empty.photographyStyle),
      lightingPreferences: asString(
        dataRaw.lightingPreferences,
        empty.lightingPreferences,
      ),
      compositionPreferences: asString(
        dataRaw.compositionPreferences,
        empty.compositionPreferences,
      ),
      graphicDesignDirection: asString(
        dataRaw.graphicDesignDirection,
        empty.graphicDesignDirection,
      ),
      socialMediaDirection: asString(
        dataRaw.socialMediaDirection,
        empty.socialMediaDirection,
      ),
      advertisingStyle: asString(dataRaw.advertisingStyle, empty.advertisingStyle),
      messagingThemes: asStringArray(dataRaw.messagingThemes, empty.messagingThemes),
      ctaPreferences: asString(dataRaw.ctaPreferences, empty.ctaPreferences),
      brandRestrictions: asStringArray(
        dataRaw.brandRestrictions,
        empty.brandRestrictions,
      ),
      thingsToAvoid: asStringArray(dataRaw.thingsToAvoid, empty.thingsToAvoid),
      brandPersonality: asStringArray(
        dataRaw.brandPersonality,
        empty.brandPersonality,
      ),
      niche: asString(dataRaw.niche, empty.niche),
      packagingIdentity: asString(dataRaw.packagingIdentity, empty.packagingIdentity),
      brandVoice,
      voiceTags: asStringArray(dataRaw.voiceTags, voiceTagsFromTone(brandVoice)),
      styleNotes: asString(dataRaw.styleNotes, empty.styleNotes),
      positioning: asStringArray(dataRaw.positioning, empty.positioning),
      previewImages: asStringArray(dataRaw.previewImages, empty.previewImages),
      scannedProducts: parseScannedProducts(dataRaw.scannedProducts),
      foundFields: asStringArray(dataRaw.foundFields, empty.foundFields),
      scannedAt: asString(dataRaw.scannedAt, empty.scannedAt),
      audienceAgeFrom: asString(dataRaw.audienceAgeFrom, empty.audienceAgeFrom),
      audienceAgeTo: asString(dataRaw.audienceAgeTo, empty.audienceAgeTo),
      audienceGender: asString(dataRaw.audienceGender, empty.audienceGender),
      audienceSummary: asString(dataRaw.audienceSummary, empty.audienceSummary),
      markets: asStringArray(dataRaw.markets, empty.markets),
      modelAge: asString(dataRaw.modelAge, empty.modelAge),
      modelGender: asString(dataRaw.modelGender, empty.modelGender),
      modelEthnicity: asString(dataRaw.modelEthnicity, empty.modelEthnicity),
      modelLanguage: asString(dataRaw.modelLanguage, empty.modelLanguage),
      strategy: (asString(dataRaw.strategy, empty.strategy) as StrategyId | '') || 'life',
      goal: (asString(dataRaw.goal, empty.goal) as GoalId | '') || 'sales',
      channels: asStringArray(dataRaw.channels, empty.channels) as ChannelId[],
      scheduleDays: asStringArray(dataRaw.scheduleDays, empty.scheduleDays),
      mix: parseMix(dataRaw.mix),
      visualStyle:
        (asString(dataRaw.visualStyle, empty.visualStyle) as VisualStyleId | '') || 'soft',
      freedom: (asString(dataRaw.freedom, empty.freedom) as FreedomId | '') || 'bal',
      lockProduct:
        typeof dataRaw.lockProduct === 'boolean' ? dataRaw.lockProduct : empty.lockProduct,
      plan: (asString(dataRaw.plan, empty.plan) as PlanId) || 'growth',
      billingYearly:
        typeof dataRaw.billingYearly === 'boolean'
          ? dataRaw.billingYearly
          : empty.billingYearly,
      budget: asString(dataRaw.budget, empty.budget),
    },
  }
}

export async function loadOnboarding(userId: string): Promise<OnboardingState> {
  const snap = await getDoc(doc(requireDb(), 'users', userId))
  const data = snap.data() || {}
  if (!snap.exists()) return parseOnboarding(null)
  if (data.onboarding == null) {
    return { completed: true, step: 'plan', data: emptyOnboardingData() }
  }
  return parseOnboarding(data.onboarding)
}

/** Remove undefined so Firestore setDoc does not reject the write. */
function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined || value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as T
  }
  // Preserve Firestore FieldValue sentinels (serverTimestamp, etc.).
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

export async function saveOnboardingProgress(
  userId: string,
  step: OnboardingStepId,
  data: OnboardingData,
) {
  await setDoc(
    doc(requireDb(), 'users', userId),
    {
      onboarding: {
        completed: false,
        step,
        data: stripUndefinedDeep(data),
        updatedAt: serverTimestamp(),
      },
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

/** Flatten onboarding confirm → workspace brand kit fields used by withBrandKit. */
export function workspacePatchFromOnboarding(
  data: OnboardingData,
): Partial<WorkspaceSettings> {
  const brand = data.businessName.trim() || data.fullName.trim()
  const audience =
    data.audienceSummary.trim() ||
    [
      data.audienceGender === 'all' ? 'Customers' : data.audienceGender,
      data.audienceAgeFrom && data.audienceAgeTo
        ? `${data.audienceAgeFrom} to ${data.audienceAgeTo}`
        : '',
      data.category ? `who care about ${data.category.toLowerCase()}` : '',
    ]
      .filter(Boolean)
      .join(' ')

  const patch: Partial<WorkspaceSettings> = {
    brandName: brand,
    brandTone: data.brandVoice || 'premium',
    brandVoice: data.brandVoice || 'premium',
    brandWebsite: data.websiteUrl.trim(),
    brandIndustry: data.category || data.industry || '',
    brandPitch: data.pitch.trim(),
    brandLogoUrl: data.logoUrl,
    brandStyleNotes: data.styleNotes.trim(),
    brandSellType: data.sellType || 'physical',
    brandMarkets: data.markets,
    brandPositioning: data.positioning,
    brandChannels: data.channels,
    brandGoal: data.goal || 'sales',
    brandAudience: audience,
    brandVoiceTags: data.voiceTags.length
      ? data.voiceTags
      : voiceTagsFromTone(data.brandVoice || 'premium'),
    brandScannedProducts: data.scannedProducts,
    brandScannedAt: data.scannedAt,
  }
  if (data.brandColors?.length) patch.brandColors = data.brandColors
  if (data.brandFonts?.length) patch.brandFonts = data.brandFonts
  if (data.photographyStyle) patch.brandPhotographyStyle = data.photographyStyle
  if (data.lightingPreferences) patch.brandLighting = data.lightingPreferences
  if (data.compositionPreferences) patch.brandComposition = data.compositionPreferences
  if (data.packagingIdentity) {
    patch.brandPackagingIdentity = data.packagingIdentity
  }
  if (data.graphicDesignDirection) {
    patch.brandGraphicDirection = data.graphicDesignDirection
  }
  if (data.socialMediaDirection) {
    patch.brandSocialDirection = data.socialMediaDirection
  }
  if (data.advertisingStyle) patch.brandAdvertisingStyle = data.advertisingStyle
  if (data.ctaPreferences) patch.brandCtaPreferences = data.ctaPreferences
  if (data.thingsToAvoid?.length) patch.brandThingsToAvoid = data.thingsToAvoid
  if (data.brandRestrictions?.length) {
    patch.brandRestrictions = data.brandRestrictions
  }
  if (data.brandKeywords?.length) patch.brandKeywords = data.brandKeywords
  return patch
}

async function persistComplete(
  userId: string,
  data: OnboardingData,
  opts: { skipped: boolean },
) {
  const brand = data.businessName.trim() || data.fullName.trim()
  const kit = workspacePatchFromOnboarding(data)
  const payload: Record<string, unknown> = {
    ...kit,
    brandChannels: data.channels,
    brandGoal: data.goal || 'sales',
    onboarding: {
      completed: true,
      skipped: opts.skipped,
      step: 'plan',
      data: stripUndefinedDeep(data),
      completedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    updatedAt: serverTimestamp(),
  }
  const displayName = data.fullName.trim()
  if (displayName) payload.displayName = displayName
  if (brand) payload.brandName = brand
  if (data.strategy) payload.brandStrategy = data.strategy
  if (data.visualStyle) payload.brandVisualStyle = data.visualStyle
  if (data.freedom) payload.brandFreedom = data.freedom
  if (data.plan === 'starter' || data.plan === 'growth' || data.plan === 'pro') {
    payload.plan = data.plan
  } else {
    payload.plan = 'free'
  }
  await setDoc(
    doc(requireDb(), 'users', userId),
    stripUndefinedDeep(payload),
    { merge: true },
  )
}

export async function completeOnboarding(userId: string, data: OnboardingData) {
  await persistComplete(userId, data, { skipped: false })
}

export async function skipOnboarding(userId: string, data: OnboardingData) {
  await persistComplete(userId, data, { skipped: true })
}

export function stepPath(step: OnboardingStepId) {
  return `/onboarding/${step}`
}

export function nextStep(step: OnboardingStepId): OnboardingStepId | null {
  const i = ONBOARDING_STEPS.indexOf(step)
  if (i < 0 || i >= ONBOARDING_STEPS.length - 1) return null
  return ONBOARDING_STEPS[i + 1]!
}

export function prevStep(step: OnboardingStepId): OnboardingStepId | null {
  const i = ONBOARDING_STEPS.indexOf(step)
  if (i <= 0) return null
  let prev = ONBOARDING_STEPS[i - 1]!
  // Scanning auto-forwards to brand — Back must land on an editable step.
  if (prev === 'scanning') {
    prev = ONBOARDING_STEPS[i - 2] ?? prev
  }
  return prev === 'scanning' ? null : prev
}

export function stepNumber(step: OnboardingStepId) {
  return ONBOARDING_STEPS.indexOf(step) + 1
}

export function groupForStep(step: OnboardingStepId) {
  return (
    ONBOARDING_GROUPS.find((g) => (g.steps as readonly string[]).includes(step)) ??
    ONBOARDING_GROUPS[0]
  )
}

export function industryFromCategory(category: string): IndustryId | '' {
  return category ? mapCategoryToIndustry(category) : ''
}

export function domainFromUrl(url: string) {
  const raw = url.trim()
  if (!raw) return 'your website'
  try {
    return new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.replace(
      /^www\./,
      '',
    )
  } catch {
    return raw
  }
}

function guessMarketFromDomain(domain: string): string[] {
  const d = domain.toLowerCase()
  if (d.endsWith('.pk') || d.includes('pakistan')) return ['Pakistan']
  if (d.endsWith('.uk') || d.endsWith('.co.uk')) return ['United Kingdom']
  if (d.endsWith('.ae')) return ['United Arab Emirates']
  if (d.endsWith('.in')) return ['India']
  if (d.endsWith('.ca')) return ['Canada']
  if (d.endsWith('.au')) return ['Australia']
  return ['United States']
}

export function productsFromScanImages(
  images: string[],
  websiteUrl: string,
): ScannedProduct[] {
  const stamp = Date.now()
  return images.slice(0, 36).map((imageUrl, i) => {
    let name = `Product ${i + 1}`
    try {
      const path = new URL(imageUrl).pathname
      const base = path
        .split('/')
        .filter(Boolean)
        .pop()
        ?.replace(/\.[a-z0-9]+$/i, '')
      if (
        base &&
        base.length > 2 &&
        !/^(image|img|photo|product|cdn|file|asset|media|static)/i.test(base)
      ) {
        name = base
          .replace(/[-_]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .slice(0, 48)
      }
    } catch {
      /* keep default */
    }
    return {
      id: `scan-${stamp}-${i}`,
      name,
      imageUrl,
      sourceUrl: websiteUrl || undefined,
    }
  })
}

function scannedProductsFromFetch(
  products:
    | Array<{ name: string; imageUrl: string; sourceUrl?: string }>
    | undefined,
  images: string[],
  websiteUrl: string,
): ScannedProduct[] {
  const stamp = Date.now()
  if (products?.length) {
    return products.map((p, i) => {
      const product: ScannedProduct = {
        id: `scan-${stamp}-${i}`,
        name: p.name.trim().slice(0, 80) || `Product ${i + 1}`,
        imageUrl: p.imageUrl,
      }
      const sourceUrl = (p.sourceUrl || websiteUrl || '').trim()
      if (sourceUrl) product.sourceUrl = sourceUrl
      return product
    })
  }
  return productsFromScanImages(images, websiteUrl)
}

/** "Miss Rose Com Pk" → "Miss Rose"; strips domain TLD crumbs from storefront titles. */
function cleanBrandNameFromScan(
  title: string,
  url: string,
  productNames?: string[],
): string {
  const tld =
    /^(com|co|net|org|io|app|shop|store|online|official|pk|uk|us|in|ae|ca|au|nz|de|fr|it|es|nl|sg|my|id|ph|bd|lk)$/i
  let name = title.split(/[|–—•·]/)[0]?.replace(/\s+/g, ' ').trim() || ''
  const parts = name.split(/\s+/).filter(Boolean)
  while (parts.length >= 2 && tld.test(parts[parts.length - 1]!)) parts.pop()
  name = parts.join(' ').trim()

  if (productNames?.length) {
    const counts = new Map<string, number>()
    for (const raw of productNames) {
      const words = raw
        .replace(/\s+/g, ' ')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
      if (words.length < 2) continue
      const key = words.slice(0, 2).join(' ').toLowerCase()
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    let best = ''
    let bestCount = 0
    for (const [key, count] of counts) {
      if (count >= 3 && count > bestCount) {
        best = key
        bestCount = count
      }
    }
    if (best) {
      const titled = best.replace(/\b\w/g, (c) => c.toUpperCase())
      const lower = name.toLowerCase()
      if (!name || lower.startsWith(best) || best.startsWith(lower) || tld.test(parts.at(-1) || '')) {
        name = titled
      }
    }
  }

  if (!name) {
    try {
      const host = new URL(url).hostname.replace(/^www\./i, '')
      name = (host.split('.')[0] || '').replace(/[-_]+/g, ' ').trim()
    } catch {
      /* keep */
    }
  }
  return name.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80)
}

function sanitizeFonts(fonts: string[] | undefined): string[] {
  if (!fonts?.length) return []
  const junk =
    /^(font|icon|icons|fa|judgeme|star|swiper|shopify|inherit|sans-serif|serif|monospace|system-ui|arial|helvetica|times)$/i
  const out: string[] = []
  for (const raw of fonts) {
    const clean = raw.replace(/["']/g, '').trim()
    if (!clean || clean.length < 3 || junk.test(clean)) continue
    const titled = clean.replace(/\b\w/g, (c) => c.toUpperCase())
    if (out.some((f) => f.toLowerCase() === titled.toLowerCase())) continue
    out.push(titled)
  }
  return out.slice(0, 2)
}

function titleCaseMarkets(markets: string[] | undefined): string[] {
  if (!markets?.length) return []
  const out: string[] = []
  for (const m of markets) {
    const t = m
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
    if (!t || out.includes(t)) continue
    out.push(t)
  }
  return out.slice(0, 3)
}

function inferAudienceDemographics(summary: string): {
  audienceAgeFrom: string
  audienceAgeTo: string
  audienceGender: string
} {
  const t = summary.toLowerCase()
  let audienceGender = 'all'
  if (/\bwomen\b|\bladies\b|\bfemale\b/.test(t)) audienceGender = 'women'
  else if (/\bmen\b|\bmale\b|\bgentlemen\b/.test(t)) audienceGender = 'men'

  let audienceAgeFrom = '22'
  let audienceAgeTo = '45'
  if (/18[\s–-]*28|gen[\s-]?z/.test(t)) {
    audienceAgeFrom = '18'
    audienceAgeTo = '28'
  } else if (/25[\s–-]*40|millennial/.test(t)) {
    audienceAgeFrom = '25'
    audienceAgeTo = '40'
  } else if (/25[\s–-]*34/.test(t)) {
    audienceAgeFrom = '25'
    audienceAgeTo = '34'
  } else if (/35[\s–-]*44/.test(t)) {
    audienceAgeFrom = '35'
    audienceAgeTo = '44'
  }
  return { audienceAgeFrom, audienceAgeTo, audienceGender }
}

export function profileFromFetch(input: {
  url: string
  title?: string
  description?: string
  images: string[]
  category?: string
  logoUrl?: string
  colors?: string[]
  fonts?: string[]
  markets?: string[]
  audienceHint?: string
  products?: Array<{ name: string; imageUrl: string; sourceUrl?: string }>
  brandVoice?: string
  styleNotes?: string
  brandKeywords?: string[]
  colorDetails?: Array<{
    hex: string
    classification?: string
    source?: string
    confidence?: number
    verified?: boolean
    promotional?: boolean
    property?: string
    cssVariable?: string
    usageContext?: string
    themeKind?: string
    occurrences?: number
    evidence?: string
    verificationStatus?: string
  }>
  fontDetails?: Array<{
    name: string
    usage?: string
    source?: string
    confidence?: number
    verified?: boolean
    estimated?: boolean
    property?: string
    cssVariable?: string
    usageContext?: string
    fontFileLoaded?: boolean
    computedStack?: string
    evidence?: string
    verificationStatus?: string
  }>
  brandProfile?: {
    primaryColors?: Array<{ hex: string; role?: string; verified?: boolean; estimated?: boolean; confidence?: number; source?: string; property?: string; cssVariable?: string; usageContext?: string; themeKind?: string; occurrences?: number; evidence?: string; verificationStatus?: string }>
    headingFont?: { name: string; usage?: string; verified?: boolean; estimated?: boolean; confidence?: number; source?: string; property?: string; cssVariable?: string; usageContext?: string; fontFileLoaded?: boolean; computedStack?: string; evidence?: string; verificationStatus?: string }
    bodyFont?: { name: string; usage?: string; verified?: boolean; estimated?: boolean; confidence?: number; source?: string; property?: string; cssVariable?: string; usageContext?: string; fontFileLoaded?: boolean; computedStack?: string; evidence?: string; verificationStatus?: string }
    navigationFont?: { name: string; usage?: string; verified?: boolean; estimated?: boolean; confidence?: number; source?: string; property?: string; cssVariable?: string; usageContext?: string; fontFileLoaded?: boolean; computedStack?: string; evidence?: string; verificationStatus?: string }
    brandKeywords?: string[]
    extractionMethod?: string
    extractionConfidence?: number
    paletteIncomplete?: boolean
    colorDetails?: Array<{ hex: string; role?: string; verified?: boolean; estimated?: boolean; confidence?: number; source?: string; property?: string; cssVariable?: string; usageContext?: string; themeKind?: string; occurrences?: number; evidence?: string; verificationStatus?: string }>
    fontDetails?: Array<{ name: string; usage?: string; verified?: boolean; estimated?: boolean; confidence?: number; source?: string; property?: string; cssVariable?: string; usageContext?: string; fontFileLoaded?: boolean; computedStack?: string; evidence?: string; verificationStatus?: string }>
  }
  extractionMethod?: string
  extractionConfidence?: number
  paletteIncomplete?: boolean
  completeBrandKit?: Record<
    string,
    { value: unknown; status: string; evidence?: string; source?: string }
  >
  aiWarning?: string
}): Partial<OnboardingData> {
  let domain = input.url
  try {
    domain = new URL(input.url).hostname.replace(/^www\./, '')
  } catch {
    /* keep */
  }
  const name = cleanBrandNameFromScan(
    input.title || '',
    input.url,
    input.products?.map((p) => p.name),
  )
  const brand = name || 'Your brand'
  const desc = (input.description || '').trim()
  const category =
    input.category?.trim() ||
    guessCategoryFromText(`${input.title || ''} ${desc} ${domain}`)
  const pitch =
    desc.slice(0, 320) ||
    `${brand} is a ${category.toLowerCase()} brand helping customers discover products they’ll love.`
  const positioning = [
    desc ? desc.split(/[.!?]/)[0]!.trim().slice(0, 100) : `${brand} — trusted by customers`,
    `Focused on ${category.toLowerCase()}`,
    'Quality products with a clear brand story',
  ].filter(Boolean)

  const scannedProducts = scannedProductsFromFetch(
    input.products,
    input.images,
    input.url,
  )
  const logoUrl = input.logoUrl || ''
  // Evidence-backed only — never pad with invented neutrals or default typefaces.
  const brandColors = input.colors?.length ? input.colors.slice(0, 8) : []
  const brandFonts = sanitizeFonts(input.fonts)
  const brandColorMeta =
    input.brandProfile?.colorDetails?.map((c) => ({
      hex: c.hex,
      role: c.role,
      verified: c.verified,
      estimated: c.estimated,
      confidence: c.confidence,
      source: c.source,
      property: c.property,
      cssVariable: c.cssVariable,
      usageContext: c.usageContext,
      themeKind: c.themeKind,
      occurrences: c.occurrences,
      evidence: c.evidence,
      verificationStatus: c.verificationStatus,
    })) ||
    input.colorDetails?.map((c) => ({
      hex: c.hex,
      role: c.classification,
      verified: c.verified,
      estimated: !c.verified,
      confidence: c.confidence,
      source: c.source,
      property: c.property,
      cssVariable: c.cssVariable,
      usageContext: c.usageContext,
      themeKind: (c as { themeKind?: string }).themeKind,
      occurrences: (c as { occurrences?: number }).occurrences,
      evidence: (c as { evidence?: string }).evidence,
      verificationStatus: (c as { verificationStatus?: string }).verificationStatus,
    })) ||
    brandColors.map((hex) => ({ hex, estimated: true }))
  const brandFontMeta =
    input.brandProfile?.fontDetails?.map((f) => ({
      name: f.name,
      usage: f.usage,
      verified: f.verified,
      estimated: f.estimated,
      confidence: f.confidence,
      source: f.source,
      property: f.property,
      cssVariable: f.cssVariable,
      usageContext: f.usageContext,
      fontFileLoaded: f.fontFileLoaded,
      computedStack: f.computedStack,
      evidence: f.evidence,
      verificationStatus: f.verificationStatus,
    })) ||
    input.fontDetails?.map((f) => ({
      name: f.name,
      usage: f.usage,
      verified: f.verified,
      estimated: f.estimated ?? !f.verified,
      confidence: f.confidence,
      source: f.source,
      property: f.property,
      cssVariable: f.cssVariable,
      usageContext: f.usageContext,
      fontFileLoaded: (f as { fontFileLoaded?: boolean }).fontFileLoaded,
      computedStack: (f as { computedStack?: string }).computedStack,
      evidence: (f as { evidence?: string }).evidence,
      verificationStatus: (f as { verificationStatus?: string }).verificationStatus,
    })) ||
    brandFonts.map((name) => ({ name, estimated: true }))
  const brandKeywords = (
    input.brandKeywords ||
    input.brandProfile?.brandKeywords ||
    []
  ).slice(0, 8)
  const markets = titleCaseMarkets(input.markets).length
    ? titleCaseMarkets(input.markets)
    : guessMarketFromDomain(domain)
  const audienceSummary =
    input.audienceHint?.trim() ||
    (markets[0]
      ? `Customers in ${markets[0]} who care about ${category.toLowerCase()}`
      : `Customers who care about ${category.toLowerCase()}`)
  const audienceDemo = inferAudienceDemographics(audienceSummary)
  // Prefer AI/extracted voice; never default to generic "premium".
  const brandVoice = input.brandVoice?.trim()
    ? input.brandVoice.trim().toLowerCase().slice(0, 40)
    : /playful|bold|fun|irreverent/i.test(`${desc} ${pitch}`)
      ? 'playful'
      : /minimal|clean|quiet|simple/i.test(`${desc} ${pitch}`)
        ? 'minimal'
        : /clinical|dermatolog|medical|science/i.test(`${desc} ${pitch}`)
          ? 'clinical'
          : /grooming|beard|men'?s care|skincare|hair care/i.test(`${desc} ${pitch} ${brand}`)
            ? 'confident'
            : /luxury|premium|luxe|exclusive/i.test(`${desc} ${pitch}`)
              ? 'premium'
              : ''

  const foundFields = ['businessName', 'category', 'markets', 'positioning', 'audienceSummary']
  if (desc) foundFields.push('pitch')
  if (logoUrl) foundFields.push('logoUrl')
  if (brandColors.length) foundFields.push('brandColors')
  if (brandFonts.length) foundFields.push('brandFonts')
  if (scannedProducts.length) foundFields.push('scannedProducts')

  return {
    businessName: brand,
    pitch,
    logoUrl,
    websiteUrl: input.url,
    category,
    industry: mapCategoryToIndustry(category),
    sellType: 'physical',
    markets,
    positioning,
    previewImages: (input.images.length ? input.images : scannedProducts.map((p) => p.imageUrl)).slice(
      0,
      12,
    ),
    scannedProducts,
    brandColors,
    brandFonts,
    brandColorMeta,
    brandFontMeta,
    brandKeywords,
    extractionMethod:
      input.extractionMethod || input.brandProfile?.extractionMethod || '',
    extractionConfidence:
      input.extractionConfidence ?? input.brandProfile?.extractionConfidence ?? 0,
    paletteIncomplete:
      input.paletteIncomplete === true ||
      input.brandProfile?.paletteIncomplete === true,
    completeBrandKit: input.completeBrandKit || null,
    aiWarning: input.aiWarning || '',
    photographyStyle: fieldStr(input.completeBrandKit?.photographyStyle),
    lightingPreferences: fieldStr(input.completeBrandKit?.lightingPreferences),
    compositionPreferences: fieldStr(input.completeBrandKit?.compositionPreferences),
    graphicDesignDirection: fieldStr(
      input.completeBrandKit?.graphicDesignDirection,
    ),
    socialMediaDirection: fieldStr(input.completeBrandKit?.socialMediaDirection),
    advertisingStyle: fieldStr(input.completeBrandKit?.advertisingStyle),
    messagingThemes: fieldStrList(input.completeBrandKit?.messagingThemes),
    ctaPreferences: fieldStr(input.completeBrandKit?.ctaPreferences),
    brandRestrictions: fieldStrList(input.completeBrandKit?.brandRestrictions),
    thingsToAvoid: fieldStrList(input.completeBrandKit?.thingsToAvoid),
    brandPersonality: fieldStrList(input.completeBrandKit?.brandPersonality),
    niche: fieldStr(input.completeBrandKit?.niche),
    packagingIdentity: fieldStr(input.completeBrandKit?.packagingIdentity),
    brandVoice,
    voiceTags: voiceTagsFromTone(brandVoice),
    styleNotes:
      input.styleNotes?.trim() ||
      (desc ? `Inspired by ${brand}: ${desc.slice(0, 160)}` : ''),
    audienceSummary,
    ...audienceDemo,
    foundFields,
    scannedAt: new Date().toISOString(),
  }
}

function fieldStr(
  field?: { value: unknown; status: string; evidence?: string; source?: string },
): string {
  if (!field) return ''
  return typeof field.value === 'string' ? field.value : ''
}

function fieldStrList(
  field?: { value: unknown; status: string; evidence?: string; source?: string },
): string[] {
  if (!field) return []
  return Array.isArray(field.value)
    ? field.value.filter((x): x is string => typeof x === 'string')
    : []
}

export function profileWithoutWebsite(
  fullName: string,
  extras?: Partial<Pick<OnboardingData, 'businessName' | 'category' | 'industry' | 'sellType'>>,
): Partial<OnboardingData> {
  const brand = extras?.businessName?.trim() || fullName.trim() || 'My brand'
  const category = extras?.category?.trim() || ''
  const sellType = extras?.sellType || 'physical'
  const industry =
    extras?.industry || (category ? mapCategoryToIndustry(category) : ('' as IndustryId | ''))
  const pitch = category
    ? `${brand} is a ${category.toLowerCase()} brand helping customers discover products they’ll love.`
    : `${brand} creates products customers love.`
  return {
    businessName: brand,
    pitch,
    category,
    industry: industry || '',
    sellType,
    websiteUrl: '',
    setupMode: 'manual',
    scannedProducts: [],
    previewImages: [],
    foundFields: category ? ['businessName', 'category'] : ['businessName'],
    scannedAt: new Date().toISOString(),
    audienceSummary: category
      ? `Customers who care about ${category.toLowerCase()}`
      : '',
  }
}

export function syncNameFields(data: OnboardingData): OnboardingData {
  const fullName = composeFullName(data.firstName, data.lastName, data.fullName)
  return { ...data, fullName }
}
