/**
 * Complete brand kit fields with evidence levels.
 * verified = website evidence · ai-inferred = interpreted from evidence · unknown = incomplete
 */

export type EvidenceStatus = 'verified' | 'ai-inferred' | 'unknown'

export type EvidenceField<T = string> = {
  value: T
  status: EvidenceStatus
  /** Short explanation when AI-inferred, or source note when verified. */
  evidence?: string
  source?: string
}

export function fieldVerified<T>(value: T, source?: string, evidence?: string): EvidenceField<T> {
  const out: EvidenceField<T> = { value, status: 'verified' }
  if (source) out.source = source
  if (evidence) out.evidence = evidence
  return out
}

export function fieldInferred<T>(value: T, evidence: string, source?: string): EvidenceField<T> {
  const out: EvidenceField<T> = { value, status: 'ai-inferred', evidence }
  if (source) out.source = source
  return out
}

export function fieldUnknown<T>(value: T, evidence?: string): EvidenceField<T> {
  const out: EvidenceField<T> = { value, status: 'unknown' }
  if (evidence) out.evidence = evidence
  return out
}

export type CompleteBrandKit = {
  brandName: EvidenceField
  description: EvidenceField
  industry: EvidenceField
  niche: EvidenceField
  positioning: EvidenceField<string[]>
  targetAudience: EvidenceField
  brandPersonality: EvidenceField<string[]>
  brandVoice: EvidenceField
  brandTone: EvidenceField
  brandKeywords: EvidenceField<string[]>
  primaryColors: EvidenceField<string[]>
  secondaryColors: EvidenceField<string[]>
  accentColors: EvidenceField<string[]>
  backgroundColors: EvidenceField<string[]>
  textColors: EvidenceField<string[]>
  campaignColors: EvidenceField<string[]>
  productColors: EvidenceField<string[]>
  headingFont: EvidenceField
  bodyFont: EvidenceField
  navigationFont: EvidenceField
  buttonFont: EvidenceField
  logoAnalysis: EvidenceField
  packagingIdentity: EvidenceField
  photographyStyle: EvidenceField
  lightingPreferences: EvidenceField
  compositionPreferences: EvidenceField
  graphicDesignDirection: EvidenceField
  socialMediaDirection: EvidenceField
  advertisingStyle: EvidenceField
  messagingThemes: EvidenceField<string[]>
  ctaPreferences: EvidenceField
  brandRestrictions: EvidenceField<string[]>
  thingsToAvoid: EvidenceField<string[]>
}

export type BrandIntelligenceDraft = {
  brandName?: string
  description?: string
  industry?: string
  niche?: string
  positioning?: string[]
  targetAudience?: string
  brandPersonality?: string[]
  brandVoice?: string
  brandTone?: string
  brandKeywords?: string[]
  /** Only from candidates */
  colors?: string[]
  fonts?: string[]
  markets?: string[]
  audienceHint?: string
  styleNotes?: string
  visualDirection?: string
  designCharacteristics?: string[]
  logoAnalysisNotes?: string
  packagingIdentity?: string
  photographyStyle?: string
  lightingPreferences?: string
  compositionPreferences?: string
  graphicDesignDirection?: string
  socialMediaDirection?: string
  advertisingStyle?: string
  messagingThemes?: string[]
  ctaPreferences?: string
  brandRestrictions?: string[]
  thingsToAvoid?: string[]
  /** Per-field evidence notes from the model (field id → explanation) */
  fieldEvidence?: Record<string, string>
}

