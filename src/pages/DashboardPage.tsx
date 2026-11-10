import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CreativeShowcase from '../components/CreativeShowcase'
import { useAuth } from '../auth/AuthProvider'
import { listUserCampaigns, type CampaignDoc } from '../lib/campaigns'
import {
  loadRecentBrandProducts,
  rememberBrandProduct,
  type RecentBrandProduct,
} from '../lib/recentBrandProducts'
import { formatBrandDisplayName, workspaceInitials } from '../lib/userSettings'
import SimpleDashboardHome from './SimpleDashboardHome'

type EntryMode = 'upload' | 'url' | 'brand' | null

type SelectedBrandProduct = {
  id: string
  name: string
  imageUrl: string
  sourceUrl?: string
}

function normalizeProductUrl(raw: string) {
  const t = raw.trim()
  if (!t) return ''
  return /^https?:\/\//i.test(t) ? t : `https://${t}`
}

function firstNameFrom(userName: string | null | undefined, brandName: string) {
  const raw = (userName || '').trim() || brandName.trim()
  if (!raw) return 'there'
  return raw.split(/\s+/)[0] || 'there'
}

function formatUpdated(campaign: CampaignDoc) {
  const ms = campaign.updatedAt?.toMillis?.()
  if (!ms) return 'Recent'
  try {
    return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
      new Date(ms),
    )
  } catch {
    return 'Recent'
  }
}

