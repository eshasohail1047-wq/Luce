import { useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import StudioPage from './StudioPage'
import PaywallModal from '../components/PaywallModal'
import { useAuth } from '../auth/AuthProvider'
import {
  composeAdPreviewDataUrl,
  ensureAiImagePayload,
  fileToDataUrl,
} from '../lib/localDemoCampaign'
import { canGenerate } from '../lib/planAccess'
import { requestGenerateCopy } from '../lib/generateCopy'
import { requestGenerateImages } from '../lib/generateImages'
import { saveAssetToLibrary } from '../lib/savedAssets'
import type { MockOutput } from '../lib/mockCampaign'

type CreateKind = 'ad' | 'social' | 'carousel' | 'story' | 'reel' | 'launch' | 'offer'
type PlatformId = 'instagram' | 'tiktok' | 'facebook' | 'pinterest'
type ResultTab = 'ad' | 'captions' | 'hooks' | 'headlines' | 'ctas'

type UploadedAsset = {
  url: string
  name: string
  kind: 'image' | 'video'
}

type ResultKit = {
  imageUrl: string
  primaryText: string
  headline: string
  caption: string
  hook: string
  cta: string
  hashtags: string
  captions: string[]
  hooks: string[]
  headlines: string[]
  ctas: string[]
  usedAi: boolean
}

/** Real LUCE gallery images — format-matched previews for each creative type */
const CREATE_OPTIONS: {
  id: CreateKind
  title: string
  sub: string
  image: string
}[] = [
  {
    id: 'ad',
    title: 'Ad Creative',
    sub: 'Paid ad',
    image: '/images/output-ads.jpg',
  },
  {
    id: 'social',
    title: 'Social Post',
    sub: 'Organic',
    image: '/images/output-social.jpg',
  },
  {
    id: 'carousel',
    title: 'Carousel',
    sub: 'Multi-slide',
    image: '/images/hiw-app-formats.jpg',
  },
  {
    id: 'story',
    title: 'Story',
    sub: 'Vertical',
    image: '/images/video-poster-mirror.jpg',
  },
  {
    id: 'reel',
    title: 'Reel / Short',
    sub: 'Short video',
    image: '/images/video-poster-ugc.jpg',
  },
  {
    id: 'launch',
    title: 'Product Launch',
    sub: 'New drop',
    image: '/images/campaign-perfume-studio.jpg',
  },
  {
    id: 'offer',
    title: 'Offer / Sale',
    sub: 'Promotion',
    image: '/images/format-perfume-promo.jpg',
  },
]

const PLATFORMS: { id: PlatformId; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'pinterest', label: 'Pinterest' },
]

const CTA_OPTIONS = ['Shop Now', 'Discover', 'Learn More', 'Get Yours', 'Buy Now'] as const
const BUSY = ['Reading your image…', 'Writing copy…', 'Designing the ad…', 'Finishing captions…']

function createLabel(id: CreateKind) {
  return CREATE_OPTIONS.find((c) => c.id === id)?.title ?? 'Ad Creative'
}

function fallbackCopy(name: string, cta: string, prompt: string) {
  const scent = /perfume|fragrance|scent|oud|rose/i.test(name)
  const vibe = prompt.trim()
    ? prompt.trim().slice(0, 120)
    : scent
      ? 'a sophisticated blend of warm oud and delicate rose'
      : `a scroll-stopping look for ${name}`
  return {
    primaryText: `Discover ${name} — ${vibe}.`,
    headline: scent ? 'Meet Your New Signature Scent' : `Meet ${name}`,
    caption: scent
      ? `A scent that stays with you. ✨\n\n${name}.`
      : `${name} — made to stand out. ✨`,
    hook: scent ? 'POV: You finally found your signature scent.' : `POV: You found ${name}.`,
    cta: cta || 'Shop Now',
    hashtags: scent ? '#LuxuryFragrance #LUCE' : '#LUCE #AdsAndSocial',
  }
}

