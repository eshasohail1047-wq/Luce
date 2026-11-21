import type { ContentMixId } from '../config/credits'
import { CONTENT_MIX_TYPES } from '../config/credits'

export const INDUSTRIES = [
  { id: 'frag', name: 'Fragrance', icon: 'spray' },
  { id: 'beauty', name: 'Beauty and skincare', icon: 'sparkles' },
  { id: 'fashion', name: 'Fashion', icon: 'shirt' },
  { id: 'jewel', name: 'Jewelry', icon: 'gem' },
  { id: 'food', name: 'Food and drink', icon: 'coffee' },
  { id: 'well', name: 'Wellness', icon: 'leaf' },
  { id: 'home', name: 'Home and decor', icon: 'sofa' },
  { id: 'tech', name: 'Electronics', icon: 'phone' },
  { id: 'other', name: 'Something else', icon: 'more' },
] as const

export type IndustryId = (typeof INDUSTRIES)[number]['id']

export const BUDGET_OPTIONS = [
  { id: 'under1k', label: 'Under $1,000 / mo', desc: 'Testing formats and learning' },
  { id: '1to5k', label: '$1,000 – $5,000 / mo', desc: 'Steady content cadence' },
  { id: '5to20k', label: '$5,000 – $20,000 / mo', desc: 'Multi-channel growth' },
  { id: '20kplus', label: '$20,000+ / mo', desc: 'Always-on production' },
  { id: 'unsure', label: 'Not sure yet', desc: 'We’ll start lean' },
] as const

export type BudgetId = (typeof BUDGET_OPTIONS)[number]['id']

export const STRATEGIES = [
  {
    id: 'life',
    name: 'Lifestyle',
    tag: 'Recommended',
    img: '/images/fidelity-evening.jpg',
    desc: 'Your product in the moments your customer wants to live.',
    why: 'Buyers choose on mood before specs, so scenes sell better than feature lists.',
    ex: ['Getting ready', 'Date night', 'Hotel vanity', 'Weekend travel'],
  },
  {
    id: 'offer',
    name: 'Offer and promotion',
    tag: 'Drives sales',
    img: '/images/format-perfume-promo.jpg',
    desc: 'Launches, gift sets, bundles and limited-time deals.',
    why: 'Clear offers with urgency convert warm audiences and returning buyers.',
    ex: ['Gift set launch', '24h countdown', 'Bundle and save', 'Free sample'],
  },
  {
    id: 'edu',
    name: 'Product education',
    tag: 'Builds trust',
    img: '/images/format-perfume-flatlay.jpg',
    desc: 'How it works, ingredients, longevity and how to use it.',
    why: 'Answering the questions that stop online buyers builds confidence.',
    ex: ['Notes breakdown', 'How to layer', 'Day vs night', 'Ingredient story'],
  },
  {
    id: 'proof',
    name: 'Social proof',
    tag: 'UGC heavy',
    img: '/images/video-poster-testimonial.jpg',
    desc: 'UGC selfies, reviews and testimonials from AI creators.',
    why: 'Real-looking people reacting make an unseen product feel tried.',
    ex: ['UGC reaction', 'Testimonial', 'GRWM', 'Duet-style review'],
  },
  {
    id: 'prob',
    name: 'Problem and solution',
    tag: 'Direct response',
    img: '/images/video-poster-grwm.jpg',
    desc: 'Name a frustration, then show how you fix it.',
    why: 'Naming a common frustration hooks scrollers who already feel it.',
    ex: ['Fades by noon?', '12-hour test', 'Before vs after', 'Myth vs fact'],
  },
] as const

export type StrategyId = (typeof STRATEGIES)[number]['id']

