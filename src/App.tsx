import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Logo from './Logo'
import UgcReel from './UgcReel'
import './App.css'

const navLinks = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#outputs', label: 'What you get' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
]

const faqs = [
  {
    tag: 'Getting started',
    q: 'What do I need to start a campaign?',
    a: 'A product URL (Shopify or any product page) or a few clear product photos. LUCE builds research, strategy, and creative from that single source.',
  },
  {
    tag: 'Fidelity',
    q: 'Will my product look the same across every asset?',
    a: 'Yes. Packaging, shape, color, and label stay faithful. We change scene and lighting — not the product — so studio, UGC, social, and ads stay consistent.',
  },
  {
    tag: 'Deliverables',
    q: 'What’s included in a campaign pack?',
    a: 'Research-backed strategy, studio and lifestyle visuals, UGC-style clips, social captions, and ad creatives — exported as a downloadable ZIP ready to publish.',
  },
  {
    tag: 'Publishing',
    q: 'Does LUCE publish to my channels automatically?',
    a: 'Not in MVP. You review assets, regenerate anything you want, then download and publish manually to Instagram, TikTok, Meta, or your store.',
  },
  {
    tag: 'Pricing',
    q: 'Is the first campaign really free?',
    a: 'Yes. Start free with no card required. Upgrade when you need more campaigns, regenerations, or team seats.',
  },
  {
    tag: 'Audience',
    q: 'Who is LUCE built for?',
    a: 'Shopify, e-commerce, and DTC brands selling physical products — especially teams that need regular, on-brand creative without a full production crew.',
  },
]

const HERO_PRODUCT = {
  image: '/images/campaign-perfume-studio.jpg',
  name: 'Rose Oud Perfume',
}

/** One UGC video per side */
const HERO_SIDES = {
  left: [
    {
      src: '/videos/ugc-skincare-ringlight.mp4',
      poster: '/images/moisturizer-ugc-poster.jpg',
      rot: -5,
    },
  ],
  right: [
    {
      src: '/videos/perfume-1.mp4',
      poster: '/images/campaign-perfume-studio.jpg',
      rot: 5,
    },
  ],
}

/** Same Rose Oud bottle — real location / lighting shoots only (no bottle recolor) */
const PRODUCT_LIGHTS = [
  {
    src: '/images/fidelity-daylight.jpg',
    label: 'Daylight location',
    tone: 'daylight',
  },
  {
    src: '/images/fidelity-studio.jpg',
    label: 'Studio softbox',
    tone: 'studio',
  },
  {
    src: '/images/fidelity-evening.jpg',
    label: 'Evening set',
    tone: 'evening',
  },
]

const workflow = [
  {
    step: '01',
    title: 'Create campaign & add product',
    text: 'Start a campaign, then paste a Shopify URL or upload product photos with basic info.',
    image: '/images/hiw-add-product.jpg',
    panel: {
      label: 'Create campaign',
      title: 'Add your product',
      lines: ['Paste product URL', 'or upload images + details'],
    },
  },
  {
    step: '02',
    title: 'Confirm what LUCE understood',
    text: 'Review name, features, category, and visuals — edit or confirm so every asset stays true to the real product.',
    image: '/images/hiw-confirm-product.jpg',
    panel: {
      label: 'Product confirmation',
      title: 'Hydrate Clinical',
      lines: ['Skincare · Moisturizer', 'Confirmed · Ready to research'],
    },
  },
  {
    step: '03',
    title: 'Research & build strategy',
    text: 'LUCE researches market, competitors, and trends — then defines audience, positioning, angle, message, and CTA.',
    image: '/images/hiw-research-strategy.jpg',
    panel: {
      label: 'Research → Strategy',
      title: 'Campaign brief',
      lines: ['Market · Competitors · Trends', 'Audience · Angle · CTA'],
    },
  },
  {
    step: '04',
    title: 'Generate, review & download',
    text: 'Generate the full pack — visuals, videos, social, ads, and strategy — then download a ZIP and publish manually.',
    image: '/images/hiw-generate-download.jpg',
    panel: {
      label: 'Campaign pack',
      title: 'Ready to export',
      lines: ['Visuals · UGC · Ads · Copy', 'ZIP download · Manual publish'],
    },
  },
]

