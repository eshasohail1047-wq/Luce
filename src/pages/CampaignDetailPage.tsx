import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { doc, getDoc } from 'firebase/firestore'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import { requireDb } from '../lib/firebase'
import {
  AD_STYLES,
  CAMPAIGN_DELIVERABLES,
  PHOTO_STYLES,
  VIDEO_STYLES,
  type DeliverableId,
  type StudioKind,
} from '../lib/deliverables'

type CampaignView = {
  title: string
  status: string
  productName: string
  productUrl?: string
  mode: 'campaign' | 'studio'
  studioKind?: StudioKind
  deliverables: DeliverableId[]
  selectedAssets: string[]
  includeStrategy: boolean
}

function statusLabel(status: string) {
  return status.replaceAll('_', ' ')
}

function assetLabel(id: string) {
  const photo = PHOTO_STYLES.find((s) => s.id === id)
  if (photo) return photo.label
  const video = VIDEO_STYLES.find((s) => s.id === id)
  if (video) return video.label
  const ad = AD_STYLES.find((s) => s.id === id)
  if (ad) return ad.label
  return id.replaceAll('_', ' ')
}

export default function CampaignDetailPage() {
  const { campaignId } = useParams()
  const { user, loading } = useAuth()
  const [campaign, setCampaign] = useState<CampaignView | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    if (!user || !campaignId) return
    let cancelled = false

    ;(async () => {
      try {
        const snap = await getDoc(doc(requireDb(), 'campaigns', campaignId))
        if (!snap.exists()) {
          if (!cancelled) setError('Campaign not found.')
          return
        }
        const data = snap.data()
        if (data.userId !== user.uid) {
          if (!cancelled) setError('You do not have access to this campaign.')
          return
        }
        if (!cancelled) {
          setCampaign({
            title: String(data.title ?? 'Campaign'),
            status: String(data.status ?? 'draft'),
            productName: String(data.productName ?? 'Product'),
            productUrl: data.productUrl ? String(data.productUrl) : undefined,
            mode: data.mode === 'studio' ? 'studio' : 'campaign',
            studioKind: data.studioKind as StudioKind | undefined,
            deliverables: Array.isArray(data.deliverables)
              ? (data.deliverables as DeliverableId[])
              : [],
            selectedAssets: Array.isArray(data.selectedAssets)
              ? data.selectedAssets.map(String)
              : [],
            includeStrategy: Boolean(data.includeStrategy),
          })
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) setError('Could not load this campaign.')
      } finally {
        if (!cancelled) setFetching(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, campaignId])

  if (loading || fetching) {
    return (
      <div className="studio-shell studio-shell-alone">
        <p className="app-loading">Loading…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const packLabels = (() => {
    if (!campaign) return []
    if (campaign.mode === 'studio') {
      return campaign.selectedAssets.map(assetLabel)
    }
    if (campaign.deliverables.length > 0) {
      return CAMPAIGN_DELIVERABLES.filter((d) => campaign.deliverables.includes(d.id)).map(
        (d) => d.label,
      )
    }
    if (campaign.selectedAssets.length > 0) {
      return campaign.selectedAssets.map(assetLabel)
    }
    return []
  })()

  const cover =
    campaign?.mode === 'studio'
      ? campaign.studioKind === 'photos'
        ? '/images/moisturizer-studio.jpg'
        : campaign.studioKind === 'videos'
          ? '/images/output-ugc.jpg'
          : '/images/output-ads.jpg'
      : '/images/campaign-perfume-studio.jpg'

  return (
    <AppLayout>
      <main className="app-main campaign-create studio-page">
        {error || !campaign ? (
          <p className="auth-error">{error || 'Something went wrong.'}</p>
        ) : (
          <>
            <header
              className={`create-banner tone-${campaign.mode === 'studio' ? campaign.studioKind || 'campaign' : 'campaign'}`}
            >
              <div className="create-banner-copy">
                <p className="dash-kicker">
                  {campaign.mode === 'studio' ? 'Studio project' : 'Campaign'}
                </p>
                <div className="dash-card-top" style={{ marginBottom: 8 }}>
                  <span className={`dash-status status-${campaign.status}`}>
                    {statusLabel(campaign.status)}
                  </span>
                </div>
                <h1>{campaign.title}</h1>
                <p className="app-lead">{campaign.productName}</p>
              </div>
              <div className="create-banner-media" aria-hidden="true">
                <img src={cover} alt="" />
              </div>
            </header>

            <div className="app-panel create-panel">
              <h2>Product</h2>
              <p>
                <strong>{campaign.productName}</strong>
              </p>
              {campaign.productUrl ? (
                <p>
                  <a href={campaign.productUrl} target="_blank" rel="noreferrer">
                    View product page
                  </a>
                </p>
              ) : null}
            </div>

            <div className="app-panel create-panel">
              <h2>Included</h2>
              {packLabels.length > 0 ? (
                <ul className="detail-pack-list">
                  {packLabels.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                  {campaign.mode === 'campaign' &&
                    campaign.includeStrategy &&
                    !campaign.deliverables.includes('strategy') && <li>Strategy & research</li>}
                </ul>
              ) : (
                <p>Full default pack</p>
              )}
            </div>

            <div className="app-panel create-panel">
              <h2>Next</h2>
              <p>
                {campaign.mode === 'studio'
                  ? 'Generation for this studio project comes next.'
                  : 'Research, strategy, and creative generation come next.'}
              </p>
              <div className="detail-actions">
                <Link className="btn btn-grad" to="/app/campaigns/new">
                  New campaign
                  <span aria-hidden="true">→</span>
                </Link>
                <Link className="btn btn-ghost" to="/app">
                  Studio
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </AppLayout>
  )
}
