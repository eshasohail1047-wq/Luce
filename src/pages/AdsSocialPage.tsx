import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import StudioPage from './StudioPage'
import PaywallModal from '../components/PaywallModal'
import { useAuth } from '../auth/AuthProvider'
import { listUserProducts, type ProductSummary } from '../lib/campaigns'
import { resolveProductImage } from '../lib/localDemoCampaign'
import { canGenerate } from '../lib/planAccess'
import { requestGenerateCopy } from '../lib/generateCopy'
import { requestGenerateImages } from '../lib/generateImages'
import { saveAssetToLibrary } from '../lib/savedAssets'
import type { MockOutput } from '../lib/mockCampaign'

type GoalId = 'sales' | 'launch' | 'awareness' | 'promotion'
type AngleId = 'problem' | 'desire' | 'social_proof'

type Strategy = {
  customer: string
  problem: string
  motivation: string
  bestAngle: string
  keyMessage: string
  audienceLabel: string
  audienceDetail: string
  platform: string
  platformDetail: string
  format: string
  formatDetail: string
  recommendedHook: string
}

type AngleCard = {
  id: AngleId
  title: string
  description: string
  hook: string
  visual: string
  headline: string
  cta: string
}

type CampaignResult = {
  angleId: AngleId
  angleTitle: string
  imageUrl: string
  hooks: string[]
  headlines: string[]
  primaryText: string
  cta: string
  social: { platform: string; adaptation: string }[]
  usedAiImage: boolean
  usedAiCopy: boolean
}

const DEMO_PRODUCT: ProductSummary = {
  id: 'demo-rose-oud',
  name: 'Rose Oud Perfume',
  category: 'Fragrance',
  brand: 'Maison Luce',
  imageUrl: '/images/fidelity-studio.jpg',
}

const GOALS: { id: GoalId; label: string; icon: 'cart' | 'rocket' | 'eye' | 'tag' }[] = [
  { id: 'sales', label: 'Sales', icon: 'cart' },
  { id: 'launch', label: 'Launch', icon: 'rocket' },
  { id: 'awareness', label: 'Awareness', icon: 'eye' },
  { id: 'promotion', label: 'Promotion', icon: 'tag' },
]

function GoalIcon({ name }: { name: (typeof GOALS)[number]['icon'] }) {
  const c = {
    width: 16,
    height: 16,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }
  if (name === 'cart')
    return (
      <svg {...c}>
        <circle cx="9" cy="20" r="1" />
        <circle cx="17" cy="20" r="1" />
        <path d="M3 4h2l2.2 10.5a1.8 1.8 0 0 0 1.8 1.4h7.6a1.8 1.8 0 0 0 1.8-1.4L20 8H7" />
      </svg>
    )
  if (name === 'rocket')
    return (
      <svg {...c}>
        <path d="M12 3c3 2 5 5 5 9-2 0-4 .5-5 1.5C11 12.5 9 12 7 12c0-4 2-7 5-9Z" />
        <path d="m9 17-2 4" />
        <path d="m15 17 2 4" />
      </svg>
    )
  if (name === 'eye')
    return (
      <svg {...c}>
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="2.5" />
      </svg>
    )
  return (
    <svg {...c}>
      <path d="M12 3H5v7l8.5 8.5a2 2 0 0 0 2.8 0L20 15a2 2 0 0 0 0-2.8L12 3Z" />
      <circle cx="8" cy="8" r="1" />
    </svg>
  )
}

