/**
 * LUCE copy agent — captions, hooks, CTAs, hashtags, ad copy via OpenRouter chat.
 */

import {
  generateChatCompletion,
  getOpenRouterApiKey,
  getOpenRouterChatModel,
} from './openRouter.js'

export const COPY_ASSET_KINDS = [
  'caption',
  'hook',
  'cta',
  'hashtags',
  'ad_copy',
] as const

export type CopyAssetKind = (typeof COPY_ASSET_KINDS)[number]

export function isCopyAssetKind(value: string): value is CopyAssetKind {
  return (COPY_ASSET_KINDS as readonly string[]).includes(value)
}

const COPY_LABELS: Record<CopyAssetKind, string> = {
  caption: 'Caption',
  hook: 'Hook',
  cta: 'CTA',
  hashtags: 'Hashtags',
  ad_copy: 'Ad copy',
}

type CreativeDirectionBits = {
  prompt?: string
  lighting?: string
  background?: string
  mood?: string
  styleTheme?: string
}

export type GenerateCopyInput = {
  productName: string
  brand?: string
  description?: string
  category?: string
  creativeDirection?: CreativeDirectionBits
  assets: CopyAssetKind[]
  recreateNote?: string
}

export type GeneratedCopyAsset = {
  type: CopyAssetKind
  label: string
  text: string
  promptUsed?: string
  model?: string
}

export type GenerateCopyResult = {
  status: number
  body:
    | {
        ok: true
        assets: GeneratedCopyAsset[]
        partialErrors?: { type: CopyAssetKind; error: string }[]
      }
    | { ok: false; error: string }
}

const SYSTEM_PROMPT = `You are LUCE Copy Agent — a senior DTC / beauty / ecommerce social + ads copywriter.
You run on OpenRouter free text models. Keep answers short and usable as final copy.

Rules:
- Write for Instagram, TikTok, and Meta ads.
- Keep product packaging / brand name accurate; never invent fake claims or medical promises.
- Sound human, scroll-stopping, and on-brand — not corporate or spammy.
- Match the requested asset type exactly (caption vs hook vs CTA vs hashtags vs ad_copy).
- Return ONLY the final copy text. No quotes, no markdown fences, no labels like "Caption:".
- If hashtags: return a single line of 6–12 relevant hashtags starting with #.
- If CTA: one short line with a clear action.
- If hook: one punchy first-line scroll-stopper (under ~12 words when possible).
- If caption: 2–4 short sentences, optional emoji sparingly.
- If ad_copy: primary text for a paid ad (2–4 sentences) ending with a soft CTA.`

function briefFor(kind: CopyAssetKind): string {
  switch (kind) {
    case 'caption':
      return 'Write an organic Instagram/TikTok caption for this product post.'
    case 'hook':
      return 'Write a scroll-stopping hook line (first line of a Reel/TikTok).'
    case 'cta':
      return 'Write a short call-to-action line (shop / link in bio style).'
    case 'hashtags':
      return 'Write a hashtag line for this product (6–12 tags, one line).'
    case 'ad_copy':
      return 'Write Meta/TikTok paid ad primary text for this product.'
  }
}

function buildUserPrompt(
  kind: CopyAssetKind,
  input: GenerateCopyInput,
): string {
  const name = input.productName.trim() || 'the product'
  const bits: string[] = [
    briefFor(kind),
    `Product name: ${name}`,
  ]
  if (input.brand?.trim()) bits.push(`Brand: ${input.brand.trim()}`)
  if (input.category?.trim()) bits.push(`Category: ${input.category.trim()}`)
  if (input.description?.trim()) {
    bits.push(`Product description: ${input.description.trim()}`)
  }
  const cd = input.creativeDirection
  if (cd?.prompt?.trim()) bits.push(`Creative direction: ${cd.prompt.trim()}`)
  if (cd?.mood?.trim()) bits.push(`Mood: ${cd.mood.trim()}`)
  if (cd?.styleTheme?.trim()) bits.push(`Style theme: ${cd.styleTheme.trim()}`)
  if (cd?.lighting?.trim()) bits.push(`Lighting vibe: ${cd.lighting.trim()}`)
  if (cd?.background?.trim()) {
    bits.push(`Background vibe: ${cd.background.trim()}`)
  }
  if (input.recreateNote?.trim()) {
    bits.push(`Revision note: ${input.recreateNote.trim()}`)
  }
  bits.push('Return only the copy text.')
  return bits.join('\n')
}

function cleanCopyText(raw: string, kind: CopyAssetKind): string {
  let text = raw.trim()
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:\w+)?\n?/, '').replace(/\n?```$/, '').trim()
  }
  text = text.replace(/^["'“”]+|["'“”]+$/g, '').trim()
  const labelStrip = new RegExp(
    `^(${COPY_LABELS[kind]}|${kind})\\s*[:\\-]\\s*`,
    'i',
  )
  text = text.replace(labelStrip, '').trim()
  return text
}

export async function generateCampaignCopy(
  input: GenerateCopyInput,
): Promise<GenerateCopyResult> {
  if (!getOpenRouterApiKey()) {
    return {
      status: 503,
      body: {
        ok: false,
        error:
          'Copy AI is not configured. Set OPENROUTER_API_KEY for captions, hooks, and ad copy.',
      },
    }
  }

  const assets =
    input.assets.length > 0
      ? [...new Set(input.assets.filter(isCopyAssetKind))]
      : [...COPY_ASSET_KINDS]

  if (assets.length === 0) {
    return {
      status: 400,
      body: { ok: false, error: 'No valid copy assets requested.' },
    }
  }

  const out: GeneratedCopyAsset[] = []
  const partialErrors: { type: CopyAssetKind; error: string }[] = []
  const model = getOpenRouterChatModel()

  for (const type of assets) {
    const user = buildUserPrompt(type, input)
    try {
      const result = await generateChatCompletion({
        system: SYSTEM_PROMPT,
        user,
        model,
        temperature: type === 'hashtags' ? 0.55 : 0.8,
        maxTokens: type === 'hashtags' ? 200 : 500,
      })
      const text = cleanCopyText(result.text, type)
      if (!text) {
        throw new Error('Empty copy returned')
      }
      out.push({
        type,
        label: COPY_LABELS[type],
        text,
        promptUsed: user,
        model: result.model,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Copy generation failed'
      console.warn('[generate-copy] asset failed', type, message)
      partialErrors.push({ type, error: message })
    }
  }

  if (out.length === 0) {
    return {
      status: 502,
      body: {
        ok: false,
        error:
          partialErrors[0]?.error ||
          'Copy agent could not generate any text. Try again.',
      },
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      assets: out,
      ...(partialErrors.length ? { partialErrors } : {}),
    },
  }
}
