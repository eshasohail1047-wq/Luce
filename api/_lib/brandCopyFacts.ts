/**
 * Deterministic brand facts from on-page copy only.
 * Never invents demographics or unverified claims.
 */

export type BrandCopyFacts = {
  industry?: string
  niche?: string
  positioning?: string[]
  targetAudience?: string
  brandKeywords?: string[]
  brandPersonality?: string[]
  brandVoice?: string
  brandTone?: string
  fieldEvidence?: Record<string, string>
}

function clean(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

const TLD_CRUMB =
  /^(com|co|net|org|io|app|shop|store|online|official|pk|uk|us|in|ae|ca|au|nz|de|fr|it|es|nl|sg|my|id|ph|bd|lk)$/i

/**
 * Clean storefront titles like "Miss Rose Com Pk" → "Miss Rose".
 * Strips domain TLD crumbs and prefers a repeated product-name prefix when helpful.
 */
export function cleanBrandDisplayName(
  raw: string,
  opts?: { url?: string; productNames?: string[] },
): string {
  let name = clean(raw).split(/[|–—•·]/)[0]?.trim() || ''
  // "Brand Com Pk" / "Brand Co Uk" / trailing single TLD token
  const parts = name.split(/\s+/).filter(Boolean)
  while (parts.length >= 2 && TLD_CRUMB.test(parts[parts.length - 1]!)) {
    parts.pop()
  }
  // If last remaining token is still a gTLD crumb after popping ccTLD (Com + Pk)
  while (parts.length >= 2 && TLD_CRUMB.test(parts[parts.length - 1]!)) {
    parts.pop()
  }
  name = parts.join(' ').trim()

  const fromProducts = commonProductBrandPrefix(opts?.productNames)
  if (fromProducts) {
    const lower = name.toLowerCase()
    const pref = fromProducts.toLowerCase()
    if (
      !name ||
      lower === pref ||
      lower.startsWith(`${pref} `) ||
      pref.startsWith(lower) ||
      // Title still looks like a domain label with spaces
      /\b(com|co|net|org|pk|uk)\b/i.test(name)
    ) {
      name = fromProducts
    }
  }

  if (!name && opts?.url) {
    try {
      const host = new URL(opts.url).hostname.replace(/^www\./i, '')
      const label = host.split('.')[0] || ''
      name = label.replace(/[-_]+/g, ' ').trim()
    } catch {
      /* keep empty */
    }
  }

  return name.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80)
}

