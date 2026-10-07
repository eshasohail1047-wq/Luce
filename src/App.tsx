import { useEffect, useRef, useState } from 'react'
import CampaignDemoPlayer from './CampaignDemoPlayer'
import DemoVideoPlayer from './DemoVideoPlayer'
import Logo from './Logo'
import UgcReel from './UgcReel'
import './App.css'

const navLinks = [
  { href: '#demo', label: 'Demo' },
  { href: '#campaign', label: 'Campaign' },
  { href: '#ugc', label: 'UGC' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
]

const HERO_PRODUCT = {
  image: '/images/luce-product-photo.jpg',
  name: 'Rose Oud Perfume',
}

/** Same Rose Oud bottle — real location / lighting shoots only (no bottle recolor) */
const PRODUCT_LIGHTS = [
  {
    src: '/images/luce-product-photo.jpg',
    label: 'Daylight location',
    tone: 'daylight',
  },
  {
    src: '/images/campaign-perfume-studio.jpg',
    label: 'Studio softbox',
    tone: 'studio',
  },
  {
    src: '/images/campaign-perfume-studio.jpg',
    label: 'Evening set',
    tone: 'evening',
  },
]

const workflow = [
  {
    step: '01',
    title: 'Add your product',
    text: 'Paste a product URL or upload images. LUCE learns packaging, features, and brand context.',
    image: '/images/luce-product-photo.jpg',
    panel: {
      label: 'Create campaign',
      title: 'Add product',
      lines: ['brand.com/products/rose-oud', 'or upload product images'],
    },
  },
  {
    step: '02',
    title: 'Confirm what LUCE understood',
    text: 'Review name, features, and category — so every asset starts from one source of truth.',
    image: '/images/campaign-perfume-studio.jpg',
    panel: {
      label: 'Product brief',
      title: 'Rose Oud Perfume',
      lines: ['Fragrance · Luxury', 'Fidelity check: Ready'],
    },
  },
  {
    step: '03',
    title: 'Research & strategy',
    text: 'LUCE researches market context, then builds audience, positioning, angle, and creative direction.',
    image: '/images/campaign-ugc-serum.jpg',
    panel: {
      label: 'Campaign strategy',
      title: 'Research-backed brief',
      lines: ['Audience · Positioning', 'Angle · Message · CTA'],
    },
  },
  {
    step: '04',
    title: 'Generate & download',
    text: 'Get visuals, UGC, social, ads, and strategy in one pack — then download a ZIP to publish manually.',
    image: '/images/luce-dashboard-mock.jpg',
    panel: {
      label: 'Export ready',
      title: 'Campaign dashboard',
      lines: ['Photos · Video · Copy', 'ZIP ready to publish'],
    },
  },
]

const features = [
  {
    title: 'Product as source of truth',
    text: 'LUCE confirms your real product first — shape, label, and packaging stay faithful across every asset.',
  },
  {
    title: 'Research before creative',
    text: 'Market, competitor, and trend context inform the campaign so assets are not disconnected AI shots.',
  },
  {
    title: 'Strategy-led generation',
    text: 'Audience, positioning, angle, and CTA are locked before visuals, UGC, social, and ads are created.',
  },
  {
    title: 'True-to-product fidelity',
    text: 'Change the scene and light, never the bottle. Softbox moods without distorting packaging.',
  },
  {
    title: 'One coherent campaign',
    text: 'Photos, videos, copy, and ads share one product identity and one message — ready to publish.',
  },
  {
    title: 'Review, refine, download',
    text: 'Preview, regenerate individual assets, then export a complete ZIP. Manual publishing in MVP.',
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
        <h2 className="hiw-title" id="workflow-title">
          How it works
        </h2>

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
            <a className="btn btn-dark" href="#cta">
              Create Your Campaign
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
          <div className="hero-media" aria-hidden="true">
            <img src={HERO_PRODUCT.image} alt="" />
            <div className="hero-media-wash" />
          </div>

          <div className="hero-content">
            <p className="hero-brand">LUCE</p>
            <h1>Bring your product to light.</h1>
            <p className="lede">
              Give LUCE one product. Get a research-backed campaign — visuals, videos, social,
              ads, and strategy.
            </p>

            <form
              className="hero-start"
              onSubmit={(e) => {
                e.preventDefault()
                window.location.hash = '#cta'
              }}
            >
              <label className="sr-only" htmlFor="hero-url">
                Product URL
              </label>
              <input
                id="hero-url"
                type="url"
                name="url"
                placeholder="Paste a product URL — brand.com/products/…"
                autoComplete="url"
              />
              <button type="submit" className="btn btn-dark">
                Create campaign
                <span aria-hidden="true">→</span>
              </button>
            </form>

            <a className="hero-secondary" href="#demo">
              See how LUCE works
            </a>
          </div>
        </section>

        <section className="demo" id="demo" aria-labelledby="demo-title">
          <Reveal className="section-head">
            <p className="eyebrow">Product walkthrough</p>
            <h2 id="demo-title">How LUCE works</h2>
            <p>
              Product → research → strategy → complete campaign. Follow the real workflow inside
              LUCE.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <DemoVideoPlayer />
          </Reveal>
        </section>

        <section className="campaign" id="campaign" aria-labelledby="campaign-title">
          <Reveal className="section-head">
            <p className="eyebrow">One product campaign</p>
            <h2 id="campaign-title">One moisturizer. Complete pack.</h2>
            <p>
              The same Daily Moisturizer — product still, the creator using it, then the marketing
              film.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <CampaignDemoPlayer />
          </Reveal>
        </section>

        <section className="ugc" id="ugc" aria-labelledby="ugc-title">
          <Reveal className="section-head">
            <p className="eyebrow">UGC videos</p>
            <h2 id="ugc-title">Real creators. Real product moments.</h2>
            <p>
              A looping feed of creators using moisturizer and perfume — ready for Reels, TikTok,
              and Shorts.
            </p>
          </Reveal>
          <Reveal delay={100}>
            <UgcReel />
          </Reveal>
        </section>

        <ScrollPhrase />

        <HowItWorks />

        <section className="features" id="features" aria-labelledby="features-title">
          <Reveal className="section-head">
            <p className="eyebrow">Why LUCE</p>
            <h2 id="features-title">Built for brands that care how the product looks</h2>
            <p>
              Not generic AI noise — a campaign system centered on product fidelity, lighting, and
              consistency.
            </p>
          </Reveal>
          <div className="feature-grid feature-grid-3">
            {features.map((feature, i) => (
              <Reveal as="article" key={feature.title} className="feature-card text-only" delay={i * 70}>
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
              <h2 id="fidelity-title">Change the scene, not the product</h2>
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

        <section className="pricing" id="pricing" aria-labelledby="pricing-title">
          <Reveal className="section-head">
            <p className="eyebrow">Pricing</p>
            <h2 id="pricing-title">Plans built for serious brands</h2>
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

        <section className="final-cta" id="cta" aria-labelledby="cta-title">
          <Reveal className="cta-banner">
            <div className="cta-banner-veil" aria-hidden="true" />
            <div className="cta-banner-content">
              <p className="cta-kicker">Your product</p>
              <h2 id="cta-title">Ready for a research-backed campaign.</h2>
              <p>Give LUCE one product. Get everything you need to market it.</p>
              <a className="btn btn-light btn-pill" href="#top">
                Create Campaign
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-inner">
          <div>
            <Logo />
            <p>Bring your product to light.</p>
          </div>
          <div className="footer-links">
            <a href="#demo">Demo</a>
            <a href="#campaign">Campaign</a>
            <a href="#ugc">UGC</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Pricing</a>
            <a href="#login">Log in</a>
          </div>
          <p className="copyright">© {new Date().getFullYear()} LUCE. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
