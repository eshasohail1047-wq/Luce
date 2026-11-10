import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import {
  formatBrandDisplayName,
  workspaceInitials,
} from '../lib/userSettings'

export type CreativePreviewItem = {
  id: string
  label: string
  kind: 'image' | 'video' | 'copy' | string
  imageUrl?: string
  videoUrl?: string
  text?: string
  productName?: string
}

type FormatId = 'ig' | 'story' | 'fb' | 'pin' | 'ad'

const FORMATS: {
  id: FormatId
  label: string
  ratio: string
  chrome: 'ig' | 'fb' | 'pin' | 'ad' | 'story'
  color: string
}[] = [
  { id: 'ig', label: 'Instagram', ratio: '4 / 5', chrome: 'ig', color: '#E1306C' },
  { id: 'story', label: 'Story', ratio: '9 / 16', chrome: 'story', color: '#111111' },
  { id: 'fb', label: 'Facebook', ratio: '1 / 1', chrome: 'fb', color: '#1877F2' },
  { id: 'pin', label: 'Pinterest', ratio: '2 / 3', chrome: 'pin', color: '#E60023' },
  { id: 'ad', label: 'Meta ad', ratio: '1 / 1', chrome: 'ad', color: '#16A34A' },
]

type CreativeFormatPreviewProps = {
  item: CreativePreviewItem
  open: boolean
  onClose: () => void
  actions?: ReactNode
}

export default function CreativeFormatPreview({
  item,
  open,
  onClose,
  actions,
}: CreativeFormatPreviewProps) {
  const { workspace } = useAuth()
  const [format, setFormat] = useState<FormatId>('ig')
  const active = FORMATS.find((f) => f.id === format) || FORMATS[0]!
  const brand = formatBrandDisplayName(workspace.brandName) || 'Your brand'
  const handle = brand.replace(/\s+/g, '').toLowerCase().slice(0, 18) || 'brand'
  const initials = workspaceInitials(brand)
  const caption =
    item.text?.trim() ||
    `${brand} · ${item.label}. Tap to explore.`

  const mediaKind = useMemo(() => {
    if (item.kind === 'video' && item.videoUrl) return 'video' as const
    if (item.imageUrl) return 'image' as const
    if (item.text) return 'copy' as const
    return 'empty' as const
  }, [item])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fmt-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.label} preview`}
      onClick={onClose}
    >
      <div className="fmt-preview-shell" onClick={(e) => e.stopPropagation()}>
        <aside className="fmt-preview-rail" aria-label="View as">
          <p>View as</p>
          {FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`fmt-preview-format${format === f.id ? ' is-active' : ''}`}
              aria-pressed={format === f.id}
              title={f.label}
              onClick={() => setFormat(f.id)}
            >
              <i style={{ background: f.color }} aria-hidden="true" />
              <span>{f.label}</span>
            </button>
          ))}
        </aside>

        <div className="fmt-preview-stage">
          <button
            type="button"
            className="fmt-preview-close"
            aria-label="Close preview"
            onClick={onClose}
          >
            ×
          </button>

          <div
            className={`fmt-preview-frame is-${active.chrome}`}
            style={{ aspectRatio: active.ratio }}
          >
            {(active.chrome === 'ig' || active.chrome === 'fb' || active.chrome === 'ad') && (
              <header className="fmt-preview-chrome-top">
                <div className="fmt-preview-avatar">
                  {workspace.brandLogoUrl ? (
                    <img src={workspace.brandLogoUrl} alt="" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                <div>
                  <strong>{handle}</strong>
                  <em>{active.chrome === 'ad' || active.chrome === 'fb' ? 'Sponsored' : 'Sponsored'}</em>
                </div>
              </header>
            )}

            <div className="fmt-preview-media">
              {mediaKind === 'video' ? (
                <video
                  key={item.id + format}
                  src={item.videoUrl}
                  poster={item.imageUrl}
                  controls
                  autoPlay
                  playsInline
                  loop
                />
              ) : mediaKind === 'image' ? (
                <img src={item.imageUrl} alt={item.label} />
              ) : mediaKind === 'copy' ? (
                <blockquote>{item.text}</blockquote>
              ) : (
                <p>No preview available.</p>
              )}
              {item.label ? <span className="fmt-preview-edit">{item.label}</span> : null}
            </div>

            {(active.chrome === 'ig' || active.chrome === 'fb' || active.chrome === 'ad') && (
              <footer className="fmt-preview-chrome-bottom">
                <div className="fmt-preview-actions-row" aria-hidden="true">
                  <span>♡</span>
                  <span>💬</span>
                  <span>➤</span>
                </div>
                <p>
                  <strong>{handle}</strong> {caption}
                </p>
              </footer>
            )}

            {active.chrome === 'story' ? (
              <div className="fmt-preview-story-bar" aria-hidden="true">
                <i />
                <i />
                <i />
              </div>
            ) : null}

            {active.chrome === 'pin' ? (
              <div className="fmt-preview-pin-meta">
                <strong>{item.label}</strong>
                <span>{brand}</span>
              </div>
            ) : null}
          </div>

          <div className="fmt-preview-meta">
            <div>
              <strong>{item.label}</strong>
              <span>
                {item.kind}
                {item.productName ? ` · ${item.productName}` : ''}
                {` · ${active.label}`}
              </span>
            </div>
            {actions ? <div className="fmt-preview-actions">{actions}</div> : null}
          </div>
        </div>
      </div>
    </div>
  )
}