/** Shared 2–3 word prefix across product titles, e.g. "Miss Rose …". */
function commonProductBrandPrefix(productNames?: string[]): string | undefined {
  if (!productNames?.length) return undefined
  const counts = new Map<string, number>()
  for (const raw of productNames) {
    const words = clean(raw)
      .replace(/\b(official|authentic|original|new|sale)\b/gi, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 3)
    if (words.length < 2) continue
    for (const n of [2, 3]) {
      if (words.length < n) continue
      const key = words
        .slice(0, n)
        .join(' ')
        .toLowerCase()
      if (TLD_CRUMB.test(words[0]!) || key.length < 4) continue
      counts.set(key, (counts.get(key) || 0) + 1)
    }
  }
  let best = ''
  let bestCount = 0
  for (const [key, count] of counts) {
    if (count < 3) continue
    if (count > bestCount || (count === bestCount && key.length < best.length)) {
      best = key
      bestCount = count
    }
  }
  if (!best) return undefined
  return best.replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Extract only what title / meta / product names literally support.
 */
export function extractBrandCopyFacts(input: {
  title?: string
  description?: string
  productNames?: string[]
}): BrandCopyFacts {
  const title = clean(input.title || '')
  const description = clean(input.description || '')
  const products = (input.productNames || []).map(clean).filter(Boolean)
  const blob = `${title} ${description} ${products.join(' ')}`.toLowerCase()
  const out: BrandCopyFacts = { fieldEvidence: {} }
  const fe = out.fieldEvidence!

  // Industry / niche from explicit title/description language
  if (/men'?s\s+grooming|grooming\s+brand|beard|moustache|mustache/.test(blob)) {
    out.industry = 'Men\'s grooming'
    out.niche = /pakistan/.test(blob)
      ? 'Men\'s grooming products in Pakistan'
      : 'Men\'s grooming products'
    fe.industry = `Matched grooming language in title/description: "${title.slice(0, 80)}"`
    fe.niche = fe.industry
  } else if (/skincare|skin care|beauty|cosmetics|makeup|colourpop|lipstick/.test(blob)) {
    out.industry = /makeup|cosmetics|lipstick|colourpop/.test(blob) ? 'Cosmetics' : 'Skincare'
    out.niche = out.industry
    fe.industry = `Matched beauty/cosmetics language in title/description`
  } else if (/hair\s*care|shampoo|conditioner/.test(blob)) {
    out.industry = 'Hair care'
    out.niche = 'Hair care products'
    fe.industry = 'Matched hair-care language in title/description'
  }

  if (/pakistan/.test(blob)) {
    out.targetAudience = /men/.test(blob)
      ? 'Men in Pakistan interested in grooming'
      : 'Customers in Pakistan'
    fe.targetAudience = 'Market/audience language present in title or description'
  } else if (/men'?s|for men|guys|beard/.test(blob)) {
    out.targetAudience = 'Men interested in personal grooming'
    fe.targetAudience = 'Masculine grooming audience language in title/products'
  }

  const keywords: string[] = []
  const keywordChecks: Array<[RegExp, string]> = [
    [/grooming/, 'grooming'],
    [/beard/, 'beard'],
    [/skincare|skin care/, 'skincare'],
    [/hair/, 'hair'],
    [/body\s*care/, 'body care'],
    [/styling/, 'styling'],
    [/trusted|quality/, 'quality'],
    [/pakistan/, 'pakistan'],
  ]
  for (const [re, key] of keywordChecks) {
    if (re.test(blob) && !keywords.includes(key)) keywords.push(key)
  }
  if (keywords.length) {
    out.brandKeywords = keywords.slice(0, 8)
    fe.brandKeywords = 'Keywords taken from recurring on-page terms'
  }

  const personality: string[] = []
  if (/#1|number one|finest|trusted/.test(blob)) personality.push('confident')
  if (/grooming|practical|essentials|delivered/.test(blob)) personality.push('practical')
  // Require whole-word bold/strong/power — avoid false hits inside other words
  if (/\bbold\b|\bstrong\b|\bpower(?:ful)?\b/.test(blob)) personality.push('bold')
  if (/\bcare\b|essentials|quality/.test(blob)) personality.push('caring')
  // Strip luxury generics unless the copy actually says them
  const filtered = personality.filter(
    (p) => !/^(premium|refined|luxe|elegant|sophisticated)$/i.test(p),
  )
  if (filtered.length) {
    out.brandPersonality = filtered.slice(0, 5)
    fe.brandPersonality = 'Traits derived from literal title/description wording'
  }

  if (out.brandPersonality?.includes('confident')) {
    out.brandVoice = 'confident'
    out.brandTone = 'direct'
    fe.brandVoice = 'Inferred from assertive/trust claims in title/copy'
  } else if (/clinical|dermatolog|science/.test(blob)) {
    out.brandVoice = 'clinical'
    out.brandTone = 'precise'
  }

  const positioning: string[] = []
  if (title) {
    // Keep the title claim as positioning evidence (not invented)
    const claim = title.split('|').map((s) => s.trim()).filter(Boolean)
    if (claim[1]) positioning.push(claim[1].slice(0, 100))
    else if (claim[0] && claim[0].length > 3) positioning.push(claim[0].slice(0, 100))
  }
  if (/skincare|body care|hair care|beard/.test(blob)) {
    positioning.push('Offers grooming essentials across skin, hair, and beard care')
  }
  if (positioning.length) {
    out.positioning = [...new Set(positioning)].slice(0, 4)
    fe.positioning = 'Positioning statements taken from title/product categories on page'
  }

  return out
}

/**
 * Actionable style notes from extracted palette/fonts + copy — not a meta rewrite.
 */
export function buildEvidenceStyleNotes(input: {
  title?: string
  description?: string
  colors?: string[]
  fonts?: string[]
  industry?: string
}): string | undefined {
  const title = clean(input.title || '').toLowerCase()
  const desc = clean(input.description || '').toLowerCase()
  const blob = `${title} ${desc}`
  const colors = (input.colors || []).map((c) => c.toUpperCase())
  const fonts = [...new Set((input.fonts || []).map((f) => f.trim()).filter(Boolean))]
  const parts: string[] = []

  if (/grooming|beard|men'?s/.test(blob)) {
    parts.push(
      'Aesthetic: modern masculine grooming — clean product heroes, matte packaging, high-contrast type',
    )
    parts.push(
      'Lighting: bright even daylight or soft studio key; avoid glam beauty filters and pink/rose casts',
    )
    parts.push(
      'Background: light neutral grey or concrete/stone; keep scenes uncluttered',
    )
  } else if (/makeup|cosmetic|colour|colorpop|lipstick/.test(blob)) {
    parts.push('Aesthetic: bold product color storytelling with tight macro swatches')
    parts.push('Lighting: crisp product light that preserves true pigment')
    parts.push('Background: simple fields that make pigment pop; avoid muddy props')
  } else if (input.industry) {
    parts.push(`Aesthetic: align sets with ${input.industry.toLowerCase()} product storytelling`)
  }

  if (colors.length) {
    parts.push(`Color usage: lock palette to ${colors.slice(0, 5).join(', ')}; do not invent extra brand hues`)
  }
  if (fonts.length) {
    parts.push(`Typography: prefer ${fonts.slice(0, 2).join(' / ')} for on-image text when needed`)
  }
  parts.push(
    'Composition: centered or rule-of-thirds product hero, generous negative space, readable CTA area',
  )
  parts.push(
    'Product presentation: show real packaging/label clearly; avoid lifestyle clutter that hides the SKU',
  )
  parts.push(
    'Avoid: generic luxury-beauty tropes, neon sale graphics, unrelated widget blues, stock “luxe marble” clichés unless the brand site uses them',
  )

  // Never return a paraphrase of the meta description alone
  const joined = parts.join('. ')
  if (!joined.trim()) return undefined
  if (desc && joined.toLowerCase().includes(desc.slice(0, Math.min(40, desc.length)))) {
    return parts.filter((p) => !p.toLowerCase().includes(desc.slice(0, 20))).join('. ')
  }
  return joined.slice(0, 500)
}