export const CHANNEL_GROUPS = [
  {
    name: 'Social feed',
    items: [
      { id: 'ig', name: 'Instagram', ab: 'IG' },
      { id: 'fb', name: 'Facebook', ab: 'f' },
      { id: 'pin', name: 'Pinterest', ab: 'P' },
      { id: 'li', name: 'LinkedIn', ab: 'in' },
      { id: 'x', name: 'X', ab: 'X' },
    ],
  },
  {
    name: 'Short-form video',
    items: [
      { id: 'tt', name: 'TikTok', ab: 'TT' },
      { id: 'reels', name: 'Instagram Reels', ab: 'R' },
      { id: 'yt', name: 'YouTube Shorts', ab: 'YT' },
    ],
  },
  {
    name: 'Ads and storefront',
    items: [
      { id: 'meta', name: 'Meta Ads', ab: 'M' },
      { id: 'ttads', name: 'TikTok Ads', ab: 'TA' },
      { id: 'shop', name: 'Shopify pages', ab: 'S' },
      { id: 'amz', name: 'Amazon listing', ab: 'A' },
      { id: 'dl', name: 'Download only', ab: '↓' },
    ],
  },
] as const

export type ChannelId =
  (typeof CHANNEL_GROUPS)[number]['items'][number]['id']

export const DEFAULT_CHANNELS: ChannelId[] = [
  'ig',
  'fb',
  'pin',
  'tt',
  'reels',
  'meta',
  'shop',
]

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

export const DEFAULT_SCHEDULE_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const

export const VISUAL_STYLES = [
  {
    id: 'soft',
    recommended: true,
    name: 'Soft Studio',
    desc: 'Clean seamless backdrop, quiet luxury.',
    light: 'Soft wrapped',
    grade: 'Clean neutral',
    contrast: 'Low',
    img: '/images/campaign-perfume-studio.jpg',
    prompt: 'soft studio lighting, seamless backdrop, quiet luxury',
  },
  {
    id: 'bloom',
    recommended: true,
    name: 'High Bloom',
    desc: 'Campaign-level vibrancy, bright and airy.',
    light: 'Bright wrapped',
    grade: 'Boosted neutral',
    contrast: 'Medium',
    img: '/images/format-perfume-promo.jpg',
    prompt: 'bright airy campaign lighting, vibrant bloom',
  },
  {
    id: 'luxe',
    recommended: true,
    name: 'Dramatic Luxe',
    desc: 'Hard shadows and rich reflections.',
    light: 'Hard directional',
    grade: 'Punchy neutral',
    contrast: 'High',
    img: '/images/fidelity-evening.jpg',
    prompt: 'hard directional light, dramatic shadows, rich reflections',
  },
  {
    id: 'golden',
    recommended: false,
    name: 'Golden Hour',
    desc: 'Warm sunlight with natural shadow.',
    light: 'Warm directional',
    grade: 'Warm teal',
    contrast: 'Medium',
    img: '/images/fidelity-daylight.jpg',
    prompt: 'golden hour warm sunlight, natural shadows',
  },
  {
    id: 'silk',
    recommended: false,
    name: 'Silk Flatlay',
    desc: 'Overhead, fabric and petals.',
    light: 'Overhead soft',
    grade: 'Cream wash',
    contrast: 'Low',
    img: '/images/format-perfume-flatlay.jpg',
    prompt: 'overhead soft flatlay on silk with petals',
  },
  {
    id: 'touch',
    recommended: false,
    name: 'Human Touch',
    desc: 'Hands and real moments, relatable.',
    light: 'Soft window',
    grade: 'Warm natural',
    contrast: 'Low',
    img: '/images/format-perfume-in-hand.jpg',
    prompt: 'soft window light, hands holding product, lifestyle',
  },
  {
    id: 'pop',
    recommended: false,
    name: 'Promo Pop',
    desc: 'Bold color blocks for offers.',
    light: 'Hard flash',
    grade: 'Punchy',
    contrast: 'High',
    img: '/images/campaign-beauty-flatlay.jpg',
    prompt: 'bold color blocks, hard flash promo look',
  },
] as const

export type VisualStyleId = (typeof VISUAL_STYLES)[number]['id']

export const FREEDOM_OPTIONS = [
  {
    id: 'strict',
    level: 1,
    name: 'Strict brand control',
    desc: 'Uses your Brand Kit assets as-is. No new scenes.',
    icon: 'lock',
    img: '/images/fidelity-studio.jpg',
  },
  {
    id: 'min',
    level: 2,
    name: 'Minimal changes',
    desc: 'Only light, background and small details change.',
    icon: 'scan',
    img: '/images/campaign-perfume-studio.jpg',
  },
  {
    id: 'bal',
    level: 3,
    name: 'Balanced',
    desc: 'Thoughtful edits, your photos stay recognizable.',
    icon: 'scale',
    img: '/images/fidelity-daylight.jpg',
  },
  {
    id: 'full',
    level: 4,
    name: 'Full freedom',
    desc: 'New scenes, angles and props for the best result.',
    icon: 'sparkles',
    img: '/images/fidelity-evening.jpg',
  },
] as const

