import { useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import FormatPickGrid from '../components/FormatPickGrid'
import Logo from '../Logo'
import { DEFAULT_PHOTO_STYLES, PHOTO_STYLES } from '../lib/deliverables'
import type { FormatQuantities } from '../lib/formatQuantities'

/**
 * Public mock of the real AppLayout chrome for landing “How it works” shots.
 * Visit /demo/hiw?shot=product|formats|results|saved
 */
export default function HiwShotsPage() {
  const [params] = useSearchParams()
  const shot = (params.get('shot') || 'formats').toLowerCase()
  const [photoQuantities, setPhotoQuantities] = useState<FormatQuantities>({})

  const allowed = useMemo(
    () => new Set(['product', 'formats', 'results', 'saved']),
    [],
  )
  if (!allowed.has(shot)) {
    return <Navigate to="/demo/hiw?shot=formats" replace />
  }

  const createActive =
    shot === 'product' || shot === 'formats'
      ? 'photos'
      : shot === 'results'
        ? 'campaigns'
        : 'saved'

  return (
    <div className="hiw-shot hiw-shot-real" data-hiw-shot={shot}>
      <div className="hiw-shot-capture studio-shell">
        <aside className="studio-rail" aria-hidden="true">
          <div className="studio-rail-brand">
            <Logo href={null} />
          </div>
          <div className="studio-rail-scroll">
            <nav className="studio-rail-nav">
              <span className="studio-rail-link">
                <span>Dashboard</span>
              </span>
              <span className="studio-rail-link">
                <span>Products</span>
              </span>
              <span
                className={`studio-rail-link${createActive === 'campaigns' ? ' is-active' : ''}`}
              >
                <span>Projects</span>
              </span>
              <span
                className={`studio-rail-link${createActive === 'saved' ? ' is-active' : ''}`}
              >
                <span>Saved</span>
              </span>
            </nav>
            <div className="studio-rail-group">
              <p className="studio-rail-label">Create</p>
              <nav className="studio-rail-nav">
                <span
                  className={`studio-rail-link${createActive === 'photos' ? ' is-active' : ''}`}
                >
                  <span>Image Studio</span>
                </span>
                <span className="studio-rail-link">
                  <span>Video Studio</span>
                </span>
                <span className="studio-rail-link">
                  <span>Ads &amp; Social</span>
                </span>
                <span className="studio-rail-link">
                  <span>Full Campaign</span>
                </span>
              </nav>
            </div>
            <div className="studio-rail-group">
              <p className="studio-rail-label">General</p>
              <nav className="studio-rail-nav">
                <span className="studio-rail-link">
                  <span>Settings</span>
                </span>
              </nav>
            </div>
          </div>
        </aside>

        <div className="studio-stage">
          <header className="studio-topbar">
            <div className="studio-topbar-left">
              <label className="studio-topbar-search">
                <span className="sr-only">Search</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input type="search" readOnly placeholder="Search products, campaigns…" value="" />
              </label>
            </div>
            <div className="studio-topbar-right">
              <div className="studio-account-chip hiw-shot-account">
                <span className="hiw-shot-avatar" aria-hidden="true">
                  E
                </span>
                <span className="hiw-shot-account-copy">
                  <strong>Esha Sohail</strong>
                  <em>Starter plan</em>
                </span>
              </div>
            </div>
          </header>

          <div className="hiw-shot-main-real">
            {shot === 'product' ? (
              <main className="app-main campaign-create studio-page studio-page-photo">
                <header className="studio-hero tone-photo">
                  <div className="studio-hero-copy">
                    <p className="studio-hero-kicker">Image Studio</p>
                    <h1>Craft product images</h1>
                    <p className="studio-hero-lead">
                      Product photo or URL → optional reference + prompt → pick formats and how many
                      variants each.
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
                      <h2>3. Pick formats &amp; variants</h2>
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
              <main className="app-main dash dash-simple">
                <header className="workspace-list-header hiw-shot-detail-head">
                  <div>
                    <p className="studio-hero-kicker">Campaign</p>
                    <h1>Miss Rose Foundation — Photos</h1>
                    <p>Preview each asset, then export or save keepers.</p>
                  </div>
                  <div className="detail-actions hiw-shot-detail-actions">
                    <button type="button" className="btn btn-grad">
                      Export pack
                    </button>
                    <button type="button" className="btn btn-ghost">
                      Save all to Saved
                    </button>
                  </div>
                </header>
                <section className="hiw-shot-results results-section">
                  <div className="dash-panel-head">
                    <h2>Campaign results</h2>
                    <span className="library-count">4</span>
                  </div>
                  <p className="results-lead">
                    Review pack for <strong>Miss Rose Foundation</strong>. Don’t like one? Recreate
                    in studio.
                  </p>
                  <div className="results-layout hiw-shot-results-grid">
                    <div className="results-rail">
                      {[
                        {
                          src: '/images/campaign-perfume-studio.jpg',
                          label: 'Studio packshot',
                        },
                        {
                          src: '/images/format-perfume-flatlay.jpg',
                          label: 'Flatlay',
                        },
                        {
                          src: '/images/format-perfume-in-hand.jpg',
                          label: 'In hand',
                        },
                        {
                          src: '/images/format-perfume-promo.jpg',
                          label: 'Promo / ad',
                        },
                      ].map((item, i) => (
                        <button
                          key={item.src}
                          type="button"
                          className={`results-thumb ${i === 0 ? 'is-active' : ''}`}
                        >
                          <img src={item.src} alt="" />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                    <aside className="results-preview">
                      <p className="results-preview-kicker">Selected · Studio packshot</p>
                      <h3>Studio packshot</h3>
                      <div className="results-preview-media">
                        <img src="/images/campaign-perfume-studio.jpg" alt="" />
                      </div>
                      <div className="results-preview-actions">
                        <button type="button" className="btn btn-ghost">
                          Export
                        </button>
                        <button type="button" className="btn btn-grad">
                          Save
                        </button>
                      </div>
                    </aside>
                  </div>
                </section>
              </main>
            ) : null}

            {shot === 'saved' ? (
              <main className="app-main dash dash-simple workspace-list">
                <header className="workspace-list-header">
                  <div>
                    <h1>Saved</h1>
                    <p>Creatives you save from a campaign — export anytime.</p>
                  </div>
                  <span className="dash-create-btn">Create images</span>
                </header>
                <ul className="campaign-media-grid">
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
                      <article className="campaign-media-card saved-asset-card">
                        <div className="campaign-media-link saved-asset-media">
                          <div className="campaign-media-frame">
                            <img className="campaign-media-img" src={item.src} alt="" />
                            <span className="campaign-media-shade" />
                          </div>
                          <div className="campaign-media-copy">
                            <span className="dash-badge dash-badge-done campaign-media-badge">
                              Saved
                            </span>
                            <strong>{item.label}</strong>
                            <span className="campaign-media-sub">{item.sub}</span>
                          </div>
                          <div
                            className="saved-asset-overlay"
                            style={{ opacity: 1, transform: 'none' }}
                          >
                            <button type="button" className="btn btn-grad saved-asset-export">
                              Export
                            </button>
                          </div>
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
