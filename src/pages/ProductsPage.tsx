import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import {
  listUserProducts,
  updateProductPhoto,
  type ProductSummary,
} from '../lib/campaigns'
import { stashProductImageSafe } from '../lib/localDemoCampaign'
import { rememberBrandProduct } from '../lib/recentBrandProducts'
import type { ScannedProduct } from '../lib/userSettings'
import { relativeTime } from '../lib/workspaceUi'

function productInitial(name: string) {
  const letter = name.trim().charAt(0)
  return letter ? letter.toUpperCase() : 'P'
}

function productTag(product: ProductSummary) {
  if (product.sourceType === 'url') return 'URL'
  return 'Upload'
}

function studioQuery(product: {
  name: string
  imageUrl?: string
  sourceUrl?: string
}) {
  const params = new URLSearchParams()
  params.set('name', product.name)
  if (product.sourceUrl) {
    params.set('source', 'url')
    params.set('url', product.sourceUrl)
  } else if (product.imageUrl) {
    params.set('source', 'url')
    params.set('url', product.imageUrl)
  }
  if (product.imageUrl) params.set('image', product.imageUrl)
  return params.toString()
}

function BrandCatalogCard({
  product,
  userId,
}: {
  product: ScannedProduct
  userId: string
}) {
  const q = studioQuery(product)
  return (
    <article className="ws-card">
      <div className="ws-card-media">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <div className="ws-card-fallback">
            <span className="product-card-initial">{productInitial(product.name)}</span>
          </div>
        )}
        <span className="ws-card-tag is-done">Site</span>
      </div>
      <div className="ws-card-body">
        <strong>{product.name}</strong>
        <span>From your brand site</span>
      </div>
      <div className="ws-card-actions">
        <Link
          className="dash-campaign-delete-btn dash-campaign-delete-btn-cancel"
          to={`/app/studio/photos?${q}`}
          onClick={() => rememberBrandProduct(userId, product)}
        >
          Images
        </Link>
        <Link
          className="dash-campaign-delete-btn dash-campaign-delete-btn-cancel"
          to={`/app/studio/videos?${q}`}
          onClick={() => rememberBrandProduct(userId, product)}
        >
          Videos
        </Link>
        <Link
          className="dash-campaign-delete-btn dash-campaign-delete-btn-cancel"
          to={`/app/campaigns/new?${q}`}
          onClick={() => rememberBrandProduct(userId, product)}
        >
          Campaign
        </Link>
      </div>
    </article>
  )
}

