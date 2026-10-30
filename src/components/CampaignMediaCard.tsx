import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { CampaignDoc } from '../lib/campaigns'
import {
  campaignModeLabel,
  isCampaignComplete,
  relativeTime,
  statusLabel,
} from '../lib/workspaceUi'

type CampaignMediaCardProps = {
  campaign: CampaignDoc
  imageUrl?: string
  /** Show richer status text (Projects / Saved) */
  showStatusDetail?: boolean
  /** Optional footer actions (e.g. delete) rendered under the media link */
  actions?: ReactNode
}

export default function CampaignMediaCard({
  campaign,
  imageUrl,
  showStatusDetail = false,
  actions,
}: CampaignMediaCardProps) {
  const name = campaign.title || campaign.productName || 'Untitled'
  const done = isCampaignComplete(campaign.status)
  const status = done
    ? 'Done'
    : showStatusDetail
      ? statusLabel(campaign.status)
      : 'In progress'
  const mode = campaignModeLabel(campaign)
  const modeLine = campaign.tryFree ? `${mode} · Free trial` : mode
  const cover = imageUrl?.trim()

  return (
    <article className="ws-card">
      <Link className="ws-card-media" to={`/app/campaigns/${campaign.id}`}>
        {cover ? (
          <img src={cover} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="ws-card-fallback" aria-hidden="true">
            {mode}
          </span>
        )}
        <span className={`ws-card-tag${done ? ' is-done' : ''}`}>{status}</span>
      </Link>
      <div className="ws-card-body">
        <strong>{name}</strong>
        <span>
          {modeLine}
          <span aria-hidden="true"> · </span>
          {relativeTime(campaign)}
        </span>
      </div>
      {actions ? <div className="ws-card-actions">{actions}</div> : null}
    </article>
  )
}