export type FreedomId = (typeof FREEDOM_OPTIONS)[number]['id']

export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    monthly: 9,
    credits: 80,
    tag: 'Light monthly volume',
    recommended: false,
    feats: [
      '80 credits / month',
      'Image + Video Studio + Full Campaign',
      'Products + Library · ZIP export',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthly: 24,
    credits: 250,
    tag: 'Recommended',
    recommended: true,
    feats: [
      '250 credits / month',
      'Brand kit on every generate',
      'Content calendar',
      'ZIP export of your creatives',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    monthly: 49,
    credits: 600,
    tag: 'High volume',
    recommended: false,
    feats: [
      '600 credits / month',
      'Multi-product workflow',
      'Priority support',
    ],
  },
] as const

export const PLAN_SHARED_FEATURES = [
  '1 credit = 1 product image',
  'HeyGen videos from 3 credits · 15s = 8',
  'Formats + optional reference',
  'Full Campaign = images + videos',
  'ZIP export of your creatives',
  'Brand kit on every creative',
] as const

export type PlanId = (typeof PLANS)[number]['id'] | 'free'

export const MIX_VISUALS: Record<ContentMixId, { img: string; shade: string }> = {
  productImage: { img: '/images/fidelity-studio.jpg', shade: 'var(--ink)' },
  carousel: { img: '/images/format-perfume-flatlay.jpg', shade: 'var(--ink-soft)' },
  ugcSelfie: { img: '/images/video-poster-ugc.jpg', shade: 'var(--muted)' },
  sprayAsmr: { img: '/images/video-poster-asmr.jpg', shade: '#71717a' },
  cinematic: { img: '/images/video-poster-cinematic.jpg', shade: '#18181b' },
  aiTestimonial: { img: '/images/video-poster-testimonial.jpg', shade: '#27272a' },
  story: { img: '/images/format-perfume-in-hand.jpg', shade: '#a1a1aa' },
  hookCopy: { img: '/images/format-perfume-promo.jpg', shade: '#d4d4d8' },
}

export function defaultMixCounts(): Record<ContentMixId, number> {
  return Object.fromEntries(
    CONTENT_MIX_TYPES.map((row) => [row.id, row.defaultCount]),
  ) as Record<ContentMixId, number>
}

export const READY_CAMPAIGNS = [
  {
    n: 1,
    strategy: 'Lifestyle',
    title: 'Launch week · brand story',
    theme: 'Your product in the moments that matter',
    status: 'Generating',
    imgs: [
      '/images/fidelity-evening.jpg',
      '/images/format-perfume-in-hand.jpg',
      '/images/video-poster-ugc.jpg',
    ],
  },
  {
    n: 2,
    strategy: 'Product education',
    title: 'How it works',
    theme: 'Notes, ritual and longevity',
    status: '7 assets ready',
    imgs: [
      '/images/format-perfume-flatlay.jpg',
      '/images/fidelity-studio.jpg',
      '/images/format-perfume-promo.jpg',
    ],
  },
  {
    n: 3,
    strategy: 'Social proof',
    title: 'Creator reactions',
    theme: 'UGC selfies and testimonials',
    status: 'Scheduled',
    imgs: [
      '/images/video-poster-testimonial.jpg',
      '/images/video-poster-grwm.jpg',
      '/images/campaign-ugc-serum.jpg',
    ],
  },
  {
    n: 4,
    strategy: 'Offer',
    title: 'Gift set push',
    theme: 'Limited drop with urgency',
    status: 'Generates next week',
    imgs: [
      '/images/campaign-beauty-flatlay.jpg',
      '/images/campaign-perfume-studio.jpg',
      '/images/format-perfume-promo.jpg',
    ],
  },
] as const