export default function DashboardPage() {
  const { user, loading, workspace, onboardingSkipped } = useAuth()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<EntryMode>(null)
  const [productUrl, setProductUrl] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignDoc[]>([])
  const [selectedProduct, setSelectedProduct] = useState<SelectedBrandProduct | null>(null)
  const [productQuery, setProductQuery] = useState('')
  const [recents, setRecents] = useState<RecentBrandProduct[]>([])

  const brand = formatBrandDisplayName(workspace.brandName)
  const initials = workspaceInitials(brand)
  const website = workspace.brandWebsite
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
  const firstName = firstNameFrom(user?.displayName, brand)
  const [logoFailed, setLogoFailed] = useState(false)
  const logoUrl = workspace.brandLogoUrl && !logoFailed ? workspace.brandLogoUrl : ''

  useEffect(() => {
    setLogoFailed(false)
  }, [workspace.brandLogoUrl])
  const products = useMemo(
    () => workspace.brandScannedProducts || [],
    [workspace.brandScannedProducts],
  )
  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q))
  }, [products, productQuery])

  useEffect(() => {
    if (!user || onboardingSkipped) return
    setRecents(loadRecentBrandProducts(user.uid))
    let alive = true
    ;(async () => {
      try {
        const rows = await listUserCampaigns(user.uid)
        if (alive) setCampaigns(rows.slice(0, 6))
      } catch {
        if (alive) setCampaigns([])
      }
    })()
    return () => {
      alive = false
    }
  }, [user, onboardingSkipped])

  if (loading) {
    return (
      <div className="studio-shell studio-shell-alone">
        <p className="app-loading">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Skipped brand onboarding → classic simple home + create flow.
  if (onboardingSkipped) {
    return (
      <AppLayout>
        <SimpleDashboardHome />
      </AppLayout>
    )
  }

  function goStudio(kind: 'photos' | 'videos' | 'campaign') {
    if (entry === 'brand') {
      if (!selectedProduct) {
        setUrlError('Select a product from your brand site first.')
        return
      }
      if (user) {
        setRecents(rememberBrandProduct(user.uid, selectedProduct))
      }
      const params = new URLSearchParams()
      params.set('name', selectedProduct.name)
      if (selectedProduct.sourceUrl) {
        params.set('source', 'url')
        params.set('url', selectedProduct.sourceUrl)
      } else if (selectedProduct.imageUrl) {
        params.set('source', 'url')
        params.set('url', selectedProduct.imageUrl)
      }
      if (selectedProduct.imageUrl) {
        params.set('image', selectedProduct.imageUrl)
      }
      const q = params.toString()
      if (kind === 'campaign') navigate(`/app/campaigns/new?${q}`)
      else navigate(`/app/studio/${kind}?${q}`)
      return
    }
    if (entry === 'url') {
      const url = normalizeProductUrl(productUrl)
      if (!url) {
        setUrlError('Paste a product link to continue.')
        return
      }
      try {
        // eslint-disable-next-line no-new
        new URL(url)
      } catch {
        setUrlError('Enter a valid product URL.')
        return
      }
      setUrlError(null)
      const q = `source=url&url=${encodeURIComponent(url)}`
      if (kind === 'campaign') navigate(`/app/campaigns/new?${q}`)
      else navigate(`/app/studio/${kind}?${q}`)
      return
    }
    if (kind === 'campaign') navigate('/app/campaigns/new')
    else navigate(`/app/studio/${kind}`)
  }

  function onUrlSubmit(e: FormEvent) {
    e.preventDefault()
    goStudio('campaign')
  }

  return (
    <AppLayout>
      <main className="dash dash-home">
        <section className="dash-home-hero">
          <div className="dash-brand-mast">
            <div className="dash-brand-mast-mark">
              {logoUrl ? (
                <img src={logoUrl} alt="" onError={() => setLogoFailed(true)} />
              ) : (
                <span aria-hidden="true">{initials}</span>
              )}
            </div>
            <div className="dash-brand-mast-copy">
              <p>Your brand</p>
              <h2>{brand}</h2>
              {website ? (
                <a href={`https://${website}`} target="_blank" rel="noreferrer">
                  {website}
                </a>
              ) : (
                <span>Complete kit details anytime</span>
              )}
            </div>
            <Link to="/app/brand" className="dash-brand-mast-edit">
              Edit kit
            </Link>
          </div>

          <h1 className="dash-home-title">
            Create <em>your creatives</em>, {firstName}
          </h1>
          <p className="dash-home-sub">
            {products.length
              ? 'Pick a product from your site, upload a photo, or paste a link.'
              : 'Start with a product photo or paste a link.'}
          </p>

          <div className="dash-home-composer" data-open={entry ? 'true' : 'false'}>
            <div className="dash-home-entry">
              {products.length ? (
                <>
                  <button
                    type="button"
                    className={`dash-home-entry-btn${entry === 'brand' ? ' is-active' : ''}`}
                    onClick={() => {
                      setEntry('brand')
                      setUrlError(null)
                    }}
                  >
                    <span className="dash-home-entry-ico" aria-hidden="true">
                      ◆
                    </span>
                    <strong>From your site</strong>
                  </button>
                  <span className="dash-home-or">or</span>
                </>
              ) : null}
              <button
                type="button"
                className={`dash-home-entry-btn${entry === 'upload' ? ' is-active' : ''}`}
                onClick={() => {
                  setEntry('upload')
                  setSelectedProduct(null)
                  setUrlError(null)
                }}
              >
                <span className="dash-home-entry-ico" aria-hidden="true">
                  ↑
                </span>
                <strong>Upload product</strong>
              </button>
              <span className="dash-home-or">or</span>
              <button
                type="button"
                className={`dash-home-entry-btn${entry === 'url' ? ' is-active' : ''}`}
                onClick={() => {
                  setEntry('url')
                  setSelectedProduct(null)
                }}
              >
                <span className="dash-home-entry-ico" aria-hidden="true">
                  ⧉
                </span>
                <strong>Paste URL</strong>
              </button>
            </div>

            {entry ? (
              <div className="dash-home-dest">
                <div className="dash-home-dest-head">
                  <strong>
                    {entry === 'brand'
                      ? 'Select a product, then choose a studio'
                      : entry === 'url'
                        ? 'Paste link, then choose a studio'
                        : 'Choose a studio'}
                  </strong>
                  <button
                    type="button"
                    className="dash-home-dest-close"
                    onClick={() => {
                      setEntry(null)
                      setSelectedProduct(null)
                      setProductQuery('')
                      setUrlError(null)
                    }}
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                {entry === 'brand' ? (
                  <div className="dash-home-product-browser">
                    <div className="dash-home-product-toolbar">
                      <label className="dash-home-product-search">
                        <span className="sr-only">Search products</span>
                        <input
                          type="search"
                          value={productQuery}
                          onChange={(e) => setProductQuery(e.target.value)}
                          placeholder={`Search ${products.length} products…`}
                          autoFocus
                        />
                      </label>
                      <span className="dash-home-product-count">
                        {filteredProducts.length === products.length
                          ? `${products.length} in catalog`
                          : `${filteredProducts.length} of ${products.length}`}
                      </span>
                    </div>
                    <div
                      className="dash-home-product-pick"
                      role="listbox"
                      aria-label="Brand products"
                    >
                      {filteredProducts.length ? (
                        filteredProducts.map((product) => {
                          const active = selectedProduct?.id === product.id
                          return (
                            <button
                              key={product.id}
                              type="button"
                              role="option"
                              aria-selected={active}
                              className={`dash-home-product-card${active ? ' is-selected' : ''}`}
                              onClick={() => {
                                setSelectedProduct({
                                  id: product.id,
                                  name: product.name,
                                  imageUrl: product.imageUrl,
                                  sourceUrl: product.sourceUrl,
                                })
                                setUrlError(null)
                              }}
                            >
                              {product.imageUrl ? (
                                <img src={product.imageUrl} alt="" loading="lazy" />
                              ) : (
                                <span aria-hidden="true">{product.name.slice(0, 1)}</span>
                              )}
                              <em>{product.name}</em>
                            </button>
                          )
                        })
                      ) : (
                        <p className="dash-home-product-empty">No products match that search.</p>
                      )}
                    </div>
                  </div>
                ) : null}

                {entry === 'url' ? (
                  <form className="dash-home-url" onSubmit={onUrlSubmit}>
                    <input
                      value={productUrl}
                      onChange={(e) => {
                        setProductUrl(e.target.value)
                        if (urlError) setUrlError(null)
                      }}
                      placeholder={
                        website
                          ? `${website}/products/...`
                          : 'https://yourbrand.com/products/...'
                      }
                      autoFocus
                    />
                  </form>
                ) : null}

                {urlError ? (
                  <p className="dash-home-url-error" role="alert">
                    {urlError}
                  </p>
                ) : null}

                <div className="dash-home-dest-grid">
                  <button
                    type="button"
                    className="dash-home-dest-card"
                    onClick={() => goStudio('photos')}
                  >
                    <strong>Images</strong>
                    <span>Product & lifestyle stills</span>
                  </button>
                  <button
                    type="button"
                    className="dash-home-dest-card"
                    onClick={() => goStudio('videos')}
                  >
                    <strong>Videos</strong>
                    <span>UGC, ads, and clips</span>
                  </button>
                  <button
                    type="button"
                    className="dash-home-dest-card"
                    onClick={() => goStudio('campaign')}
                  >
                    <strong>Full campaign</strong>
                    <span>Strategy + creatives</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>

        </section>

        <CreativeShowcase />

        {recents.length ? (
          <section className="dash-home-recent" aria-labelledby="dash-recents-title">
            <div className="dash-home-recent-head">
              <h2 id="dash-recents-title">Recent</h2>
              <button
                type="button"
                className="dash-home-recent-linkbtn"
                onClick={() => {
                  setEntry('brand')
                  setProductQuery('')
                  setUrlError(null)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                Browse catalog
                {products.length ? ` · ${products.length}` : ''}
              </button>
            </div>
            <div className="dash-home-recent-grid">
              {recents.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  className="dash-home-recent-card dash-home-recent-card-btn"
                  onClick={() => {
                    setEntry('brand')
                    setSelectedProduct({
                      id: product.id,
                      name: product.name,
                      imageUrl: product.imageUrl,
                      sourceUrl: product.sourceUrl,
                    })
                    setUrlError(null)
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                >
                  <div className="dash-home-recent-media">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt="" loading="lazy" />
                    ) : (
                      <span className="dash-home-recent-fallback" aria-hidden="true">
                        {product.name.slice(0, 1)}
                      </span>
                    )}
                  </div>
                  <div className="dash-home-recent-body">
                    <strong>{product.name}</strong>
                    <span>Continue</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        ) : products.length ? (
          <section className="dash-home-recent" aria-labelledby="dash-recents-title">
            <div className="dash-home-recent-head">
              <h2 id="dash-recents-title">Recent</h2>
              <Link to="/app/products">View catalog</Link>
            </div>
            <div className="dash-home-empty-card dash-home-recent-empty">
              <strong>No recent products yet</strong>
              <p>
                Your full catalog has {products.length} products. Pick one above to start creating —
                it will show up here next time.
              </p>
              <button
                type="button"
                className="dash-home-recent-linkbtn"
                onClick={() => {
                  setEntry('brand')
                  setProductQuery('')
                  setUrlError(null)
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
              >
                Browse catalog
              </button>
            </div>
          </section>
        ) : null}

        {campaigns.length ? (
          <section className="dash-home-recent" aria-labelledby="dash-recent-title">
            <div className="dash-home-recent-head">
              <h2 id="dash-recent-title">Recent projects</h2>
              <Link to="/app/campaigns">View all</Link>
            </div>
            <div className="dash-home-recent-grid">
              {campaigns.map((c) => (
                <Link key={c.id} to={`/app/campaigns/${c.id}`} className="dash-home-recent-card">
                  <div className="dash-home-recent-media">
                    <span className="dash-home-recent-fallback" aria-hidden="true">
                      {(c.productName || c.title || 'P').slice(0, 1)}
                    </span>
                    <span className="dash-home-recent-tag">{c.status.replaceAll('_', ' ')}</span>
                  </div>
                  <div className="dash-home-recent-body">
                    <strong>{c.title || c.productName}</strong>
                    <span>{formatUpdated(c)}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : !products.length && !recents.length ? (
          <section className="dash-home-empty" aria-label="Getting started">
            <div className="dash-home-empty-card">
              <strong>Nothing here yet</strong>
              <p>Upload a product or paste a URL above to create your first creatives.</p>
            </div>
          </section>
        ) : null}
      </main>
    </AppLayout>
  )
}
