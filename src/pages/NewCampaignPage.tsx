import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import { createCampaignWithProduct, type ProductSourceType } from '../lib/campaigns'
import {
  CAMPAIGN_DELIVERABLES,
  type DeliverableId,
} from '../lib/deliverables'

export default function NewCampaignPage() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [sourceType, setSourceType] = useState<ProductSourceType>('upload')
  const [productName, setProductName] = useState('')
  const [productUrl, setProductUrl] = useState('')
  const [description, setDescription] = useState('')
  const [brand, setBrand] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [selectedDeliverables, setSelectedDeliverables] = useState<DeliverableId[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(imageFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  useEffect(() => {
    try {
      const pendingUrl = sessionStorage.getItem('luce.pendingProductUrl')
      if (pendingUrl) {
        setSourceType('url')
        setProductUrl(pendingUrl)
        setShowDetails(true)
        sessionStorage.removeItem('luce.pendingProductUrl')
      }
      sessionStorage.removeItem('luce.pendingProductHint')
    } catch {
      /* ignore */
    }
  }, [])

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

  function pickFile(file: File | null | undefined) {
    setError(null)
    setWarning(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image (JPG, PNG, or WebP).')
      return
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('Image must be under 12MB.')
      return
    }
    setImageFile(file)
    if (!productName.trim()) {
      const guess = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim()
      if (guess) setProductName(guess)
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDragOver(false)
    pickFile(e.dataTransfer.files?.[0])
  }

  function toggleDeliverable(id: DeliverableId) {
    setSelectedDeliverables((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setBusy(true)
    setError(null)
    setWarning(null)
    try {
      const result = await createCampaignWithProduct({
        userId: user.uid,
        sourceType,
        productName: productName.trim() || undefined,
        productUrl: productUrl.trim() || undefined,
        description: description.trim() || undefined,
        brand: brand.trim() || undefined,
        price: price.trim() || undefined,
        category: category.trim() || undefined,
        imageFile: sourceType === 'upload' ? imageFile : null,
        deliverables: selectedDeliverables,
      })
      if (result.storageWarning) setWarning(result.storageWarning)
      navigate(`/app/campaigns/${result.campaignId}`, { replace: true })
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : 'Could not create campaign.')
    } finally {
      setBusy(false)
    }
  }

  const usingDefaults = selectedDeliverables.length === 0

  return (
    <AppLayout>
      <main className="app-main campaign-create studio-page">
        <header className="create-banner tone-campaign">
          <div className="create-banner-copy">
            <p className="dash-kicker">Campaign</p>
            <h1>New campaign</h1>
            <p className="app-lead">
              Add a product photo or URL. Leave options blank for a full pack.
            </p>
          </div>
          <div className="create-banner-media" aria-hidden="true">
            <img src="/images/campaign-perfume-studio.jpg" alt="" />
          </div>
        </header>

        <form className="app-form campaign-form create-panel" onSubmit={onSubmit}>
          <section className="form-section">
            <div className="form-section-head">
              <h2>Product</h2>
            </div>

            <div className="source-toggle" role="tablist" aria-label="Product source">
              <button
                type="button"
                role="tab"
                aria-selected={sourceType === 'upload'}
                className={sourceType === 'upload' ? 'is-active' : ''}
                onClick={() => {
                  setSourceType('upload')
                  setError(null)
                }}
                disabled={busy}
              >
                <span className="source-toggle-title">Photo</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={sourceType === 'url'}
                className={sourceType === 'url' ? 'is-active' : ''}
                onClick={() => {
                  setSourceType('url')
                  setError(null)
                  setShowDetails(true)
                }}
                disabled={busy}
              >
                <span className="source-toggle-title">Product URL</span>
              </button>
            </div>

            {sourceType === 'upload' ? (
              <div className="upload-block">
                <input
                  ref={fileInputRef}
                  id="product-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  hidden
                  onChange={(e) => pickFile(e.target.files?.[0])}
                  disabled={busy}
                />

                <div
                  className={`upload-drop${dragOver ? ' is-over' : ''}${previewUrl ? ' has-preview' : ''}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                >
                  {previewUrl ? (
                    <div className="upload-preview">
                      <img src={previewUrl} alt="Product preview" />
                      <div className="upload-preview-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={busy}
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => setImageFile(null)}
                          disabled={busy}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="upload-empty"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={busy}
                    >
                      <span className="upload-empty-title">Drop product photo here</span>
                      <span className="upload-empty-copy">JPG, PNG, or WebP · up to 12MB</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="url-block">
                <label htmlFor="product-url">Product page URL</label>
                <input
                  id="product-url"
                  type="url"
                  required
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="https://yourstore.com/products/…"
                  disabled={busy}
                />
              </div>
            )}

            <div className="details-head">
              <div>
                <h2>Details</h2>
                <p>Optional</p>
              </div>
              <button
                type="button"
                className="details-toggle"
                onClick={() => setShowDetails((v) => !v)}
                disabled={busy}
              >
                {showDetails ? 'Hide' : 'Show'}
              </button>
            </div>

            {showDetails && (
              <div className="details-grid">
                <div className="auth-field">
                  <label htmlFor="product-name">Product name</label>
                  <input
                    id="product-name"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Rose Oud Perfume"
                    disabled={busy}
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="product-brand">Brand</label>
                  <input
                    id="product-brand"
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    placeholder="Maison Luce"
                    disabled={busy}
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="product-price">Price</label>
                  <input
                    id="product-price"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="$48"
                    disabled={busy}
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="product-category">Category</label>
                  <input
                    id="product-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Fragrance"
                    disabled={busy}
                  />
                </div>

                <div className="auth-field details-span">
                  <label htmlFor="product-desc">Description</label>
                  <textarea
                    id="product-desc"
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Notes, benefits, who it’s for…"
                    disabled={busy}
                  />
                </div>
              </div>
            )}
          </section>

          <section className="form-section">
            <div className="form-section-head">
              <h2>Include in campaign</h2>
              <p>
                {usingDefaults
                  ? 'Nothing selected — full campaign will be created.'
                  : `${selectedDeliverables.length} selected`}
              </p>
            </div>

            <div className="check-grid" role="group" aria-label="Campaign deliverables">
              {CAMPAIGN_DELIVERABLES.map((item) => {
                const checked = selectedDeliverables.includes(item.id)
                return (
                  <label
                    key={item.id}
                    className={`check-card${checked ? ' is-checked' : ''}${usingDefaults ? ' is-default' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleDeliverable(item.id)}
                      disabled={busy}
                    />
                    <span className="check-card-body">
                      <strong>{item.label}</strong>
                      <span>{item.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </section>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}
          {warning && (
            <p className="auth-notice" role="status">
              {warning}
            </p>
          )}

          <button type="submit" className="btn btn-grad campaign-submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create campaign'}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      </main>
    </AppLayout>
  )
}