function ProductCard({
  product,
  userId,
  onPhotoUpdated,
}: {
  product: ProductSummary
  userId: string
  onPhotoUpdated: (productId: string, imageUrl: string) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const studioTo = `/app/studio/photos?productId=${encodeURIComponent(product.id)}`
  const videoTo = `/app/studio/videos?productId=${encodeURIComponent(product.id)}`
  const campaignTo = `/app/campaigns/new?productId=${encodeURIComponent(product.id)}`
  const tag = productTag(product)

  async function onPickPhoto(file: File | null) {
    if (!file) return
    setUploadError(null)
    setUploading(true)
    try {
      const result = await updateProductPhoto({
        userId,
        productId: product.id,
        imageFile: file,
      })
      await stashProductImageSafe(product.id, result.imageUrl)
      onPhotoUpdated(product.id, result.imageUrl)
      if (result.storageWarning) setUploadError(result.storageWarning)
    } catch (err) {
      console.error(err)
      setUploadError(err instanceof Error ? err.message : 'Could not upload photo.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <article className="ws-card">
      <div className="ws-card-media">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" loading="lazy" decoding="async" />
        ) : (
          <button
            type="button"
            className="ws-card-fallback ws-card-fallback-btn"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={`Add photo for ${product.name}`}
          >
            <span className="product-card-initial">{productInitial(product.name)}</span>
            <span>{uploading ? 'Uploading…' : 'Add photo'}</span>
          </button>
        )}
        <span className="ws-card-tag is-done">{tag}</span>
        {product.imageUrl ? (
          <button
            type="button"
            className="ws-card-export"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? '…' : 'Replace'}
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          hidden
          onChange={(e) => void onPickPhoto(e.target.files?.[0] ?? null)}
        />
      </div>
      <div className="ws-card-body">
        <strong>{product.name}</strong>
        <span>
          {product.brand || product.category || (product.sourceType === 'url' ? 'From URL' : 'Uploaded')}
          {product.campaignCount
            ? ` · ${product.campaignCount} project${product.campaignCount === 1 ? '' : 's'}`
            : ''}
          <span aria-hidden="true"> · </span>
          {relativeTime({ updatedAt: product.updatedAt })}
        </span>
        {uploadError ? (
          <span className="product-card-upload-error" role="alert">
            {uploadError}
          </span>
        ) : null}
      </div>
      <div className="ws-card-actions">
        <Link className="dash-campaign-delete-btn dash-campaign-delete-btn-cancel" to={studioTo}>
          Images
        </Link>
        <Link className="dash-campaign-delete-btn dash-campaign-delete-btn-cancel" to={videoTo}>
          Videos
        </Link>
        <Link className="dash-campaign-delete-btn dash-campaign-delete-btn-cancel" to={campaignTo}>
          Campaign
        </Link>
      </div>
    </article>
  )
}

export default function ProductsPage() {
  const { user, loading, workspace } = useAuth()
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [listing, setListing] = useState(true)
  const [query, setQuery] = useState('')

  const brandCatalog = workspace.brandScannedProducts || []
  const filteredCatalog = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return brandCatalog
    return brandCatalog.filter((p) => p.name.toLowerCase().includes(q))
  }, [brandCatalog, query])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const safety = window.setTimeout(() => {
      if (!cancelled) {
        setListing(false)
        setListError((prev) => prev ?? 'Products is taking longer than usual — retry in a moment.')
      }
    }, 18_000)
    ;(async () => {
      try {
        const rows = await listUserProducts(user.uid)
        if (!cancelled) {
          setProducts(rows)
          setListError(null)
        }
      } catch (err) {
        console.error(err)
        if (!cancelled) setListError('Could not load products.')
      } finally {
        window.clearTimeout(safety)
        if (!cancelled) setListing(false)
      }
    })()
    return () => {
      cancelled = true
      window.clearTimeout(safety)
    }
  }, [user])

  if (loading) {
    return (
      <div className="studio-shell studio-shell-alone">
        <p className="app-loading">Loading…</p>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  const empty = !listing && !brandCatalog.length && !products.length

  return (
    <AppLayout>
      <main className="dash workspace-page">
        <header className="workspace-page-header">
          <div className="workspace-page-title-row">
            <h1>Products</h1>
            <Link className="dash-create-btn" to="/app/studio/photos">
              <span aria-hidden="true">+</span> Add
            </Link>
          </div>
          {brandCatalog.length || products.length ? (
            <p className="workspace-page-sub">
              {brandCatalog.length
                ? `${brandCatalog.length} from your site`
                : null}
              {brandCatalog.length && products.length ? ' · ' : null}
              {products.length
                ? `${products.length} saved from studio / campaigns`
                : null}
            </p>
          ) : (
            <p className="workspace-page-sub">
              Products you generate with are saved here automatically.
            </p>
          )}
        </header>

        {brandCatalog.length ? (
          <div className="products-catalog-toolbar">
            <label className="products-catalog-search">
              <span className="sr-only">Search catalog</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${brandCatalog.length} products…`}
              />
            </label>
            <span className="products-catalog-count">
              {filteredCatalog.length === brandCatalog.length
                ? `${brandCatalog.length} in catalog`
                : `${filteredCatalog.length} of ${brandCatalog.length}`}
            </span>
          </div>
        ) : null}

        {listError && (
          <p className="auth-error" role="alert">
            {listError}
          </p>
        )}

        {listing && !brandCatalog.length ? (
          <p className="workspace-page-empty">Loading…</p>
        ) : empty ? (
          <div className="workspace-page-empty-card">
            <p>No products yet.</p>
            <Link className="dash-create-btn dash-create-btn-sm" to="/app">
              Create from dashboard
            </Link>
          </div>
        ) : (
          <>
            {brandCatalog.length ? (
              <section className="products-catalog-section" aria-labelledby="products-site-title">
                <h2 id="products-site-title" className="products-catalog-heading">
                  From your site
                </h2>
                {filteredCatalog.length ? (
                  <ul className="ws-card-grid">
                    {filteredCatalog.map((product) => (
                      <li key={product.id}>
                        <BrandCatalogCard product={product} userId={user.uid} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="workspace-page-empty">No products match that search.</p>
                )}
              </section>
            ) : null}

            {products.length ? (
              <section className="products-catalog-section" aria-labelledby="products-luce-title">
                <h2 id="products-luce-title" className="products-catalog-heading">
                  Your products
                </h2>
                <ul className="ws-card-grid">
                  {products.map((product) => (
                    <li key={product.id}>
                      <ProductCard
                        product={product}
                        userId={user.uid}
                        onPhotoUpdated={(productId, imageUrl) => {
                          setProducts((prev) =>
                            prev.map((p) => (p.id === productId ? { ...p, imageUrl } : p)),
                          )
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        )}
      </main>
    </AppLayout>
  )
}