function Icon({
  name,
  size = 18,
}: {
  name: 'plus' | 'check' | 'spark' | 'upload' | 'image' | 'video' | PlatformId
  size?: number
}) {
  const c = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
  if (name === 'plus')
    return (
      <svg {...c}>
        <path d="M12 5v14M5 12h14" />
      </svg>
    )
  if (name === 'check')
    return (
      <svg {...c} strokeWidth={2.4}>
        <path d="m6 12 4 4 8-8" />
      </svg>
    )
  if (name === 'spark')
    return (
      <svg {...c}>
        <path d="m12 3 1.2 3.8L17 8l-3.8 1.2L12 13l-1.2-3.8L7 8l3.8-1.2L12 3Z" />
        <path d="M5 16h4M15 16h4M7 20h10" />
      </svg>
    )
  if (name === 'upload')
    return (
      <svg {...c}>
        <path d="M12 16V7M8.5 10.5 12 7l3.5 3.5" />
        <path d="M5 18h14" />
      </svg>
    )
  if (name === 'image')
    return (
      <svg {...c}>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <circle cx="8.5" cy="10" r="1.4" />
        <path d="m21 15-4.5-4.5L7 20" />
      </svg>
    )
  if (name === 'video')
    return (
      <svg {...c}>
        <rect x="3" y="6" width="13" height="12" rx="2" />
        <path d="m16 10 5-3v10l-5-3v-4Z" />
      </svg>
    )
  if (name === 'instagram')
    return (
      <svg {...c}>
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    )
  if (name === 'tiktok')
    return (
      <svg {...c}>
        <path d="M14 4v9.2a3.8 3.8 0 1 1-3.2-3.75V13" />
        <path d="M14 7.5c1.4 1.2 3 1.9 4.8 2" />
      </svg>
    )
  if (name === 'facebook')
    return (
      <svg {...c}>
        <path d="M14 9h3V6h-3c-2.2 0-4 1.8-4 4v2H8v3h2v6h3v-6h2.2l.8-3H13v-2c0-.6.4-1 1-1Z" />
      </svg>
    )
  return (
    <svg {...c}>
      <circle cx="12" cy="12" r="9" />
      <path d="M10.5 19.5 12 13c-1.5 0-2.5-1-2.5-2.4 0-1.5 1.2-2.6 2.8-2.6 1.5 0 2.4.9 2.4 2.3 0 1.8-1 3.1-2 3.1-.5 0-.9-.3-1-.8l-.5 2Z" />
    </svg>
  )
}

/** Ads & Social is post-MVP — keep recreate for library, otherwise send to Full Campaign. */
export function AdsSocialRoute() {
  const [searchParams] = useSearchParams()
  if (searchParams.get('recreate') === '1') return <StudioPage forcedKind="ads" />
  return <Navigate to="/app/campaigns/new" replace />
}