function buildStrategy(product: ProductSummary, goal: GoalId): Strategy {
  const name = product.name || 'this product'
  const brand = product.brand || 'your brand'
  const cat = (product.category || 'beauty').toLowerCase()
  const fragrance = /fragrance|perfume|scent|beauty/.test(cat) || /perfume|oud|fragrance/i.test(name)

  const bestAngle =
    goal === 'sales' || goal === 'promotion'
      ? 'Problem → Solution'
      : goal === 'launch'
        ? 'Lifestyle / Desire'
        : 'Social Proof'

  if (fragrance) {
    return {
      customer: 'Women 25–40 who love luxury fragrances and want a distinctive signature scent.',
      problem: 'They want a sophisticated, long-lasting fragrance that feels unique.',
      motivation: 'Emotional connection, confidence, luxury and receiving compliments.',
      bestAngle: goal === 'awareness' ? 'Social Proof' : goal === 'launch' ? 'Lifestyle / Desire' : bestAngle,
      keyMessage: 'A scent that turns everyday moments into memorable ones.',
      audienceLabel: 'Women, 25–40',
      audienceDetail: 'Interested in fragrance, beauty, luxury and self-care · active on Instagram & TikTok',
      platform: 'Instagram',
      platformDetail: 'Reels + Feed',
      format: 'Video Ad',
      formatDetail: '9:16',
      recommendedHook:
        goal === 'awareness'
          ? 'The fragrance everyone keeps asking about…'
          : goal === 'launch'
            ? 'Smell like you belong in the room.'
            : 'Still looking for a fragrance that actually lasts?',
    }
  }

  return {
    customer: `People who care about ${cat} and want ${name} to feel distinctive — not generic.`,
    problem: `They want something that feels premium and memorable, without guessing what will resonate.`,
    motivation: `Confidence, compliments, and an emotional lift that makes ${name} feel worth it.`,
    bestAngle,
    keyMessage: `${name} turns everyday moments into ones people remember — stay true to ${brand}.`,
    audienceLabel: 'Suggested audience',
    audienceDetail: `Adults 25–40 interested in ${cat}, beauty & lifestyle · active on Instagram & TikTok`,
    platform: 'Instagram',
    platformDetail: 'Reels + Feed',
    format: goal === 'awareness' || goal === 'launch' ? 'Video Ad' : 'Static + Video',
    formatDetail: '9:16',
    recommendedHook: `Still looking for ${name} that actually stands out?`,
  }
}

function buildAngles(product: ProductSummary, offer: string): AngleCard[] {
  const name = product.name || 'your product'
  const claim = offer.trim() ? 'Claim Offer' : 'Shop Now'
  return [
    {
      id: 'problem',
      title: 'Problem / Solution',
      description: 'Show the problem and position your product as the solution.',
      hook: `Still looking for ${name} that actually lasts?`,
      visual: 'Close-up product shot + real-life use.',
      headline: 'Long-lasting luxury.',
      cta: claim,
    },
    {
      id: 'desire',
      title: 'Desire / Lifestyle',
      description: 'Sell the feeling and lifestyle your product creates.',
      hook: 'Smell like you belong in the room.',
      visual: 'Elegant lifestyle setting + product.',
      headline: 'Your signature scent.',
      cta: 'Discover Now',
    },
    {
      id: 'social_proof',
      title: 'Social Proof',
      description: 'Use reviews and customer experiences to build trust.',
      hook: 'The fragrance everyone keeps asking about…',
      visual: 'UGC / review + product.',
      headline: 'Loved by fragrance lovers.',
      cta: claim,
    },
  ]
}

function imageKindForAngle(angle: AngleId) {
  if (angle === 'desire') return 'photo_hand_model' as const
  if (angle === 'social_proof') return 'photo_window_daylight' as const
  return 'photo_moody_editorial' as const
}

/** Route: recreate stays on classic studio; else Ad Lab. */
export function AdsSocialRoute() {
  const [searchParams] = useSearchParams()
  if (searchParams.get('recreate') === '1') {
    return <StudioPage forcedKind="ads" />
  }
  return <AdLabPage />
}