/** Merge extraction + AI into a complete kit. Colors/fonts stay evidence-backed. */
export function buildCompleteBrandKit(input: {
  brandName?: string
  description?: string
  industry?: string
  primaryColors: string[]
  secondaryColors: string[]
  accentColors: string[]
  backgroundColors: string[]
  textColors: string[]
  campaignColors: string[]
  productColors: string[]
  colorsVerified: boolean
  headingFont?: string
  bodyFont?: string
  navigationFont?: string
  buttonFont?: string
  fontsVerified: boolean
  fontSources?: Record<string, string>
  colorSources?: Record<string, string>
  logoNotes?: string
  logoAnalyzed?: boolean
  ai?: BrandIntelligenceDraft | null
  aiFailed?: boolean
  markets?: string[]
}): CompleteBrandKit {
  const ai = input.ai
  const fe = ai?.fieldEvidence || {}

  const str = (
    verifiedVal: string | undefined,
    verifiedSource: string | undefined,
    aiVal: string | undefined,
    fieldKey: string,
    emptyHint: string,
  ): EvidenceField => {
    if (verifiedVal?.trim()) {
      return fieldVerified(verifiedVal.trim(), verifiedSource, fe[fieldKey])
    }
    if (aiVal?.trim()) {
      return fieldInferred(
        aiVal.trim(),
        fe[fieldKey] || 'Interpreted from website title, copy, and product context.',
      )
    }
    return fieldUnknown('', emptyHint)
  }

  const strList = (
    verified: string[] | undefined,
    aiList: string[] | undefined,
    fieldKey: string,
    emptyHint: string,
    verifiedSource?: string,
  ): EvidenceField<string[]> => {
    if (verified?.length) {
      return fieldVerified(verified, verifiedSource, fe[fieldKey])
    }
    if (aiList?.length) {
      return fieldInferred(
        aiList,
        fe[fieldKey] || 'Interpreted from available website evidence.',
      )
    }
    return fieldUnknown([], emptyHint)
  }

  const colorField = (
    values: string[],
    role: string,
  ): EvidenceField<string[]> => {
    if (!values.length) {
      return fieldUnknown([], `No ${role} colors found in website CSS/render evidence.`)
    }
    return fieldVerified(
      values,
      input.colorSources?.[values[0]!] || 'css/render',
      input.colorsVerified
        ? `Extracted from website stylesheets / computed styles (${role}).`
        : `Declared in CSS; mark as estimated until rendered verification.`,
    )
  }

  const fontField = (
    name: string | undefined,
    usage: string,
  ): EvidenceField => {
    if (!name?.trim()) {
      return fieldUnknown('', `No ${usage} font verified from website evidence.`)
    }
    if (input.fontsVerified && input.fontSources?.[name]) {
      return fieldVerified(
        name,
        input.fontSources[name],
        `Confirmed via rendered computed style for ${usage}.`,
      )
    }
    return fieldInferred(
      name,
      fe[`font_${usage}`] ||
        `Declared in CSS for ${usage}; not confirmed via rendered computed style.`,
      input.fontSources?.[name],
    )
  }

  return {
    brandName: str(
      input.brandName,
      'html:title',
      ai?.brandName,
      'brandName',
      'Add your brand name.',
    ),
    description: str(
      input.description,
      'html:meta',
      ai?.description || ai?.pitch,
      'description',
      'Add a short brand description.',
    ),
    industry: str(input.industry, 'category', ai?.industry, 'industry', 'Select an industry.'),
    niche: (() => {
      const note = fe.niche || ''
      if (ai?.niche && /^Matched |taken from|derived from literal|Market\/audience/i.test(note)) {
        return fieldVerified(ai.niche, 'html:title/description', note)
      }
      return str(undefined, undefined, ai?.niche, 'niche', 'Describe your niche.')
    })(),
    positioning: (() => {
      const note = fe.positioning || ''
      if (ai?.positioning?.length && /title|on page|product categor/i.test(note)) {
        return fieldVerified(ai.positioning, 'html:title/products', note)
      }
      return strList(
        undefined,
        ai?.positioning,
        'positioning',
        'Add positioning statements.',
      )
    })(),
    targetAudience: (() => {
      const note = fe.targetAudience || ''
      if (
        (ai?.targetAudience || ai?.audienceHint) &&
        /language present|audience language/i.test(note)
      ) {
        return fieldVerified(
          (ai.targetAudience || ai.audienceHint)!,
          'html:copy',
          note,
        )
      }
      return str(
        undefined,
        undefined,
        ai?.targetAudience || ai?.audienceHint,
        'targetAudience',
        'Describe your target audience.',
      )
    })(),
    brandPersonality: (() => {
      const note = fe.brandPersonality || ''
      // Copy-heuristic traits are interpretations, not hard CSS facts
      if (ai?.brandPersonality?.length && /literal title|on-page|wording/i.test(note)) {
        return fieldInferred(ai.brandPersonality, note, 'html:copy')
      }
      return strList(
        undefined,
        ai?.brandPersonality,
        'brandPersonality',
        'Add personality traits.',
      )
    })(),
    brandVoice: (() => {
      const note = fe.brandVoice || ''
      if (ai?.brandVoice && /title\/copy|Inferred from/i.test(note)) {
        return fieldInferred(ai.brandVoice, note, 'html:copy')
      }
      return str(undefined, undefined, ai?.brandVoice, 'brandVoice', 'Choose a brand voice.')
    })(),
    brandTone: str(undefined, undefined, ai?.brandTone || ai?.brandVoice, 'brandTone', 'Choose a tone.'),
    brandKeywords: (() => {
      const note = fe.brandKeywords || ''
      if (ai?.brandKeywords?.length && /on-page terms|recurring/i.test(note)) {
        return fieldVerified(ai.brandKeywords, 'html:copy', note)
      }
      return strList(
        undefined,
        ai?.brandKeywords,
        'brandKeywords',
        'Add brand keywords.',
      )
    })(),
    primaryColors: colorField(input.primaryColors, 'primary'),
    secondaryColors: colorField(input.secondaryColors, 'secondary'),
    accentColors: colorField(input.accentColors, 'accent'),
    backgroundColors: colorField(input.backgroundColors, 'background'),
    textColors: colorField(input.textColors, 'text'),
    campaignColors: colorField(input.campaignColors, 'campaign'),
    productColors: colorField(input.productColors, 'product'),
    headingFont: fontField(input.headingFont, 'heading'),
    bodyFont: fontField(input.bodyFont, 'body'),
    navigationFont: fontField(input.navigationFont, 'navigation'),
    buttonFont: fontField(input.buttonFont, 'button'),
    logoAnalysis: input.logoAnalyzed
      ? fieldVerified(
          input.logoNotes || 'Logo colors sampled from image pixels.',
          'logo',
          input.logoNotes,
        )
      : fieldUnknown('', 'Logo could not be analyzed.'),
    packagingIdentity: str(
      undefined,
      undefined,
      ai?.packagingIdentity,
      'packagingIdentity',
      'Describe packaging identity when known.',
    ),
    photographyStyle: str(
      undefined,
      undefined,
      ai?.photographyStyle,
      'photographyStyle',
      'Describe preferred photography style.',
    ),
    lightingPreferences: str(
      undefined,
      undefined,
      ai?.lightingPreferences,
      'lightingPreferences',
      'Describe lighting preferences.',
    ),
    compositionPreferences: str(
      undefined,
      undefined,
      ai?.compositionPreferences,
      'compositionPreferences',
      'Describe composition preferences.',
    ),
    graphicDesignDirection: str(
      undefined,
      undefined,
      ai?.graphicDesignDirection || ai?.visualDirection,
      'graphicDesignDirection',
      'Describe graphic design direction.',
    ),
    socialMediaDirection: str(
      undefined,
      undefined,
      ai?.socialMediaDirection,
      'socialMediaDirection',
      'Describe social content direction.',
    ),
    advertisingStyle: str(
      undefined,
      undefined,
      ai?.advertisingStyle,
      'advertisingStyle',
      'Describe advertising style.',
    ),
    messagingThemes: strList(
      undefined,
      ai?.messagingThemes,
      'messagingThemes',
      'Add messaging themes.',
    ),
    ctaPreferences: str(
      undefined,
      undefined,
      ai?.ctaPreferences,
      'ctaPreferences',
      'Describe CTA preferences.',
    ),
    brandRestrictions: strList(
      undefined,
      ai?.brandRestrictions,
      'brandRestrictions',
      'Add brand restrictions.',
    ),
    thingsToAvoid: strList(
      undefined,
      ai?.thingsToAvoid,
      'thingsToAvoid',
      'Add things to avoid.',
    ),
  }
}