const trustMarks = [
  'Shopify brands',
  'DTC teams',
  'Beauty',
  'Skincare',
  'Perfume',
  'Accessories',
]

const outputs = [
  {
    title: 'Product visuals',
    tag: 'Photos',
    text: 'Studio, lifestyle, and promo stills with packaging kept exact.',
    image: '/images/output-visuals.jpg',
    featured: true,
  },
  {
    title: 'Creator videos',
    tag: 'UGC',
    text: 'Reel-ready clips that show the real product in motion.',
    image: '/images/output-ugc.jpg',
    featured: false,
  },
  {
    title: 'Social content',
    tag: 'Copy',
    text: 'Hooks, captions, CTAs, and hashtags in one brand voice.',
    image: '/images/output-social.jpg',
    featured: false,
  },
  {
    title: 'Ads & strategy',
    tag: 'Paid',
    text: 'Ad creatives plus audience, angle, message, and CTA.',
    image: '/images/output-ads.jpg',
    featured: false,
  },
  {
    title: 'Campaign export',
    tag: 'ZIP',
    text: 'One downloadable pack — ready to publish across channels.',
    image: '/images/output-export.jpg',
    featured: false,
  },
]

const audiences = [
  {
    title: 'Shopify brands',
    tag: 'Catalog',
    text: 'Paste a product URL and turn catalog pages into full campaign packs.',
    image: '/images/audience-shopify.jpg',
  },
  {
    title: 'DTC founders',
    tag: 'Growth',
    text: 'Ship weekly creative without hiring a full studio or agency.',
    image: '/images/audience-dtc.jpg',
  },
  {
    title: 'Beauty & skincare',
    tag: 'Fidelity',
    text: 'Keep bottle, label, and texture true across every asset.',
    image: '/images/audience-beauty.jpg',
  },
  {
    title: 'Perfume & lifestyle',
    tag: 'Lifestyle',
    text: 'Build coherent campaigns for physical products that need fidelity.',
    image: '/images/audience-perfume.jpg',
  },
]

const features = [
  {
    n: '01',
    title: 'Product as source of truth',
    text: 'Confirm the real product first — shape, label, and packaging stay faithful across every asset.',
  },
  {
    n: '02',
    title: 'Research before creative',
    text: 'Market, competitor, and trend context so assets aren’t disconnected AI shots.',
  },
  {
    n: '03',
    title: 'Strategy-led generation',
    text: 'Audience, positioning, angle, and CTA lock before visuals, UGC, social, and ads.',
  },
  {
    n: '04',
    title: 'True-to-product fidelity',
    text: 'Change the scene and light, never the bottle — softbox moods without distorting packaging.',
  },
  {
    n: '05',
    title: 'One coherent campaign',
    text: 'Photos, videos, copy, and ads share one product identity and one message.',
  },
  {
    n: '06',
    title: 'Review, refine, download',
    text: 'Preview, regenerate individual assets, then export a complete ZIP ready to publish.',
  },
]

const pricingPlans = [
  {
    name: 'Free',
    tagline: 'Explore the workflow',
    monthly: 0,
    yearly: 0,
    cta: 'Start free',
    featured: false,
    perks: [
      '1 product campaign',
      '3 studio product photos',
      '1 UGC-style clip',
      'Basic social captions',
      'Watermarked exports',
    ],
  },
  {
    name: 'Starter',
    tagline: 'Launch your first campaigns',
    monthly: 29,
    yearly: 23,
    cta: 'Choose Starter',
    featured: false,
    perks: [
      '5 campaigns / month',
      'Studio + lifestyle photos',
      '3 UGC videos / campaign',
      'Social captions & hooks',
      'ZIP export, no watermark',
      '1 workspace',
    ],
  },
  {
    name: 'Growth',
    tagline: 'Ship campaigns every week',
    monthly: 79,
    yearly: 63,
    cta: 'Choose Growth',
    featured: true,
    perks: [
      '20 campaigns / month',
      'Full photo + UGC suite',
      'Ad creatives included',
      'Priority generation',
      '3 workspaces',
      'Brand tone presets',
    ],
  },
  {
    name: 'Pro',
    tagline: 'Scale creative production',
    monthly: 149,
    yearly: 119,
    cta: 'Choose Pro',
    featured: false,
    perks: [
      'Unlimited campaigns',
      'Unlimited regenerations',
      'Multi-product packs',
      'Team seats (5)',
      'Early feature access',
      'Priority support',
    ],
  },
]

