import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import {
  listUserCampaigns,
  listUserProducts,
  type ProductSummary,
} from '../lib/campaigns'
import {
  resolveCampaignCover,
  resolveProductImage,
  stashProductImageSafe,
} from '../lib/localDemoCampaign'
import { relativeTime } from '../lib/workspaceUi'

function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <article className="product-card">
      <div className="product-card-media">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" />
        ) : (
          <span className="product-card-fallback" aria-hidden="true">
            Photo pending
          </span>
        )}
      </div>
      <div className="product-card-body">
        <h2>{product.name}</h2>
        <p>
          {product.brand || product.category || (product.sourceType === 'url' ? 'From URL' : 'Uploaded photo')}
          {product.campaignCount ? ` · ${product.campaignCount} project${product.campaignCount === 1 ? '' : 's'}` : ''}
        </p>
        <div className="product-card-meta">
          <span>{relativeTime({ updatedAt: product.updatedAt })}</span>
          {product.sourceUrl ? (
            <a href={product.sourceUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              Source
            </a>
          ) : null}
        </div>
        <div className="product-card-actions">
          <Link className="dash-create-btn dash-create-btn-sm" to="/app/studio/photos">
            New images
          </Link>
          <Link
            className="dash-create-btn dash-create-btn-ghost dash-create-btn-sm"
            to="/app/campaigns/new"
          >
            Full campaign
          </Link>
        </div>
      </div>
    </article>
  )
}

export default function ProductsPage() {
  const { user, loading } = useAuth()
  const [products, setProducts] = useState<ProductSummary[]>([])
  const [listError, setListError] = useState<string | null>(null)
  const [listing, setListing] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    ;(async () => {
      try {
        const [rows, campaigns] = await Promise.all([
          listUserProducts(user.uid),
          listUserCampaigns(user.uid),
        ])
        if (cancelled) return

        const campaignsByProduct = new Map<string, string[]>()
        for (const c of campaigns) {
          if (!c.productId) continue
          const list = campaignsByProduct.get(c.productId) ?? []
          list.push(c.id)
          campaignsByProduct.set(c.productId, list)
        }

        const enriched = await Promise.all(
          rows.map(async (product) => {
            let imageUrl = await resolveProductImage(product.id, product.imageUrl)
            if (!imageUrl) {
              const linked = campaignsByProduct.get(product.id) ?? []
              for (const campaignId of linked) {
                imageUrl = await resolveCampaignCover(campaignId, product.imageUrl)
                if (imageUrl) {
                  void stashProductImageSafe(product.id, imageUrl)
                  break
                }
              }
            }
            return imageUrl ? { ...product, imageUrl } : product
          }),
        )

        if (!cancelled) setProducts(enriched)
      } catch (err) {
        console.error(err)
        if (!cancelled) setListError('Could not load products.')
      } finally {
        if (!cancelled) setListing(false)
      }
    })()
    return () => {
      cancelled = true
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

  return (
    <AppLayout>
      <main className="dash dash-simple workspace-list">
        <header className="workspace-list-header">
          <div>
            <h1>Products</h1>
            <p>
              Your product catalog — each card uses the real product photo when available. Start a
              new image or full campaign from here.
            </p>
          </div>
          <Link className="dash-create-btn" to="/app/studio/photos">
            <span aria-hidden="true">+</span> Add product
          </Link>
        </header>

        {listError && (
          <p className="auth-error" role="alert">
            {listError}
          </p>
        )}

        {listing ? (
          <p className="dash-muted">Loading…</p>
        ) : products.length === 0 ? (
          <div className="dash-empty">
            <p>No products yet. Add one from Image Studio or start a full campaign.</p>
            <div className="workspace-empty-actions">
              <Link className="dash-create-btn dash-create-btn-sm" to="/app/studio/photos">
                Image Studio
              </Link>
              <Link
                className="dash-create-btn dash-create-btn-ghost dash-create-btn-sm"
                to="/app/campaigns/new"
              >
                Full campaign
              </Link>
            </div>
          </div>
        ) : (
          <div className="product-grid">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>
    </AppLayout>
  )
}
