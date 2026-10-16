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
import { statusLabel, studioPathFor } from '../lib/workspaceUi'

type CampaignView = {
  title: string
  status: string
  productName: string
  productId: string
  productUrl?: string
  mode: 'campaign' | 'studio'
  studioKind?: StudioKind
  deliverables: DeliverableId[]
  selectedAssets: string[]
  includeStrategy: boolean
  tryFree: boolean
  imageUrl?: string
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

const STEPS = [
  { id: 'product', label: 'Product' },
  { id: 'generate', label: 'Generate' },
  { id: 'review', label: 'Review' },
  { id: 'export', label: 'Export' },
] as const

function activeStep(status: string) {
  if (status === 'exported') return 3
  if (status === 'ready') return 2
  if (status === 'generating' || status === 'researching' || status === 'strategy_ready') return 1
  return 0
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

        let imageUrl: string | undefined
        const productId = String(data.productId ?? '')
        if (productId) {
          try {
            const productSnap = await getDoc(doc(requireDb(), 'products', productId))
            if (productSnap.exists()) {
              const urls = Array.isArray(productSnap.data().imageUrls)
                ? productSnap.data().imageUrls
                : []
              if (typeof urls[0] === 'string') imageUrl = urls[0]
            }
          } catch {
            /* optional */
          }
        }

        if (!cancelled) {
          setCampaign({
            title: String(data.title ?? 'Campaign'),
            status: String(data.status ?? 'draft'),
            productName: String(data.productName ?? 'Product'),
            productId,
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
            tryFree: Boolean(data.tryFree),
            imageUrl,
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

  const step = campaign ? activeStep(campaign.status) : 0
  const createMorePath = campaign
    ? studioPathFor({ mode: campaign.mode, studioKind: campaign.studioKind })
    : '/app/studio/photos'
  const readyToGenerate =
    campaign &&
    (campaign.status === 'product_confirmed' ||
      campaign.status === 'draft' ||
      campaign.status === 'product_pending')

  return (
    <AppLayout>
      <main className="app-main campaign-create studio-page campaign-detail">
        {error || !campaign ? (
          <div className="dash-empty">
            <p className="auth-error">{error || 'Something went wrong.'}</p>
            <Link className="dash-create-btn dash-create-btn-sm" to="/app/campaigns">
              Back to campaigns
            </Link>
          </div>
        ) : (
          <>
            <header
              className={`create-banner tone-${campaign.mode === 'studio' ? campaign.studioKind || 'campaign' : 'campaign'}`}
            >
              <div className="create-banner-copy">
                <p className="dash-kicker">
                  {campaign.mode === 'studio' ? 'Studio project' : 'Campaign'}
                  {campaign.tryFree ? ' · Free trial' : ''}
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
                {campaign.imageUrl ? (
                  <img src={campaign.imageUrl} alt="" />
                ) : (
                  <img
                    src={
                      campaign.mode === 'studio'
                        ? campaign.studioKind === 'photos'
                          ? '/images/moisturizer-studio.jpg'
                          : campaign.studioKind === 'videos'
                            ? '/images/output-ugc.jpg'
                            : '/images/output-ads.jpg'
                        : '/images/campaign-perfume-studio.jpg'
                    }
                    alt=""
                  />
                )}
              </div>
            </header>

            <ol className="campaign-progress" aria-label="Project progress">
              {STEPS.map((s, i) => (
                <li
                  key={s.id}
                  className={
                    i < step ? 'is-done' : i === step ? 'is-current' : undefined
                  }
                >
                  <span className="campaign-progress-index">{i + 1}</span>
                  <span>{s.label}</span>
                </li>
              ))}
            </ol>

            <div className="campaign-detail-grid">
              <div className="app-panel create-panel">
                <h2>Product</h2>
                <div className="campaign-product-row">
                  {campaign.imageUrl ? (
                    <img className="campaign-product-thumb" src={campaign.imageUrl} alt="" />
                  ) : (
                    <span className="campaign-product-thumb dash-thumb-fallback" aria-hidden="true">
                      {campaign.productName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p>
                      <strong>{campaign.productName}</strong>
                    </p>
                    {campaign.productUrl ? (
                      <p>
                        <a href={campaign.productUrl} target="_blank" rel="noreferrer">
                          View product page
                        </a>
                      </p>
                    ) : (
                      <p className="dash-muted">Uploaded product photo</p>
                    )}
                  </div>
                </div>
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
            </div>

            <div className="app-panel create-panel campaign-next-panel">
              <h2>{readyToGenerate ? 'Ready to generate' : 'Next'}</h2>
              <p>
                {readyToGenerate
                  ? campaign.tryFree && campaign.studioKind === 'photos'
                    ? 'Your free image pack is queued. Generation hooks in next — product fidelity stays locked.'
                    : campaign.mode === 'studio'
                      ? 'Product is confirmed. Generation for this studio project hooks in next.'
                      : 'Product is confirmed. Research, strategy, and creative generation hook in next.'
                  : campaign.status === 'generating'
                    ? 'Assets are generating. This page will show results when the pipeline is connected.'
                    : campaign.status === 'ready' || campaign.status === 'exported'
                      ? 'This project is complete. Open Library for finished packs once exports land.'
                      : 'Continue from Studio or start another project.'}
              </p>
              <div className="detail-actions">
                <Link className="btn btn-grad" to={createMorePath}>
                  {campaign.mode === 'studio' ? 'Create another' : 'New campaign'}
                  <span aria-hidden="true">→</span>
                </Link>
                <Link className="btn btn-ghost" to="/app/campaigns">
                  All campaigns
                </Link>
                <Link className="btn btn-ghost" to="/app">
                  Dashboard
                </Link>
              </div>
            </div>
          </>
        )}
      </main>
    </AppLayout>
  )
}