function FaqList() {
  const [open, setOpen] = useState<number | null>(0)

  return (
    <div className="faq-list">
      {faqs.map((item, i) => {
        const isOpen = open === i
        const n = String(i + 1).padStart(2, '0')
        return (
          <div key={item.q} className={`faq-item ${isOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="faq-q"
              aria-expanded={isOpen}
              aria-controls={`faq-a-${i}`}
              id={`faq-q-${i}`}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span className="faq-index" aria-hidden="true">
                {n}
              </span>
              <span className="faq-q-main">
                <span className="faq-tag">{item.tag}</span>
                <span className="faq-q-text">{item.q}</span>
              </span>
              <span className="faq-icon" aria-hidden="true">
                <svg viewBox="0 0 20 20" width="14" height="14" fill="none">
                  <path
                    d="M5 7.5L10 12.5L15 7.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </button>
            <div
              id={`faq-a-${i}`}
              role="region"
              aria-labelledby={`faq-q-${i}`}
              className="faq-a"
            >
              <div className="faq-a-inner">
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function useAutoplayVideo(src: string) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    const play = () => {
      void video.play().catch(() => {})
    }
    play()
    video.addEventListener('loadeddata', play)
    return () => video.removeEventListener('loadeddata', play)
  }, [src])

  return videoRef
}

function HeroSideCard({
  clip,
  index,
}: {
  clip: (typeof HERO_SIDES.left)[number]
  index: number
}) {
  const videoRef = useAutoplayVideo(clip.src)

  return (
    <div
      className={`hero-side-card hero-side-card-${index}`}
      style={{ '--side-rot': `${clip.rot}deg` } as CSSProperties}
    >
      <div className="hero-side-phone">
        <video
          ref={videoRef}
          src={clip.src}
          poster={clip.poster}
          muted
          playsInline
          loop
          autoPlay
          preload="auto"
        />
      </div>
    </div>
  )
}

function Reveal({
  children,
  className = '',
  as = 'div',
  delay = 0,
}: {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'article' | 'li' | 'section'
  delay?: number
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          obs.disconnect()
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -10% 0px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const props = {
    ref: ref as never,
    className: `reveal ${visible ? 'reveal-in' : ''} ${className}`.trim(),
    style: { transitionDelay: `${delay}ms` },
  }

  if (as === 'article') return <article {...props}>{children}</article>
  if (as === 'li') return <li {...props}>{children}</li>
  if (as === 'section') return <section {...props}>{children}</section>
  return <div {...props}>{children}</div>
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

function ScrollPhrase() {
  const ref = useRef<HTMLElement | null>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const travel = Math.max(1, el.offsetHeight - window.innerHeight)
      setProgress(clamp(-rect.top / travel, 0, 1))
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const line1Opacity = clamp(1 - (progress - 0.22) / 0.28, 0, 1)
  const line2Opacity = clamp((progress - 0.38) / 0.28, 0, 1)

  return (
    <section className="phrase" ref={ref as never} aria-label="Campaign promise">
      <div className="phrase-pin">
        <h2 className="phrase-line phrase-line-1" style={{ opacity: line1Opacity }}>
          Stop juggling five AI tools for one campaign
        </h2>
        <h2 className="phrase-line phrase-line-2" style={{ opacity: line2Opacity }}>
          One product. Research. Strategy. Complete campaign.
        </h2>
      </div>
    </section>
  )
}

function HowItWorks() {
  const sectionRef = useRef<HTMLElement | null>(null)
  const stepsRef = useRef<(HTMLElement | null)[]>([])
  const [active, setActive] = useState(0)
  const [railFill, setRailFill] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const steps = stepsRef.current.filter(Boolean) as HTMLElement[]
      if (!steps.length) return

      const focusY = window.innerHeight * 0.42
      let best = 0
      let bestDist = Infinity
      steps.forEach((el, i) => {
        const mid = el.getBoundingClientRect().top + el.offsetHeight / 2
        const dist = Math.abs(mid - focusY)
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      })
      setActive(best)

      const first = steps[0].getBoundingClientRect()
      const last = steps[steps.length - 1].getBoundingClientRect()
      const start = first.top + window.scrollY
      const end = last.top + window.scrollY + last.height * 0.35
      const current = window.scrollY + focusY
      setRailFill(clamp((current - start) / Math.max(1, end - start), 0, 1))
    }

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <section
      className="hiw"
      id="how-it-works"
      ref={sectionRef as never}
      aria-labelledby="workflow-title"
    >
      <div className="hiw-inner">
        <Reveal className="section-head hiw-head">
          <p className="eyebrow">Workflow</p>
          <h2 id="workflow-title">How it works</h2>
          <p>One product → Research → Strategy → Complete campaign</p>
        </Reveal>

        <div className="hiw-grid">
          <div className="hiw-sticky" aria-hidden="true">
            <div className="hiw-viz-frame">
              {workflow.map((item, i) => (
                <div key={item.step} className={`hiw-viz-slot ${i === active ? 'is-active' : ''}`}>
                  <img className="hiw-viz-media" src={item.image} alt="" />
                  <div className="hiw-viz-veil" />
                  <div className="hiw-panel">
                    <p className="hiw-panel-label">{item.panel.label}</p>
                    <strong>{item.panel.title}</strong>
                    {item.panel.lines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="hiw-steps">
            <span className="hiw-rail" aria-hidden="true">
              <span className="hiw-rail-fill" style={{ height: `${railFill * 100}%` }} />
            </span>
            {workflow.map((item, i) => (
              <div
                key={item.step}
                className={`hiw-step ${i === active ? 'is-active' : ''}`}
                ref={(el) => {
                  stepsRef.current[i] = el
                }}
              >
                <span className="hiw-step-n">{item.step}</span>
                <h3 className="hiw-step-title">{item.title}</h3>
                <p className="hiw-step-body">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="hiw-cta">
          <a className="btn btn-dark btn-pill" href="#cta">
            Create Your Campaign
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [heroInput, setHeroInput] = useState<'url' | 'image'>('url')
  const [heroImageName, setHeroImageName] = useState('')

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <div className="page">
      <div className="backdrop" aria-hidden="true" />

      <header className={`nav ${scrolled ? 'nav-scrolled' : 'nav-top'}`}>
        <div className="nav-inner">
          <Logo />

          <nav className="nav-links" aria-label="Primary">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="nav-actions">
            <a className="login" href="#login">
              Log in
            </a>
            <a className="btn btn-grad" href="#cta">
              Create campaign
              <span aria-hidden="true">→</span>
            </a>
            <button
              className={`menu-toggle ${menuOpen ? 'open' : ''}`}
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span />
              <span />
            </button>
          </div>
        </div>

        <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>
              {link.label}
            </a>
          ))}
          <a href="#login" onClick={() => setMenuOpen(false)}>
            Log in
          </a>
          <a className="btn btn-dark" href="#cta" onClick={() => setMenuOpen(false)}>
            Create Your Campaign
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero" aria-label="LUCE hero">
          <div className="hero-atmosphere" aria-hidden="true">
            <span className="hero-orb hero-orb-a" />
            <span className="hero-orb hero-orb-b" />
            <span className="hero-orb hero-orb-c" />
            <span className="hero-shard hero-shard-1" />
            <span className="hero-shard hero-shard-2" />
            <span className="hero-shard hero-shard-3" />
          </div>

          <div className="hero-sides" aria-hidden="true">
            <div className="hero-side hero-side-left">
              {HERO_SIDES.left.map((clip, i) => (
                <HeroSideCard key={clip.src} clip={clip} index={i} />
              ))}
            </div>
            <div className="hero-side hero-side-right">
              {HERO_SIDES.right.map((clip, i) => (
                <HeroSideCard key={clip.src} clip={clip} index={i} />
              ))}
            </div>
          </div>

          <div className="hero-center">
            <p className="hero-badge">
              <span className="hero-badge-inner">
                <span aria-hidden="true">✦</span>
                AI campaign studio for Shopify &amp; DTC
              </span>
            </p>

            <h1>
              <span className="hero-line">
                <span className="hero-ink">Transform</span>{' '}
                <span className="hero-grad hero-grad-a">Products</span>
              </span>
              <span className="hero-line">
                <span className="hero-grad hero-grad-b">Into Full</span>{' '}
                <span className="hero-ink">Campaigns</span>
              </span>
            </h1>

            <p className="lede">
              Create research-backed campaigns faster — studio visuals, UGC, social, and ads from
              one Shopify product.
            </p>

            <form
              className="hero-prompt"
              onSubmit={(e) => {
                e.preventDefault()
                window.location.hash = '#cta'
              }}
            >
              <div className="hero-prompt-field">
                {heroInput === 'url' ? (
                  <>
                    <label className="sr-only" htmlFor="hero-url">
                      Product URL
                    </label>
                    <input
                      id="hero-url"
                      type="url"
                      name="url"
                      placeholder="✦ Paste your Shopify or product URL…"
                      autoComplete="url"
                    />
                  </>
                ) : (
                  <label className="hero-upload" htmlFor="hero-image">
                    <input
                      id="hero-image"
                      type="file"
                      name="image"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        setHeroImageName(file ? file.name : '')
                      }}
                    />
                    <span className="hero-upload-copy">
                      {heroImageName ? (
                        <>
                          <strong>{heroImageName}</strong>
                          <small>Ready to create</small>
                        </>
                      ) : (
                        <>
                          <strong>Upload product photo</strong>
                          <small>PNG, JPG, or WEBP</small>
                        </>
                      )}
                    </span>
                  </label>
                )}
              </div>

              <div className="hero-prompt-bar">
                <label className="hero-attach" htmlFor="hero-image-attach" title="Upload product image">
                  <input
                    id="hero-image-attach"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        setHeroInput('image')
                        setHeroImageName(file.name)
                      }
                    }}
                  />
                  <span aria-hidden="true">📎</span>
                  <span className="sr-only">Attach product image</span>
                </label>
                <button
                  type="button"
                  className={`hero-mode ${heroInput === 'url' ? 'is-active' : ''}`}
                  onClick={() => {
                    setHeroInput('url')
                    setHeroImageName('')
                  }}
                >
                  Product URL
                </button>
                <button
                  type="button"
                  className={`hero-mode ${heroInput === 'image' ? 'is-active' : ''}`}
                  onClick={() => setHeroInput('image')}
                >
                  Product photo
                </button>
                <button type="submit" className="btn btn-grad hero-create">
                  <span aria-hidden="true">✦</span>
                  Try free
                </button>
              </div>
            </form>
            <p className="hero-free-note">First campaign free — no card required</p>
          </div>
        </section>

        <HowItWorks />

        <section className="trust" aria-label="Built for modern brands">
          <Reveal className="trust-inner">
            <p className="trust-label">Built for</p>
            <div className="trust-row">
              {trustMarks.map((mark) => (
                <span key={mark} className="trust-chip">
                  {mark}
                </span>
              ))}
            </div>
          </Reveal>
        </section>

        <section className="ugc" id="ugc" aria-labelledby="ugc-title">
          <Reveal className="section-head ugc-head">
            <p className="eyebrow">Creator videos</p>
            <h2 id="ugc-title">
              Reels that stay <span className="title-grad">true to product.</span>
            </h2>
            <p>Instagram, TikTok &amp; Shorts — faithful packaging, ready to publish.</p>
          </Reveal>
          <Reveal delay={80} className="ugc-stage">
            <UgcReel />
          </Reveal>
        </section>

        <ScrollPhrase />

        <section className="outputs" id="outputs" aria-labelledby="outputs-title">
          <Reveal className="section-head outputs-head">
            <p className="eyebrow">What you get</p>
            <h2 id="outputs-title">
              One product. <span className="title-grad">Complete campaign pack.</span>
            </h2>
            <p>
              Everything needed to market it — visuals, videos, social, ads, and strategy — in one
              downloadable pack.
            </p>
          </Reveal>
          <div className="outputs-bento">
            {outputs.map((item, i) => (
              <Reveal
                as="article"
                key={item.title}
                className={`output-card${item.featured ? ' featured' : ''}`}
                delay={i * 70}
              >
                <div className="output-media">
                  <img src={item.image} alt={item.title} loading="lazy" />
                  <span className="output-tag">{item.tag}</span>
                </div>
                <div className="output-copy">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal delay={120} className="outputs-meta">
            <span>Studio & lifestyle photos</span>
            <span>UGC Reels & Shorts</span>
            <span>Captions & CTAs</span>
            <span>Ad creatives</span>
            <span>Strategy brief</span>
            <span>ZIP export</span>
          </Reveal>
        </section>

        <section className="features" id="features" aria-labelledby="features-title">
          <Reveal className="section-head features-head">
            <p className="eyebrow">Why LUCE</p>
            <h2 id="features-title">
              Built for brands that care <span className="title-grad">how the product looks</span>
            </h2>
            <p>
              Not generic AI noise — fidelity, research, and strategy from the first frame to the
              final ZIP.
            </p>
          </Reveal>
          <div className="features-grid">
            {features.map((feature, i) => (
              <Reveal as="article" key={feature.title} className="feature-item" delay={i * 55}>
                <span className="feature-n" aria-hidden="true">
                  {feature.n}
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="fidelity" aria-labelledby="fidelity-title">
          <Reveal className="fidelity-panel rich">
            <div className="fidelity-visual">
              {PRODUCT_LIGHTS.map((shot) => (
                <figure key={shot.label} className={`fidelity-shot tone-${shot.tone}`}>
                  <img src={shot.src} alt={`${HERO_PRODUCT.name} — ${shot.label}`} />
                  <figcaption>{shot.label}</figcaption>
                </figure>
              ))}
              <span className="fidelity-chip">Same bottle · New location</span>
            </div>
            <div className="fidelity-copy">
              <p className="eyebrow">Core principle</p>
              <h2 id="fidelity-title">
                Change the scene, <span className="title-grad">not the product</span>
              </h2>
              <p>
                Beautiful AI images are useless if they distort your bottle, logo, or packaging. LUCE
                treats your product as the source of truth — same shape, same color, same details —
                while only the location and lighting around it change.
              </p>
              <ul>
                <li>Bottle color and packaging stay exact</li>
                <li>Shape, logo, and proportions preserved</li>
                <li>Only environment and lighting shift</li>
                <li>One identity across every location shoot</li>
              </ul>
            </div>
          </Reveal>
        </section>

        <section className="audience" id="audience" aria-labelledby="audience-title">
          <Reveal className="section-head audience-head">
            <p className="eyebrow">Who it’s for</p>
            <h2 id="audience-title">
              Made for teams shipping <span className="title-grad">physical products</span>
            </h2>
            <p>If your brand lives on Shopify and social — LUCE is built around that workflow.</p>
          </Reveal>
          <div className="audience-grid">
            {audiences.map((item, i) => (
              <Reveal as="article" key={item.title} className="audience-card" delay={i * 70}>
                <div className="audience-media">
                  <img src={item.image} alt="" loading="lazy" />
                  <span className="audience-tag">{item.tag}</span>
                </div>
                <div className="audience-copy">
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="pricing" id="pricing" aria-labelledby="pricing-title">
          <Reveal className="section-head">
            <p className="eyebrow">Pricing</p>
            <h2 id="pricing-title">
              Plans built for <span className="title-grad">serious brands</span>
            </h2>
            <p>Clear tiers. Studio-quality campaigns. Upgrade when you are ready to scale.</p>
          </Reveal>

          <Reveal className="billing-toggle" delay={60}>
            <button
              type="button"
              className={billing === 'monthly' ? 'active' : ''}
              onClick={() => setBilling('monthly')}
            >
              Monthly
            </button>
            <button
              type="button"
              className={billing === 'yearly' ? 'active' : ''}
              onClick={() => setBilling('yearly')}
            >
              Yearly
              <span className="save-pill">Save 20%</span>
            </button>
          </Reveal>

          <div className="pricing-grid">
            {pricingPlans.map((plan, i) => {
              const price = billing === 'monthly' ? plan.monthly : plan.yearly
              return (
                <Reveal
                  as="article"
                  key={plan.name}
                  className={`price-card ${plan.featured ? 'featured' : ''}`}
                  delay={i * 70}
                >
                  {plan.featured && <span className="price-badge">Most popular</span>}
                  <h3>{plan.name}</h3>
                  <p className="price-tagline">{plan.tagline}</p>
                  <p className="price-amount">
                    <span className="price-num">${price}</span>
                    <span className="price-period">/ month</span>
                  </p>
                  {billing === 'yearly' && plan.monthly > 0 && (
                    <p className="price-note">Billed yearly</p>
                  )}
                  <a className={`btn ${plan.featured ? 'btn-dark' : 'btn-ghost'}`} href="#cta">
                    {plan.cta}
                  </a>
                  <ul>
                    {plan.perks.map((perk) => (
                      <li key={perk}>{perk}</li>
                    ))}
                  </ul>
                </Reveal>
              )
            })}
          </div>
        </section>

        <section className="faq" id="faq" aria-labelledby="faq-title">
          <div className="faq-shell">
            <Reveal className="faq-intro">
              <p className="eyebrow">FAQ</p>
              <h2 id="faq-title">
                Answers before <span className="title-grad">you start</span>
              </h2>
              <p>
                Clear details on fidelity, exports, pricing, and who LUCE is built for.
              </p>

              <ul className="faq-points">
                <li>Product fidelity locked first</li>
                <li>Research before creative</li>
                <li>ZIP export · manual publish</li>
              </ul>

              <a className="btn btn-grad btn-pill faq-intro-cta" href="#cta">
                Start free
                <span aria-hidden="true">→</span>
              </a>
            </Reveal>
            <Reveal delay={100} className="faq-panel">
              <FaqList />
            </Reveal>
          </div>
        </section>

        <section className="final-cta" id="cta" aria-labelledby="cta-title">
          <Reveal className="cta-banner">
            <div className="cta-banner-veil" aria-hidden="true" />
            <div className="cta-banner-glow" aria-hidden="true" />
            <div className="cta-banner-content">
              <p className="cta-kicker">Your product · To light</p>
              <h2 id="cta-title">Ready for a research-backed campaign.</h2>
              <p>Give LUCE one product. Get everything you need to market it.</p>
              <a className="btn btn-pill cta-banner-btn" href="#top">
                Create Campaign
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-shade" aria-hidden="true" />
        <div className="footer-inner">
          <div className="footer-top">
            <div className="footer-brand">
              <Logo />
              <p className="footer-tag">
                Bring your product to light — research-backed campaigns for Shopify &amp; DTC.
              </p>
              <a className="btn btn-grad btn-pill footer-cta" href="#cta">
                Start free
                <span aria-hidden="true">→</span>
              </a>
            </div>

            <div className="footer-cols">
              <div className="footer-col">
                <h3>Product</h3>
                <a href="#how-it-works">How it works</a>
                <a href="#outputs">What you get</a>
                <a href="#ugc">Videos</a>
                <a href="#features">Features</a>
                <a href="#pricing">Pricing</a>
              </div>

              <div className="footer-col">
                <h3>Company</h3>
                <a href="#audience">Who it’s for</a>
                <a href="#cta">Early access</a>
                <a href="mailto:hello@luce.ai">Contact</a>
              </div>

              <div className="footer-col">
                <h3>Resources</h3>
                <a href="#faq">FAQ</a>
                <a href="#how-it-works">Workflow</a>
                <a href="#pricing">Plans</a>
              </div>

              <div className="footer-col">
                <h3>Legal</h3>
                <a href="#privacy">Privacy</a>
                <a href="#terms">Terms</a>
                <a href="#cookies">Cookies</a>
              </div>
            </div>
          </div>

          <div className="footer-meta">
            <p className="copyright">© {new Date().getFullYear()} LUCE</p>
            <div className="footer-social" aria-label="Social">
              <a href="https://x.com" target="_blank" rel="noreferrer">
                X
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer">
                Instagram
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noreferrer">
                LinkedIn
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer">
                YouTube
              </a>
            </div>
          </div>

          <div className="footer-giant" aria-hidden="true">
            <p className="footer-mark">LUCE</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
