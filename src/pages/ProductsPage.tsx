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

function productTag(product: ProductSummary) {
  if (product.sourceType === 'url') return 'URL'
  return 'Upload'
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
      <main className="dash workspace-page">
        <header className="workspace-page-header">
          <div className="workspace-page-title-row">
            <h1>Products</h1>
            <Link className="dash-create-btn" to="/app/studio/photos">
              <span aria-hidden="true">+</span> Add
            </Link>
          </div>
        </header>

        {listError && (
          <p className="auth-error" role="alert">
            {listError}
          </p>
        )}

        {listing ? (
          <p className="workspace-page-empty">Loading…</p>
        ) : products.length === 0 ? (
          <div className="workspace-page-empty-card">
            <p>No products yet.</p>
            <Link className="dash-create-btn dash-create-btn-sm" to="/app">
              Create from dashboard
            </Link>
          </div>
        ) : (
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
        )}
      </main>
    </AppLayout>
  )
}
