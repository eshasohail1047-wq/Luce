import type { CampaignDoc } from './campaigns'

export function relativeTime(campaign: Pick<CampaignDoc, 'updatedAt' | 'createdAt'>) {
  const ms = campaign.updatedAt?.toMillis?.() ?? campaign.createdAt?.toMillis?.()
  if (!ms) return ''
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return '1 day ago'
  if (days < 7) return `${days} days ago`
  if (days < 14) return '1 week ago'
  return `${Math.floor(days / 7)} weeks ago`
}

export function isCampaignComplete(status: string) {
  return status === 'ready' || status === 'exported'
}

export function campaignModeLabel(campaign: Pick<CampaignDoc, 'mode' | 'studioKind'>) {
  if (campaign.mode === 'studio' && campaign.studioKind === 'photos') return 'Images'
  if (campaign.mode === 'studio' && campaign.studioKind === 'videos') return 'Videos'
  if (campaign.mode === 'studio' && campaign.studioKind === 'ads') return 'Ads'
  return 'Campaign'
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    draft: 'Draft',
    product_pending: 'Product pending',
    product_confirmed: 'Ready to generate',
    researching: 'Researching',
    strategy_ready: 'Strategy ready',
    generating: 'Generating',
    ready: 'Ready',
    exported: 'Exported',
    failed: 'Failed',
  }
  return map[status] || status.replaceAll('_', ' ')
}

export function studioPathFor(campaign: Pick<CampaignDoc, 'mode' | 'studioKind'>) {
  if (campaign.mode === 'studio' && campaign.studioKind === 'photos') return '/app/studio/photos'
  if (campaign.mode === 'studio' && campaign.studioKind === 'videos') return '/app/studio/videos'
  if (campaign.mode === 'studio' && campaign.studioKind === 'ads') return '/app/studio/ads'
  return '/app/campaigns/new'
}