export default function AdLabPage() {
  const { user, plan, freeImageUsed, loading } = useAuth()
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [product, setProduct] = useState<ProductSummary | null>(null)
  const [goal, setGoal] = useState<GoalId>('sales')
  const [luceAudience, setLuceAudience] = useState(true)
  const [audienceEdit, setAudienceEdit] = useState('')
  const [editingAudience, setEditingAudience] = useState(false)
  const [offer, setOffer] = useState('')
  const [selectedAngle, setSelectedAngle] = useState<AngleId | null>(null)
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CampaignResult | null>(null)
  const [paywallOpen, setPaywallOpen] = useState(false)
  const [paywallReason, setPaywallReason] = useState<string | undefined>()
  const [hookCopied, setHookCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await listUserProducts(user.uid)
        const enriched = await Promise.all(
          rows.map(async (row) => {
            const imageUrl = await resolveProductImage(row.id, row.imageUrl)
            return imageUrl ? { ...row, imageUrl } : row
          }),
        )
        if (cancelled) return
        setProducts(enriched)
        setProduct((prev) => prev || enriched[0] || DEMO_PRODUCT)
      } catch {
        if (!cancelled) setProduct((prev) => prev || DEMO_PRODUCT)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user])

  const selected = product || DEMO_PRODUCT
  const strategy = useMemo(() => buildStrategy(selected, goal), [selected, goal])
  const angles = useMemo(() => buildAngles(selected, offer), [selected, offer])
  const audienceText = luceAudience
    ? `${strategy.audienceLabel}: ${strategy.audienceDetail}`
    : audienceEdit || `${strategy.audienceLabel}: ${strategy.audienceDetail}`

  async function copyHook() {
    try {
      await navigator.clipboard.writeText(strategy.recommendedHook)
      setHookCopied(true)
      window.setTimeout(() => setHookCopied(false), 1600)
    } catch {
      /* ignore */
    }
  }

  async function generateForAngle(angleId: AngleId) {
    const angle = angles.find((a) => a.id === angleId)
    if (!angle) return

    const gate = canGenerate({ plan, action: 'ads', freeImageUsed })
    // Always produce strategy creatives; AI when allowed
    const useAi = gate.allowed

    setSelectedAngle(angleId)
    setBusy(true)
    setError(null)
    setResult(null)
    setBusyLabel('Applying marketing angle…')

    try {
      let imageUrl = selected.imageUrl || DEMO_PRODUCT.imageUrl!
      let usedAiImage = false
      let usedAiCopy = false
      let hooks = [angle.hook, strategy.recommendedHook, `${selected.name} — made to be remembered.`]
      let headlines = [angle.headline, `Meet ${selected.name}.`, strategy.keyMessage]
      let primaryText = `${angle.hook} ${strategy.keyMessage}${
        offer.trim() ? ` Offer: ${offer.trim()}.` : ''
      }`
      let cta = angle.cta

      if (useAi) {
        setBusyLabel('Writing copy for this angle…')
        try {
          const copy = await requestGenerateCopy({
            productName: selected.name,
            brand: selected.brand,
            category: selected.category,
            creativeDirection: {
              prompt: `Ad Lab angle: ${angle.title}. Hook style: ${angle.hook}. Goal: ${goal}. Audience: ${audienceText}. Visual: ${angle.visual}. Offer: ${offer || 'none'}.`,
            },
            assets: ['hook', 'caption', 'cta', 'ad_copy', 'hashtags'],
          })
          for (const a of copy.assets) {
            if (a.type === 'hook') hooks = [a.text, ...hooks.filter((h) => h !== a.text)]
            if (a.type === 'ad_copy' || a.type === 'caption') primaryText = a.text
            if (a.type === 'cta') cta = a.text
          }
          usedAiCopy = copy.assets.length > 0
        } catch (err) {
          console.warn('[AdLab] copy failed', err)
        }

        const productImage = selected.imageUrl
        if (productImage && (productImage.startsWith('data:') || productImage.startsWith('http'))) {
          setBusyLabel('Creating visual in Image Studio…')
          try {
            const img = await requestGenerateImages({
              productName: selected.name,
              productImage,
              creativeDirection: {
                prompt: `${angle.visual} Marketing angle: ${angle.title}. Mood matches: ${angle.hook}`,
              },
              assets: [imageKindForAngle(angleId)],
              recreateNote: `Ad Lab · ${angle.title}`,
            })
            const generated = img.assets[0]?.imageDataUrl
            if (generated) {
              imageUrl = generated
              usedAiImage = true
            }
          } catch (err) {
            console.warn('[AdLab] image failed — product still used', err)
          }
        }
      } else if (!gate.allowed) {
        // Free users still get a full strategy kit with product photo
        setBusyLabel('Building preview campaign…')
        await new Promise((r) => setTimeout(r, 500))
      }

      setBusyLabel('Packaging campaign…')
      await new Promise((r) => setTimeout(r, 350))

      const next: CampaignResult = {
        angleId,
        angleTitle: angle.title,
        imageUrl,
        hooks: hooks.slice(0, 5),
        headlines: headlines.slice(0, 4),
        primaryText,
        cta,
        social: [
          {
            platform: 'Instagram',
            adaptation: `${hooks[0]} — Feed/Reels cut with ${angle.visual.toLowerCase()}`,
          },
          {
            platform: 'TikTok',
            adaptation: `Hook-first 9:16 · open on “${hooks[0]}” then reveal ${selected.name}.`,
          },
          {
            platform: 'Facebook',
            adaptation: `${headlines[0]} · primary text + clear “${cta}” for paid placement.`,
          },
        ],
        usedAiImage,
        usedAiCopy,
      }
      setResult(next)
      window.setTimeout(() => {
        document.getElementById('adlab-creatives')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 60)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate campaign.')
    } finally {
      setBusy(false)
      setBusyLabel('')
    }
  }

  async function onMainGenerate() {
    if (!selectedAngle) {
      setError('Pick a marketing angle first — then generate the campaign.')
      document.getElementById('adlab-angles')?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
      return
    }
    await generateForAngle(selectedAngle)
  }

  async function onSave() {
    if (!user || !result) return
    try {
      const campaignId = `adlab-${Date.now()}`
      const items: MockOutput[] = [
        {
          id: 'creative',
          assetType: 'ad_creative',
          label: `${result.angleTitle} creative`,
          kind: 'image',
          imageUrl: result.imageUrl,
        },
        {
          id: 'copy',
          assetType: 'ad_copy',
          label: 'Ad copy',
          kind: 'copy',
          text: [result.primaryText, `CTA: ${result.cta}`, ...result.hooks].join('\n\n'),
        },
      ]
      for (const output of items) {
        await saveAssetToLibrary({
          userId: user.uid,
          campaignId,
          productName: selected.name,
          output,
        })
      }
      setError(null)
      setBusyLabel('Saved to Library')
      window.setTimeout(() => setBusyLabel(''), 1800)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.')
    }
  }

  if (!loading && !user) return <Navigate to="/login" replace />

  return (
    <AppLayout>
      <PaywallModal
        open={paywallOpen}
        title="Unlock Ad Lab"
        reason={paywallReason}
        onClose={() => setPaywallOpen(false)}
      />

      <main className="app-main adlab-page">
        <header className="adlab-hero">
          <div>
            <h1>Ad Lab</h1>
            <p className="adlab-lead">
              Find the message that will make your product impossible to ignore.
            </p>
          </div>
        </header>

        <div className="adlab-layout">
          <div className="adlab-main">
            {/* Product */}
            <section className="adlab-product">
              <img src={selected.imageUrl || DEMO_PRODUCT.imageUrl} alt="" />
              <div>
                <strong>{selected.name}</strong>
                <span>{selected.brand || selected.category || 'Product'}</span>
              </div>
              <button type="button" className="adlab-change" onClick={() => setPickerOpen((v) => !v)}>
                Change
              </button>
            </section>

            {pickerOpen ? (
              <div className="adlab-picker">
                <button
                  type="button"
                  className={selected.id === DEMO_PRODUCT.id ? 'is-on' : undefined}
                  onClick={() => {
                    setProduct(DEMO_PRODUCT)
                    setPickerOpen(false)
                    setResult(null)
                  }}
                >
                  <img src={DEMO_PRODUCT.imageUrl} alt="" />
                  {DEMO_PRODUCT.name}
                </button>
                {products.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={selected.id === p.id ? 'is-on' : undefined}
                    onClick={() => {
                      setProduct(p)
                      setPickerOpen(false)
                      setResult(null)
                    }}
                  >
                    {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <span />}
                    {p.name}
                  </button>
                ))}
                {products.length === 0 ? (
                  <p>
                    No products yet · <Link to="/app/products">Add one</Link>
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* 1. Brief */}
            <section className="adlab-card" aria-labelledby="adlab-brief-title">
              <div className="adlab-card-head">
                <span className="adlab-step">1</span>
                <div>
                  <h2 id="adlab-brief-title">Campaign Brief</h2>
                  <p>Tell LUCE what you&apos;re trying to achieve. We&apos;ll help with the strategy.</p>
                </div>
              </div>

              <div className="adlab-field">
                <span className="adlab-label">Goal</span>
                <div className="adlab-goals" role="radiogroup" aria-label="Goal">
                  {GOALS.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      role="radio"
                      aria-checked={goal === g.id}
                      className={goal === g.id ? 'is-on' : undefined}
                      onClick={() => {
                        setGoal(g.id)
                        setResult(null)
                      }}
                    >
                      <GoalIcon name={g.icon} />
                      {g.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="adlab-field">
                <span className="adlab-label">Audience</span>
                <div className="adlab-audience">
                  <label className={`adlab-suggest${luceAudience ? ' is-on' : ''}`}>
                    <input
                      type="checkbox"
                      checked={luceAudience}
                      onChange={(e) => {
                        setLuceAudience(e.target.checked)
                        if (e.target.checked) setEditingAudience(false)
                      }}
                    />
                    <span>Let LUCE suggest</span>
                  </label>
                  <div className="adlab-audience-box">
                    {editingAudience ? (
                      <textarea
                        rows={2}
                        value={audienceEdit || strategy.audienceDetail}
                        onChange={(e) => setAudienceEdit(e.target.value)}
                        onBlur={() => {
                          setEditingAudience(false)
                          setLuceAudience(false)
                        }}
                      />
                    ) : (
                      <>
                        <p>{audienceText}</p>
                        <button type="button" onClick={() => setEditingAudience(true)}>
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="adlab-field">
                <span className="adlab-label">
                  Offer <em>optional</em>
                </span>
                <input
                  className="adlab-input"
                  value={offer}
                  onChange={(e) => setOffer(e.target.value)}
                  placeholder="e.g. 20% off, free shipping, bundle…"
                />
              </div>
            </section>

            {/* 2. Strategy */}
            <section className="adlab-card" aria-labelledby="adlab-strategy-title">
              <div className="adlab-card-head">
                <span className="adlab-step">2</span>
                <div>
                  <h2 id="adlab-strategy-title">
                    Marketing Strategy
                    <span className="adlab-ai-badge">AI Generated</span>
                  </h2>
                  <p>Based on your product and goal, here&apos;s what LUCE recommends.</p>
                </div>
              </div>

              <div className="adlab-strategy-grid">
                {(
                  [
                    ['Target Customer', strategy.customer],
                    ['Core Problem', strategy.problem],
                    ['Buying Motivation', strategy.motivation],
                    ['Best Angle', strategy.bestAngle],
                    ['Key Message', strategy.keyMessage],
                  ] as const
                ).map(([title, body]) => (
                  <article key={title} className="adlab-insight">
                    <h3>{title}</h3>
                    <p>{body}</p>
                  </article>
                ))}
              </div>
            </section>

            {/* 3. Angles */}
            <section
              className="adlab-card"
              id="adlab-angles"
              aria-labelledby="adlab-angles-title"
            >
              <div className="adlab-card-head">
                <span className="adlab-step">3</span>
                <div>
                  <h2 id="adlab-angles-title">Test 3 Angles</h2>
                  <p>Explore different ways to market the same product — then generate one.</p>
                </div>
              </div>

              <div className="adlab-angles">
                {angles.map((a) => (
                  <article
                    key={a.id}
                    className={`adlab-angle${selectedAngle === a.id ? ' is-selected' : ''}`}
                  >
                    <div className="adlab-angle-top">
                      <img src={selected.imageUrl || DEMO_PRODUCT.imageUrl} alt="" />
                      <div>
                        <h3>{a.title}</h3>
                        <p>{a.description}</p>
                      </div>
                    </div>
                    <dl className="adlab-angle-meta">
                      <div>
                        <dt>Hook</dt>
                        <dd>{a.hook}</dd>
                      </div>
                      <div>
                        <dt>Visual</dt>
                        <dd>{a.visual}</dd>
                      </div>
                      <div>
                        <dt>Headline</dt>
                        <dd>{a.headline}</dd>
                      </div>
                      <div>
                        <dt>CTA</dt>
                        <dd>{a.cta}</dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      className="btn btn-grad adlab-angle-btn"
                      disabled={busy}
                      onClick={() => void generateForAngle(a.id)}
                    >
                      {busy && selectedAngle === a.id
                        ? busyLabel || 'Generating…'
                        : 'Generate this angle →'}
                    </button>
                  </article>
                ))}
              </div>
            </section>

            {error ? (
              <p className="auth-error" role="alert">
                {error}
              </p>
            ) : null}

            {/* Creatives — only after generation */}
            {result && !busy ? (
              <section
                className="adlab-card adlab-creatives"
                id="adlab-creatives"
                aria-labelledby="adlab-creatives-title"
              >
                <div className="adlab-card-head">
                  <span className="adlab-step">4</span>
                  <div>
                    <h2 id="adlab-creatives-title">Campaign Creative</h2>
                    <p>
                      Built from <strong>{result.angleTitle}</strong>
                      {result.usedAiImage || result.usedAiCopy ? ' · AI assisted' : ' · Preview kit'}
                    </p>
                  </div>
                </div>

                <div className="adlab-creative-grid">
                  <figure className="adlab-visual">
                    <img src={result.imageUrl} alt="" />
                    <figcaption>
                      Visual · {result.angleTitle}
                      <Link to="/app/studio/photos">Open Image Studio</Link>
                    </figcaption>
                  </figure>

                  <div className="adlab-copy-panel">
                    <h3>Ad Copy</h3>
                    <p className="adlab-primary">{result.primaryText}</p>
                    <div>
                      <h4>Hooks</h4>
                      <ol>
                        {result.hooks.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ol>
                    </div>
                    <div>
                      <h4>Headlines</h4>
                      <ol>
                        {result.headlines.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ol>
                    </div>
                    <p className="adlab-cta-line">
                      CTA · <strong>{result.cta}</strong>
                    </p>
                  </div>
                </div>

                <div className="adlab-video-row">
                  <div>
                    <h3>Video</h3>
                    <p>
                      Continue this angle in Video Studio for a 9:16 Reel / Short that matches the
                      same hook.
                    </p>
                  </div>
                  <Link className="btn btn-ghost" to="/app/studio/videos?style=ugc">
                    Open Video Studio →
                  </Link>
                </div>

                <div className="adlab-social-adapt">
                  <h3>Social adaptations</h3>
                  <ul>
                    {result.social.map((s) => (
                      <li key={s.platform}>
                        <strong>{s.platform}</strong>
                        <span>{s.adaptation}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="adlab-creative-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => void onSave()}>
                    Save to Library
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => selectedAngle && void generateForAngle(selectedAngle)}
                  >
                    Regenerate
                  </button>
                  <Link className="btn btn-grad" to="/app/campaigns/new">
                    Continue in Full Campaign
                  </Link>
                </div>
              </section>
            ) : null}
          </div>

          {/* Recommends sidebar */}
          <aside className="adlab-side" aria-label="LUCE recommends">
            <div className="adlab-side-inner">
              <h2>What LUCE recommends</h2>
              <p className="adlab-side-sub">Based on your product and goal.</p>

              <div className="adlab-rec">
                <span>Audience</span>
                <p>{audienceText}</p>
              </div>
              <div className="adlab-rec">
                <span>Best Platform</span>
                <p>
                  <strong>{strategy.platform}</strong>
                  <em>{strategy.platformDetail}</em>
                </p>
              </div>
              <div className="adlab-rec">
                <span>Best Format</span>
                <p>
                  <strong>{strategy.format}</strong>
                  <em>{strategy.formatDetail}</em>
                </p>
              </div>
              <div className="adlab-rec adlab-rec-hook">
                <span>Recommended Hook</span>
                <blockquote>{strategy.recommendedHook}</blockquote>
                <button type="button" onClick={() => void copyHook()}>
                  {hookCopied ? 'Copied' : 'Copy'}
                </button>
              </div>

              <button
                type="button"
                className="btn btn-grad adlab-side-cta"
                disabled={busy}
                onClick={() => void onMainGenerate()}
              >
                {busy ? busyLabel || 'Generating…' : '✨ Generate Campaign'}
              </button>
              <p className="adlab-side-note">
                {selectedAngle
                  ? `Using “${angles.find((a) => a.id === selectedAngle)?.title}”.`
                  : 'Select an angle below, then generate.'}
              </p>
              <p className="adlab-why">Smarter marketing. Better results.</p>
            </div>
          </aside>
        </div>
      </main>
    </AppLayout>
  )
}
