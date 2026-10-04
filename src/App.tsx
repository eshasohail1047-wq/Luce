import { useEffect, useState } from 'react'
import CampaignDemoPlayer from './CampaignDemoPlayer'
import Logo from './Logo'
import './App.css'

const navLinks = [
  { href: '#industries', label: 'Industries' },
  { href: '#demo', label: 'Demo' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Early Access' },
]

const deliverables = [
  {
    title: 'Product Photos',
    caption: 'Studio · Lifestyle · Promo',
    image: '/images/luce-product-photo.jpg',
    className: 'card-photos',
  },
  {
    title: 'UGC Video',
    caption: 'Authentic short-form',
    image: '/images/ugc-creator.jpg',
    className: 'card-ugc',
    play: true,
  },
  {
    title: 'Social Content',
    caption: 'Captions · Hooks · CTAs',
    image: '/images/social-phone.jpg',
    className: 'card-social',
  },
  {
    title: 'Ad Creatives',
    caption: 'Visuals + ad copy',
    image: '/images/ad-creative.jpg',
    className: 'card-ads',
  },
]

const industries = [
  { name: 'Beauty', image: '/images/skincare.jpg' },
  { name: 'Skincare', image: '/images/product-lifestyle.jpg' },
  { name: 'Perfume', image: '/images/luce-product-photo.jpg' },
  { name: 'Jewelry', image: '/images/hero-product.jpg' },
  { name: 'Fashion', image: '/images/ugc-creator.jpg' },
  { name: 'Home', image: '/images/product-studio.jpg' },
]

const trustPoints = [
  'Studio-quality product light',
  'True-to-product fidelity',
  'Full campaign in one flow',
]

const gallery = [
  {
    title: 'Studio product shot',
    text: 'Clean product photography that keeps packaging and details true.',
    image: '/images/product-studio.jpg',
  },
  {
    title: 'Lighting & softbox mood',
    text: 'Campaign lighting inspired by real studio setups — soft, premium, on-brand.',
    image: '/images/studio-lights.jpg',
  },
  {
    title: 'Beauty & skincare',
    text: 'Campaign-ready frames for DTC physical product brands.',
    image: '/images/skincare.jpg',
  },
  {
    title: 'Hero product still',
    text: 'Premium product presentation for ads and storefronts.',
    image: '/images/hero-product.jpg',
  },
]

const processSteps = [
  {
    title: 'Product Images',
    text: 'Professional, lifestyle and promotional visuals.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="9" cy="11" r="1.8" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M3 16l4.2-3.2L11.5 15l3-2.4L21 16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: 'Videos',
    text: 'UGC-style and product marketing clips.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="6" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
        <path
          d="M16 10.2l4.5-2.2v8L16 13.8v-3.6z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    title: 'Social Content',
    text: 'Captions, hooks, hashtags and CTAs.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M7 8h10M7 12h7M7 16h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    title: 'Ad Creatives',
    text: 'Ready-to-run creatives and copy.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M5 19V8.8c0-.7.4-1.3 1.1-1.6L12 5l5.9 2.2c.7.3 1.1.9 1.1 1.6V19"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <path d="M9 19v-5h6v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
]

const workflow = [
  {
    step: '01',
    title: 'Add your product',
    text: 'Paste a product URL or upload images with basic details.',
  },
  {
    step: '02',
    title: 'Confirm product details',
    text: 'Review name, features, category, and brand tone before generating.',
  },
  {
    step: '03',
    title: 'Generate the campaign',
    text: 'One action creates visuals, videos, social content, and ads — aligned.',
  },
  {
    step: '04',
    title: 'Refine and download',
    text: 'Preview, regenerate any asset, then export one complete ZIP package.',
  },
]

const features = [
  {
    title: 'Product understanding',
    text: 'LUCE extracts and organizes product identity so every asset starts from the same source of truth.',
  },
  {
    title: 'Studio lighting mindset',
    text: 'Think camera lights and softboxes — LUCE changes the scene and lighting, never the product itself.',
  },
  {
    title: 'Campaign consistency',
    text: 'Photos, UGC, copy, and ads share one product identity and one campaign context.',
  },
  {
    title: 'One simple workflow',
    text: 'Stop juggling multiple AI tools. Give LUCE the product — get everything to market it.',
  },
]

export default function App() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
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

      <header className={`nav ${scrolled ? 'nav-scrolled' : ''}`}>
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
            <a className="btn btn-accent btn-pill" href="#cta">
              Create Campaign
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
          <a className="btn btn-accent" href="#cta" onClick={() => setMenuOpen(false)}>
            Create Campaign
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">AI Campaign Creation Platform</p>
            <h1>
              Your Product.
              <br />
              <em>Our Creativity.</em>
            </h1>
            <p className="lede">
              LUCE brings your product into the light — then builds a full marketing campaign
              around it: studio visuals, videos, social content, and ads that stay true to what
              you sell.
            </p>
            <div className="hero-cta">
              <a className="btn btn-accent btn-pill" href="#cta">
                Create Campaign
                <span aria-hidden="true">→</span>
              </a>
              <a className="btn-watch" href="#demo">
                <span className="play-circle" aria-hidden="true">
                  ▶
                </span>
                Watch how it works
              </a>
            </div>
            <ul className="trust-row">
              {trustPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>

          <div className="hero-visual">
            <div className="glow glow-warm" aria-hidden="true" />
            <div className="glow glow-amber" aria-hidden="true" />

            {deliverables.map((card) => (
              <article key={card.title} className={`float-card ${card.className}`}>
                <div className="float-media">
                  <img src={card.image} alt={card.title} />
                  {card.play && <span className="play-badge">▶</span>}
                </div>
                <div className="float-meta">
                  <strong>{card.title}</strong>
                  <span>{card.caption}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="industries" id="industries" aria-labelledby="industries-title">
          <div className="section-head">
            <p className="eyebrow">Industries</p>
            <h2 id="industries-title">Perfect for every product, every industry.</h2>
          </div>
          <div className="industry-grid">
            {industries.map((item) => (
              <article key={item.name} className="industry-card">
                <img src={item.image} alt="" loading="lazy" />
                <span>{item.name}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="campaign-ready" id="cta" aria-labelledby="cta-title">
          <div className="campaign-ready-bg" aria-hidden="true">
            <img src="/images/studio-lights.jpg" alt="" />
          </div>
          <div className="campaign-ready-veil" aria-hidden="true" />
          <div className="campaign-ready-content">
            <p className="campaign-kicker">Your product</p>
            <h2 id="cta-title">Is ready for its campaign.</h2>
            <p>Give LUCE one product. We&apos;ll build the campaign around it.</p>
            <a className="btn btn-accent btn-pill" href="#top">
              Create Campaign
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </section>

        <section className="demo" id="demo" aria-labelledby="demo-title">
          <div className="section-head">
            <p className="eyebrow">Campaign demo</p>
            <h2 id="demo-title">How to create a full campaign with LUCE</h2>
            <p>
              A guided walkthrough of the whole flow — from product input to ZIP export — so you
              can see exactly how LUCE builds your campaign.
            </p>
          </div>
          <CampaignDemoPlayer />
        </section>

        <section className="process" id="examples" aria-labelledby="process-title">
          <div className="process-shell">
            <h2 id="process-title">One product → a complete marketing campaign</h2>
            <div className="process-grid">
              {processSteps.map((step) => (
                <div className="process-item" key={step.title}>
                  <div className="process-icon">{step.icon}</div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="gallery" aria-labelledby="gallery-title">
          <div className="section-head">
            <p className="eyebrow">Campaign visuals</p>
            <h2 id="gallery-title">Lit like a studio. True to the product.</h2>
            <p>
              From perfume and skincare to lifestyle goods — LUCE lights your product and builds
              campaign assets around what you already sell.
            </p>
          </div>
          <div className="gallery-grid">
            {gallery.map((item) => (
              <article key={item.title} className="gallery-card">
                <img src={item.image} alt={item.title} loading="lazy" />
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="workflow" id="how-it-works" aria-labelledby="workflow-title">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 id="workflow-title">From product URL to campaign ZIP</h2>
            <p>
              Built for Shopify, e-commerce, and DTC brands that need professional content without
              a full creative team.
            </p>
          </div>
          <ol className="workflow-list">
            {workflow.map((item) => (
              <li key={item.step}>
                <span className="step-num">{item.step}</span>
                <div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="features" id="features" aria-labelledby="features-title">
          <div className="section-head">
            <p className="eyebrow">Why LUCE</p>
            <h2 id="features-title">Built around light, product, and campaign</h2>
            <p>
              LUCE does not create isolated assets. It lights your product and builds one campaign
              around it — with fidelity and consistency at the center.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <article key={feature.title} className="feature-card">
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="fidelity" aria-labelledby="fidelity-title">
          <div className="fidelity-panel">
            <div>
              <p className="eyebrow">Core principle</p>
              <h2 id="fidelity-title">Change the scene, not the product</h2>
              <p>
                Beautiful AI images are useless if they distort your bottle, logo, or packaging.
                LUCE treats your product as the source of truth — preserving shape, proportions,
                colors, and distinctive details while transforming lighting and setting around it.
              </p>
            </div>
            <ul>
              <li>Preserves shape, logo and label</li>
              <li>Keeps packaging and colors true</li>
              <li>Varies lighting, props and lifestyle</li>
              <li>One identity across every asset</li>
            </ul>
          </div>
        </section>

        <section className="pricing" id="pricing" aria-labelledby="pricing-title">
          <div className="early-access">
            <p className="eyebrow">Early access</p>
            <h2 id="pricing-title">Built for Shopify and DTC brands</h2>
            <p>
              LUCE MVP focuses on physical products — beauty, skincare, perfume, jewelry, fashion
              accessories, home and lifestyle, and packaged goods.
            </p>
            <a className="btn btn-accent btn-pill" href="#cta">
              Request early access
            </a>
          </div>
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
            <a href="#how-it-works">How It Works</a>
            <a href="#features">Features</a>
            <a href="#pricing">Early Access</a>
            <a href="#login">Log in</a>
          </div>
          <p className="copyright">© {new Date().getFullYear()} LUCE. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
