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
  /** Show richer status text (Campaigns / Library) */
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
    <article className="campaign-media-card">
      <Link className="campaign-media-link" to={`/app/campaigns/${campaign.id}`}>
        <div className="campaign-media-frame">
          {cover ? (
            <img className="campaign-media-img" src={cover} alt="" />
          ) : (
            <span className="campaign-media-soft">{mode}</span>
          )}
          <span className="campaign-media-shade" />
        </div>
        <div className="campaign-media-copy">
          <span
            className={`dash-badge dash-badge-${done ? 'done' : 'progress'} campaign-media-badge`}
          >
            {status}
          </span>
          <strong>{name}</strong>
          <span className="campaign-media-sub">
            {modeLine}
            <span aria-hidden="true"> · </span>
            {relativeTime(campaign)}
          </span>
        </div>
      </Link>
      {actions ? <div className="campaign-media-actions">{actions}</div> : null}
    </article>
  )
}