export default function AdsSocialPage() {
  const { user, plan, freeImageUsed, loading } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const refFileRef = useRef<HTMLInputElement>(null)

  const [asset, setAsset] = useState<UploadedAsset | null>(null)
  const [createKind, setCreateKind] = useState<CreateKind>('ad')
  const [platforms, setPlatforms] = useState<PlatformId[]>(['instagram'])
  const [prompt, setPrompt] = useState('')
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null)
  const [cta, setCta] = useState('Shop Now')
  const [customCta, setCustomCta] = useState('')
  const [useCustomCta, setUseCustomCta] = useState(false)

  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResultKit | null>(null)
  const [resultTab, setResultTab] = useState<ResultTab>('ad')
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [paywallReason, setPaywallReason] = useState<string | undefined>()
  const [savedOk, setSavedOk] = useState(false)

  const effectiveCta = useCustomCta ? customCta.trim() || 'Shop Now' : cta
  const productName = asset?.name || 'Your product'

  async function onUpload(file: File | null) {
    if (!file) return
    try {
      const url = await fileToDataUrl(file)
      setAsset({
        url,
        name: file.name.replace(/\.[^.]+$/, '') || 'My product',
        kind: file.type.startsWith('video/') ? 'video' : 'image',
      })
      setResult(null)
      setError(null)
    } catch {
      setError('Could not read that file.')
    }
  }

  async function onReference(file: File | null) {
    if (!file) return
    try {
      setReferenceUrl(await fileToDataUrl(file))
    } catch {
      setError('Could not read reference.')
    }
  }

  function togglePlatform(id: PlatformId) {
    setPlatforms((prev) => {
      if (prev.includes(id)) return prev.length === 1 ? prev : prev.filter((p) => p !== id)
      return [...prev, id]
    })
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      /* ignore */
    }
  }

  async function generate() {
    if (!asset) {
      setError('Upload a product image first.')
      return
    }

    const gate = canGenerate({ plan, action: 'ads', freeImageUsed })
    const useAi = gate.allowed

    setBusy(true)
    setError(null)
    setResult(null)
    setSavedOk(false)
    setResultTab('ad')

    let step = 0
    setBusyLabel(BUSY[0])
    const tick = window.setInterval(() => {
      step = Math.min(step + 1, BUSY.length - 1)
      setBusyLabel(BUSY[step])
    }, 800)

    try {
      const still = asset.url
      let imageUrl = still
      let usedAi = false
      let copy = fallbackCopy(productName, effectiveCta, prompt)

      const direction = [
        `Create: ${createLabel(createKind)}.`,
        `Platforms: ${platforms.join(', ')}.`,
        `CTA: ${effectiveCta}.`,
        prompt.trim() ? `Prompt: ${prompt.trim()}` : 'Infer from product.',
        'Keep product identity exact. Reference is style only.',
      ].join(' ')

      if (useAi) {
        setBusyLabel('Writing copy…')
        try {
          const res = await requestGenerateCopy({
            productName,
            creativeDirection: { prompt: direction },
            assets: ['ad_copy', 'hook', 'caption', 'cta', 'hashtags'],
            recreateNote: `Ads & Social · ${createLabel(createKind)}`,
          })
          for (const a of res.assets) {
            if (a.type === 'ad_copy') {
              copy.primaryText = a.text
              const line = a.text.split(/[.\n]/)[0]?.trim()
              if (line && line.length >= 8 && line.length <= 72) copy.headline = line
            }
            if (a.type === 'caption') copy.caption = a.text
            if (a.type === 'hook') copy.hook = a.text
            if (a.type === 'cta' && !useCustomCta) copy.cta = a.text
            if (a.type === 'hashtags') copy.hashtags = a.text
          }
          copy.cta = effectiveCta
        } catch (err) {
          console.warn('[Ads] copy', err)
        }

        setBusyLabel('Designing the ad…')
        try {
          const productImage = await ensureAiImagePayload(still)
          const referenceImage = referenceUrl?.startsWith('data:image/')
            ? await ensureAiImagePayload(referenceUrl)
            : undefined
          const img = await requestGenerateImages({
            productName,
            productImage,
            referenceImage,
            creativeDirection: {
              prompt: direction,
              mood: 'premium_clean',
              styleTheme: 'luxury_beauty',
            },
            assets: ['ad_creative'],
            recreateNote: `Ads & Social · ${createLabel(createKind)}`,
          })
          if (img.assets[0]?.imageDataUrl) {
            imageUrl = img.assets[0].imageDataUrl
            usedAi = true
          }
        } catch (err) {
          console.warn('[Ads] image', err)
          setError(
            (err instanceof Error ? err.message : 'Image failed') +
              ' — showing a local ad preview.',
          )
        }
      } else if (gate.needsPaywall) {
        setPaywallReason(gate.reason)
      }

      if (!usedAi) {
        try {
          imageUrl = await composeAdPreviewDataUrl({
            imageUrl: still,
            headline: copy.hook || copy.headline,
            cta: copy.cta,
          })
        } catch {
          imageUrl = still
        }
      }

      setResult({
        imageUrl,
        primaryText: copy.primaryText,
        headline: copy.headline,
        caption: copy.caption,
        hook: copy.hook,
        cta: copy.cta,
        hashtags: copy.hashtags,
        captions: [copy.caption, copy.primaryText, `${copy.headline}\n\n${copy.hashtags}`],
        hooks: [
          copy.hook,
          `Still thinking about ${productName}?`,
          /perfume|fragrance|scent|oud|rose/i.test(productName)
            ? 'One spray. Instant presence.'
            : `Make ${productName} impossible to ignore.`,
        ],
        headlines: [copy.headline, `Meet ${productName}`, copy.hook].filter(
          (v, i, arr) => arr.indexOf(v) === i,
        ),
        ctas: [copy.cta, ...CTA_OPTIONS.filter((x) => x !== copy.cta)].slice(0, 5),
        usedAi,
      })
      window.setTimeout(() => {
        document.getElementById('ads-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 40)
      if (!useAi && gate.needsPaywall) {
        window.setTimeout(() => setPaywallOpen(true), 1200)
      }
    } finally {
      window.clearInterval(tick)
      setBusy(false)
      setBusyLabel('')
    }
  }

  async function saveResult() {
    if (!user || !result) return
    const campaignId = `ads-${Date.now()}`
    const outputs: MockOutput[] = [
      {
        id: 'img',
        kind: 'image',
        assetType: 'ad_creative',
        label: 'Ad',
        imageUrl: result.imageUrl,
      },
      {
        id: 'cap',
        kind: 'copy',
        assetType: 'caption',
        label: 'Caption',
        text: result.caption,
      },
      { id: 'hook', kind: 'copy', assetType: 'hook', label: 'Hook', text: result.hook },
      { id: 'cta', kind: 'copy', assetType: 'cta', label: 'CTA', text: result.cta },
    ]
    for (const output of outputs) {
      await saveAssetToLibrary({
        userId: user.uid,
        campaignId,
        productName,
        output,
      })
    }
    setSavedOk(true)
  }

  function download() {
    if (!result) return
    const a = document.createElement('a')
    a.href = result.imageUrl
    a.download = 'luce-ad.jpg'
    a.click()
  }

  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  return (
    <AppLayout>
      <PaywallModal
        open={paywallOpen}
        title="Unlock Ads & Social"
        reason={paywallReason}
        onClose={() => setPaywallOpen(false)}
      />

      <main className="app-main adsv-page">
        <header className="adsv-hero">
          <div>
            <h1>Ads & Social</h1>
            <p className="adsv-lead">Turn your product into scroll-stopping content.</p>
          </div>
          <p className="adsv-doodle" aria-hidden>
            <span>↗</span> Same product. More possibilities.
          </p>
        </header>

        {/* 1 — Upload only */}
        <section className="adsv-panel">
          <div className="adsv-panel-top">
            <span className="adsv-step">1</span>
            <h2>Upload your image</h2>
          </div>

          {!asset ? (
            <button
              type="button"
              className="adsv-upload"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                void onUpload(e.dataTransfer.files?.[0] ?? null)
              }}
            >
              <span className="adsv-upload-ico">
                <Icon name="upload" size={26} />
              </span>
              <strong>+ Upload image</strong>
              <span>Photo or video from your device</span>
            </button>
          ) : (
            <div className="adsv-uploaded">
              <div className="adsv-uploaded-media">
                {asset.kind === 'video' ? (
                  <video src={asset.url} muted playsInline />
                ) : (
                  <img src={asset.url} alt="" />
                )}
                <span className="adsv-uploaded-badge">
                  <Icon name={asset.kind === 'video' ? 'video' : 'image'} size={12} />
                </span>
              </div>
              <div className="adsv-uploaded-meta">
                <strong>{asset.name}</strong>
                <span>Ready to turn into an ad</span>
                <div className="adsv-uploaded-actions">
                  <button type="button" className="btn" onClick={() => fileRef.current?.click()}>
                    Replace
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setAsset(null)
                      setResult(null)
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={(e) => {
              void onUpload(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
        </section>

        {/* 2 — What to create (real format images) */}
        <section className="adsv-panel">
          <div className="adsv-panel-top">
            <span className="adsv-step">2</span>
            <h2>What do you want to create?</h2>
          </div>
          <div className="adsv-kinds">
            {CREATE_OPTIONS.map((opt) => {
              const on = createKind === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`adsv-kind${on ? ' is-on' : ''}`}
                  onClick={() => {
                    setCreateKind(opt.id)
                    setResult(null)
                  }}
                >
                  <div className="adsv-kind-pic">
                    <img src={opt.image} alt="" />
                  </div>
                  <strong>{opt.title}</strong>
                  <span>{opt.sub}</span>
                  {on ? (
                    <span className="adsv-kind-check">
                      <Icon name="check" size={12} />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>

        {/* 3 — Platform */}
        <section className="adsv-panel">
          <div className="adsv-panel-top">
            <span className="adsv-step">3</span>
            <h2>Choose platform</h2>
          </div>
          <div className="adsv-platforms">
            {PLATFORMS.map((p) => {
              const on = platforms.includes(p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`adsv-plat${on ? ' is-on' : ''}`}
                  onClick={() => togglePlatform(p.id)}
                >
                  <span className="adsv-plat-ico">
                    <Icon name={p.id} />
                  </span>
                  <strong>{p.label}</strong>
                  {on ? (
                    <span className="adsv-plat-check">
                      <Icon name="check" size={12} />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        </section>

        {/* 4 — Prompt + reference */}
        <section className="adsv-panel">
          <div className="adsv-panel-top">
            <span className="adsv-step">4</span>
            <h2>Prompt & reference</h2>
            <em className="adsv-opt">Optional</em>
          </div>
          <div className="adsv-duo">
            <div className="adsv-box">
              <h3>Prompt</h3>
              <textarea
                rows={4}
                maxLength={300}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g. Make it luxurious, add 20% OFF and a Shop Now CTA…"
              />
              <div className="adsv-count">{prompt.length}/300</div>
            </div>
            <div className="adsv-box">
              <h3>Reference</h3>
              <p className="adsv-hint">Inspiration only — keeps your product</p>
              {referenceUrl?.startsWith('data:image/') ? (
                <div className="adsv-ref">
                  <img src={referenceUrl} alt="" />
                  <button type="button" onClick={() => setReferenceUrl(null)}>
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="adsv-ref-drop"
                  onClick={() => refFileRef.current?.click()}
                >
                  <Icon name="plus" size={20} />
                  <strong>+ Add reference</strong>
                </button>
              )}
              <input
                ref={refFileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  void onReference(e.target.files?.[0] ?? null)
                  e.target.value = ''
                }}
              />
            </div>
          </div>
        </section>

        {/* 5 — CTA */}
        <section className="adsv-panel">
          <div className="adsv-panel-top">
            <span className="adsv-step">5</span>
            <h2>CTA</h2>
          </div>
          <div className="adsv-ctas">
            {CTA_OPTIONS.map((c) => (
              <button
                key={c}
                type="button"
                className={!useCustomCta && cta === c ? 'is-on' : undefined}
                onClick={() => {
                  setCta(c)
                  setUseCustomCta(false)
                }}
              >
                {c}
              </button>
            ))}
            <button
              type="button"
              className={`adsv-cta-custom${useCustomCta ? ' is-on' : ''}`}
              onClick={() => setUseCustomCta(true)}
            >
              + Custom
            </button>
          </div>
          {useCustomCta ? (
            <input
              className="adsv-input"
              value={customCta}
              onChange={(e) => setCustomCta(e.target.value)}
              placeholder="Your CTA…"
              autoFocus
            />
          ) : null}
        </section>

        <button
          type="button"
          className="btn btn-grad adsv-go"
          disabled={busy || !asset}
          onClick={() => void generate()}
        >
          <Icon name="spark" size={18} />
          {busy ? busyLabel || 'Creating…' : 'Create Ad'}
        </button>
        {error ? <p className="adsv-error">{error}</p> : null}

        {result ? (
          <section className="adsv-panel adsv-result" id="ads-result">
            <div className="adsv-panel-top">
              <span className="adsv-step">✓</span>
              <h2>Your result</h2>
              <span className="adsv-result-meta">
                {createLabel(createKind)} · {platforms.join(' · ')}
              </span>
            </div>

            <div className="adsv-result-tabs">
              {(
                [
                  ['ad', 'Ad / Post'],
                  ['captions', 'Captions'],
                  ['hooks', 'Hooks'],
                  ['headlines', 'Headlines'],
                  ['ctas', 'CTAs'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={resultTab === id ? 'is-on' : undefined}
                  onClick={() => setResultTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {resultTab === 'ad' ? (
              <div className="adsv-result-ad">
                <figure>
                  <img src={result.imageUrl} alt="Ad" />
                </figure>
                <div className="adsv-result-side">
                  <div className="adsv-chip-line">
                    <em>Headline</em>
                    <p>{result.headline}</p>
                  </div>
                  <div className="adsv-chip-line">
                    <em>CTA</em>
                    <p>{result.cta}</p>
                  </div>
                  <div className="adsv-result-actions">
                    <button type="button" className="btn" onClick={download}>
                      Download
                    </button>
                    <button type="button" className="btn" onClick={() => void saveResult()}>
                      {savedOk ? 'Saved' : 'Save'}
                    </button>
                    <button type="button" className="btn btn-grad" onClick={() => void generate()}>
                      Regenerate
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <ul className="adsv-lines">
                {(resultTab === 'captions'
                  ? [...result.captions, result.hashtags]
                  : resultTab === 'hooks'
                    ? result.hooks
                    : resultTab === 'headlines'
                      ? result.headlines
                      : result.ctas
                ).map((t, i) => (
                  <li key={`${resultTab}-${i}`}>
                    <p>{t}</p>
                    <button type="button" className="btn" onClick={() => void copyText(t)}>
                      Copy
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}
      </main>
    </AppLayout>
  )
}
