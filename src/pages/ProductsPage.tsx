import { useEffect, useRef, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import {
  backfillProductImageUrl,
  listUserCampaigns,
  listUserProducts,
  updateProductPhoto,
  type ProductSummary,
} from '../lib/campaigns'
import {
  resolveCampaignCover,
  resolveProductImage,
  stashProductImageSafe,
} from '../lib/localDemoCampaign'
import { relativeTime } from '../lib/workspaceUi'

function productInitial(name: string) {
  const letter = name.trim().charAt(0)
  return letter ? letter.toUpperCase() : 'P'
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
  const campaignTo = `/app/campaigns/new?productId=${encodeURIComponent(product.id)}`

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
    <article className="product-card">
      <div className="product-card-media">
        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" />
        ) : (
          <button
            type="button"
            className="product-card-fallback product-card-fallback-btn"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label={`Add photo for ${product.name}`}
          >
            <span className="product-card-initial">{productInitial(product.name)}</span>
            <span className="product-card-fallback-hint">
              {uploading ? 'Uploading…' : 'Add photo'}
            </span>
          </button>
        )}
        {product.imageUrl ? (
          <button
            type="button"
            className="product-card-replace"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : 'Replace photo'}
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
      <div className="product-card-body">
        <h2>{product.name}</h2>
        <p>
          {product.brand ||
            product.category ||
            (product.sourceType === 'url' ? 'From URL' : 'Uploaded photo')}
          {product.campaignCount
            ? ` · ${product.campaignCount} project${product.campaignCount === 1 ? '' : 's'}`
            : ''}
        </p>
        {uploadError ? (
          <p className="product-card-upload-error" role="alert">
            {uploadError}
          </p>
        ) : null}
        <div className="product-card-meta">
          <span>{relativeTime({ updatedAt: product.updatedAt })}</span>
          {product.sourceUrl ? (
            <a
              href={product.sourceUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              Source
            </a>
          ) : null}
        </div>
        <div className="product-card-actions">
          <Link className="dash-create-btn dash-create-btn-sm" to={studioTo}>
            New images
          </Link>
          <Link
            className="dash-create-btn dash-create-btn-ghost dash-create-btn-sm"
            to={campaignTo}
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
                if (imageUrl) break
              }
            }
            if (imageUrl) {
              void stashProductImageSafe(product.id, imageUrl)
              // Persist recovered covers so other devices/browsers see them too.
              if (!product.imageUrl || product.imageUrl !== imageUrl) {
                void backfillProductImageUrl(product.id, imageUrl)
              }
              return { ...product, imageUrl }
            }
            return product
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
              Your product catalog — click Add photo on any card missing an image, then start new
              images or a full campaign from here.
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
              <ProductCard
                key={product.id}
                product={product}
                userId={user.uid}
                onPhotoUpdated={(productId, imageUrl) => {
                  setProducts((prev) =>
                    prev.map((p) => (p.id === productId ? { ...p, imageUrl } : p)),
                  )
                }}
              />
            ))}
          </div>
        )}
      </main>
    </AppLayout>
  )
}
