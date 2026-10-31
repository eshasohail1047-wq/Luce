import { useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import FormatPickGrid from '../components/FormatPickGrid'
import Logo from '../Logo'
import { DEFAULT_PHOTO_STYLES, PHOTO_STYLES } from '../lib/deliverables'
import type { FormatQuantities } from '../lib/formatQuantities'

/**
 * Public mock of the real AppLayout chrome for landing “How it works” shots.
 * Visit /demo/hiw?shot=home|product|formats|results|saved
 */
export default function HiwShotsPage() {
  const [params] = useSearchParams()
  const shot = (params.get('shot') || 'home').toLowerCase()
  const [photoQuantities, setPhotoQuantities] = useState<FormatQuantities>({})

  const allowed = useMemo(
    () => new Set(['home', 'product', 'formats', 'results', 'saved']),
    [],
  )
  if (!allowed.has(shot)) {
    return <Navigate to="/demo/hiw?shot=home" replace />
  }

  const createActive =
    shot === 'home'
      ? 'home'
      : shot === 'product' || shot === 'formats'
        ? 'photos'
        : shot === 'results'
          ? 'projects'
          : 'saved'

  return (
    <div className="hiw-shot hiw-shot-real" data-hiw-shot={shot}>
      <div className="hiw-shot-capture studio-shell">
        <aside className="studio-rail" aria-hidden="true">
          <div className="studio-rail-brand">
            <Logo href={null} />
          </div>
          <div className="studio-rail-scroll">
            <div className="studio-rail-group">
              <p className="studio-rail-label">Create</p>
              <nav className="studio-rail-nav">
                <span className={`studio-rail-link${createActive === 'home' ? ' is-active' : ''}`}>
                  <span>Home</span>
                </span>
                <span
                  className={`studio-rail-link${createActive === 'photos' ? ' is-active' : ''}`}
                >
                  <span>Image Studio</span>
                </span>
                <span className="studio-rail-link">
                  <span>Video Studio</span>
                </span>
                <span className="studio-rail-link">
                  <span>Full Campaign</span>
                </span>
              </nav>
            </div>
            <div className="studio-rail-group">
              <p className="studio-rail-label">Manage</p>
              <nav className="studio-rail-nav">
                <span className="studio-rail-link">
                  <span>Products</span>
                </span>
                <span
                  className={`studio-rail-link${createActive === 'projects' ? ' is-active' : ''}`}
                >
                  <span>Projects</span>
                </span>
                <span
                  className={`studio-rail-link${createActive === 'saved' ? ' is-active' : ''}`}
                >
                  <span>Saved</span>
                </span>
              </nav>
            </div>
            <div className="studio-rail-group">
              <p className="studio-rail-label">Account</p>
              <nav className="studio-rail-nav">
                <span className="studio-rail-link">
                  <span>Settings</span>
                </span>
              </nav>
            </div>
          </div>
        </aside>

        <div className="studio-stage studio-stage-bare">
          <div className="hiw-shot-main-real">
            {shot === 'home' ? (
              <main className="dash dash-home hiw-shot-home">
                <section className="dash-home-hero">
                  <h1 className="dash-home-title">
                    Create <em>your creatives</em>, Esha
                  </h1>
                  <div className="dash-home-composer" data-open="true">
                    <div className="dash-home-entry">
                      <button type="button" className="dash-home-entry-btn is-active">
                        <strong>Upload product</strong>
                      </button>
                      <span className="dash-home-or">or</span>
                      <button type="button" className="dash-home-entry-btn">
                        <strong>Paste URL</strong>
                      </button>
                    </div>
                    <div className="dash-home-dest">
                      <div className="dash-home-dest-head">
                        <strong>Choose a studio</strong>
                      </div>
                      <div className="dash-home-dest-grid">
                        <span className="dash-home-dest-card">
                          <strong>Images</strong>
                        </span>
                        <span className="dash-home-dest-card">
                          <strong>Videos</strong>
                        </span>
                        <span className="dash-home-dest-card">
                          <strong>Full Campaign</strong>
                        </span>
                      </div>
                    </div>
                  </div>
                </section>
                <div className="hiw-shot-home-showcase" aria-hidden="true">
                  <img src="/images/campaign-perfume-studio.jpg" alt="" />
                  <img src="/images/format-perfume-flatlay.jpg" alt="" />
                  <img src="/images/format-perfume-in-hand.jpg" alt="" />
                </div>
              </main>
            ) : null}

            {shot === 'product' ? (
              <main className="app-main campaign-create studio-page studio-page-photo">
                <header className="studio-hero tone-photo">
                  <div className="studio-hero-copy">
                    <p className="studio-hero-kicker">Image Studio</p>
                    <h1>Craft product images</h1>
                    <p className="studio-hero-lead">
                      Product photo or URL → optional reference + prompt → pick formats and generate.
                    </p>
                    <ol className="studio-hero-steps">
                      <li>Product photo or URL</li>
                      <li>Optional ref + prompt</li>
                      <li>Formats + variants</li>
                      <li>Generate images</li>
                    </ol>
                  </div>
                  <div className="studio-hero-media" aria-hidden="true">
                    <img src="/images/campaign-beauty-flatlay.jpg" alt="" />
                  </div>
                </header>
                <div className="app-form campaign-form create-panel studio-panel">
                  <section className="form-section">
                    <div className="form-section-head">
                      <h2>1. Product</h2>
                      <p>Photo or product page URL</p>
                    </div>
                    <div className="source-toggle">
                      <button type="button" className="is-active">
                        <span className="source-toggle-title">Photo</span>
                      </button>
                      <button type="button">
                        <span className="source-toggle-title">Product URL</span>
                      </button>
                    </div>
                    <div className="upload-drop">
                      <strong>Drop product photo here</strong>
                      <span>JPG, PNG, or WebP</span>
                    </div>
                  </section>
                </div>
              </main>
            ) : null}

            {shot === 'formats' ? (
              <main className="app-main campaign-create studio-page studio-page-photo">
                <div className="app-form campaign-form create-panel studio-panel">
                  <section className="form-section">
                    <div className="form-section-head">
                      <h2>Pick formats &amp; variants</h2>
                      <p>Tap formats · set variants with + / − · max 5 images</p>
                    </div>
                    <FormatPickGrid
                      items={PHOTO_STYLES}
                      quantities={photoQuantities}
                      onQuantitiesChange={setPhotoQuantities}
                      defaultIds={DEFAULT_PHOTO_STYLES}
                      max={5}
                      ariaLabel="Photo formats"
                    />
                  </section>
                </div>
              </main>
            ) : null}

            {shot === 'results' ? (
              <main className="app-main dash workspace-page">
                <header className="workspace-page-header">
                  <div className="workspace-page-title-row">
                    <h1>Projects</h1>
                    <span className="dash-create-btn">+ New</span>
                  </div>
                </header>
                <ul className="ws-card-grid hiw-shot-project-grid">
                  {[
                    {
                      src: '/images/campaign-perfume-studio.jpg',
                      name: 'Miss Rose Foundation',
                      meta: 'Images · Today',
                    },
                    {
                      src: '/images/format-perfume-flatlay.jpg',
                      name: 'Lumière Eau de Parfum',
                      meta: 'Images · Yesterday',
                    },
                    {
                      src: '/images/format-perfume-in-hand.jpg',
                      name: 'Glow Naturally',
                      meta: 'Full Campaign · 2d ago',
                    },
                    {
                      src: '/images/format-perfume-promo.jpg',
                      name: 'Noir Éclat',
                      meta: 'Images · 4d ago',
                    },
                  ].map((item) => (
                    <li key={item.name}>
                      <article className="ws-card">
                        <div className="ws-card-media">
                          <img src={item.src} alt="" />
                          <span className="ws-card-tag is-done">DONE</span>
                        </div>
                        <div className="ws-card-body">
                          <strong>{item.name}</strong>
                          <span>{item.meta}</span>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              </main>
            ) : null}

            {shot === 'saved' ? (
              <main className="app-main dash workspace-page">
                <header className="workspace-page-header">
                  <div className="workspace-page-title-row">
                    <h1>Saved</h1>
                    <span className="dash-create-btn">Create images</span>
                  </div>
                </header>
                <ul className="ws-card-grid">
                  {[
                    {
                      src: '/images/campaign-perfume-studio.jpg',
                      label: 'Studio packshot',
                      sub: 'Miss Rose Foundation · Today',
                    },
                    {
                      src: '/images/format-perfume-flatlay.jpg',
                      label: 'Flatlay',
                      sub: 'Miss Rose Foundation · Today',
                    },
                    {
                      src: '/images/format-perfume-in-hand.jpg',
                      label: 'In hand',
                      sub: 'Miss Rose Foundation · Today',
                    },
                    {
                      src: '/images/format-perfume-promo.jpg',
                      label: 'Promo / ad',
                      sub: 'Miss Rose Foundation · Today',
                    },
                  ].map((item) => (
                    <li key={item.label}>
                      <article className="ws-card">
                        <div className="ws-card-media">
                          <img src={item.src} alt="" />
                          <span className="ws-card-tag is-done">SAVED</span>
                          <span className="ws-card-export">Export</span>
                        </div>
                        <div className="ws-card-body">
                          <strong>{item.label}</strong>
                          <span>{item.sub}</span>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              </main>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
