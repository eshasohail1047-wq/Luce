import { useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import FormatPickGrid from '../components/FormatPickGrid'
import Logo from '../Logo'
import { DEFAULT_PHOTO_STYLES, PHOTO_STYLES } from '../lib/deliverables'
import type { FormatQuantities } from '../lib/formatQuantities'

/**
 * Public mock of the real AppLayout chrome for landing “How it works” shots.
 * Visit /demo/hiw?shot=home|product|formats|library
 */
export default function HiwShotsPage() {
  const [params] = useSearchParams()
  const shot = (params.get('shot') || 'home').toLowerCase()
  const embed = params.get('embed') === '1'
  const [photoQuantities, setPhotoQuantities] = useState<FormatQuantities>({
    photo_studio_packshot: 2,
    photo_window_daylight: 1,
    photo_flatlay: 1,
  })

  const allowed = useMemo(
    () => new Set(['home', 'product', 'formats', 'results', 'library', 'saved']),
    [],
  )
  if (!allowed.has(shot)) {
    return <Navigate to="/demo/hiw?shot=home" replace />
  }

  const active =
    shot === 'home'
      ? 'home'
      : shot === 'product' || shot === 'formats'
        ? 'images'
        : shot === 'results'
          ? 'campaign'
          : 'library'

  return (
    <div
      className={`hiw-shot hiw-shot-real${embed ? ' is-embed' : ''}`}
      data-hiw-shot={shot === 'saved' ? 'library' : shot}
      data-embed={embed ? '1' : undefined}
    >
      <div className="hiw-shot-capture studio-shell">
        <aside className="studio-rail studio-rail-single" aria-hidden="true">
          <div className="studio-rail-top">
            <div className="studio-rail-brand">
              <Logo href={null} />
            </div>
            <span className="studio-rail-create" aria-hidden="true">
              +
            </span>
          </div>
          <div className="studio-rail-scroll">
            <nav className="studio-rail-nav studio-rail-nav-flat">
              <span className={`studio-rail-link${active === 'home' ? ' is-active' : ''}`}>
                <span>Home</span>
              </span>
              <span className={`studio-rail-link${active === 'images' ? ' is-active' : ''}`}>
                <span>Images</span>
              </span>
              <span className="studio-rail-link">
                <span>Videos</span>
              </span>
              <span className={`studio-rail-link${active === 'campaign' ? ' is-active' : ''}`}>
                <span>Campaign</span>
              </span>
              <span className="studio-rail-link">
                <span>Products</span>
              </span>
              <span className={`studio-rail-link${active === 'library' ? ' is-active' : ''}`}>
                <span>Library</span>
              </span>
            </nav>
          </div>
        </aside>

        <div className="studio-stage studio-stage-bare">
          <div className="hiw-shot-main-real">
            {shot === 'home' ? (
              <main className="dash dash-home hiw-shot-home">
                <section className="dash-home-hero">
                  <h1 className="dash-home-title">
                    Create <em>your creatives</em>
                  </h1>
                  <p className="dash-home-sub">Start with a product photo or paste a link.</p>
                  <div className="dash-home-composer" data-open="true">
                    <div className="dash-home-entry">
                      <button type="button" className="dash-home-entry-btn is-active">
                        <span className="dash-home-entry-ico" aria-hidden="true">
                          ↑
                        </span>
                        <strong>Upload product</strong>
                      </button>
                      <span className="dash-home-or">or</span>
                      <button type="button" className="dash-home-entry-btn">
                        <span className="dash-home-entry-ico" aria-hidden="true">
                          ⧉
                        </span>
                        <strong>Paste URL</strong>
                      </button>
                    </div>
                    <div className="dash-home-dest">
                      <div className="dash-home-dest-head">
                        <strong>Choose where to create</strong>
                      </div>
                      <div className="dash-home-dest-grid">
                        <span className="dash-home-dest-card">
                          <strong>Images</strong>
                          <span>Product & lifestyle stills</span>
                        </span>
                        <span className="dash-home-dest-card">
                          <strong>Videos</strong>
                          <span>UGC, ads, and clips</span>
                        </span>
                        <span className="dash-home-dest-card">
                          <strong>Full Campaign</strong>
                          <span>Images + videos together</span>
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
              <main className="app-main studio-page studio-page-bench studio-page-photo hiw-shot-bench">
                <div className="studio-bench">
                  <div className="studio-bench-steps">
                    <div className="studio-bench-formats">
                      <div className="studio-bench-heading">
                        <h1>Formats</h1>
                        <p>Pick looks or add your reference</p>
                      </div>
                      <div className="hiw-shot-format-preview" aria-hidden="true">
                        <img src="/images/format-perfume-flatlay.jpg" alt="" />
                        <img src="/images/fidelity-daylight.jpg" alt="" />
                        <img src="/images/fidelity-evening.jpg" alt="" />
                        <img src="/images/format-perfume-in-hand.jpg" alt="" />
                      </div>
                    </div>
                  </div>
                  <div className="studio-bench-product">
                    <div className="studio-bench-heading">
                      <h1>Product</h1>
                      <p>Photo or Product URL</p>
                    </div>
                    <div className="source-toggle">
                      <button type="button" className="is-active">
                        <span className="source-toggle-title">Photo</span>
                      </button>
                      <button type="button">
                        <span className="source-toggle-title">Product URL</span>
                      </button>
                    </div>
                    <div className="hiw-shot-product-stage">
                      <img src="/images/campaign-perfume-studio.jpg" alt="" />
                      <span>Packshot locked</span>
                    </div>
                  </div>
                </div>
              </main>
            ) : null}

            {shot === 'formats' ? (
              <main className="app-main studio-page studio-page-bench studio-page-photo hiw-shot-bench">
                <div className="studio-bench">
                  <div className="studio-bench-steps">
                    <div className="studio-bench-formats">
                      <div className="studio-bench-heading">
                        <h1>Formats</h1>
                        <p>Tap looks · set quantities · or use your reference</p>
                      </div>
                      <FormatPickGrid
                        items={PHOTO_STYLES}
                        quantities={photoQuantities}
                        onQuantitiesChange={setPhotoQuantities}
                        defaultIds={DEFAULT_PHOTO_STYLES}
                        max={5}
                        ariaLabel="Photo formats"
                      />
                      <div className="hiw-shot-generate" aria-hidden="true">
                        Generate images
                      </div>
                    </div>
                  </div>
                  <div className="studio-bench-product">
                    <div className="studio-bench-heading">
                      <h1>Product</h1>
                      <p>Ready on the right</p>
                    </div>
                    <div className="hiw-shot-product-stage is-compact">
                      <img src="/images/campaign-perfume-studio.jpg" alt="" />
                    </div>
                  </div>
                </div>
              </main>
            ) : null}

            {shot === 'library' || shot === 'saved' || shot === 'results' ? (
              <main className="app-main dash workspace-page hiw-shot-library">
                <header className="workspace-page-header">
                  <div className="workspace-page-title-row">
                    <h1>Library</h1>
                    <span className="dash-create-btn">Create images</span>
                  </div>
                  <p>Export keepers and pin favorites from your campaigns.</p>
                </header>
                <ul className="ws-card-grid">
                  {[
                    {
                      src: '/images/campaign-perfume-studio.jpg',
                      label: 'Studio packshot',
                      sub: 'Rose Oud · Today',
                    },
                    {
                      src: '/images/format-perfume-flatlay.jpg',
                      label: 'Flatlay',
                      sub: 'Rose Oud · Today',
                    },
                    {
                      src: '/images/format-perfume-in-hand.jpg',
                      label: 'In hand',
                      sub: 'Rose Oud · Today',
                    },
                    {
                      src: '/images/format-perfume-promo.jpg',
                      label: 'Promo / ad',
                      sub: 'Rose Oud · Today',
                    },
                  ].map((item) => (
                    <li key={item.label}>
                      <article className="ws-card">
                        <div className="ws-card-media">
                          <img src={item.src} alt="" />
                          <span className="ws-card-tag is-done">SAVED</span>
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
