import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import type { FormatOption } from '../lib/deliverables'
import {
  DEFAULT_VIDEO_DURATION,
  MAX_PER_FORMAT,
  MAX_VIDEO_DURATION,
  MIN_VIDEO_DURATION,
  VIDEO_DURATION_OPTIONS,
  clampVideoDuration,
  setFormatDuration,
  setFormatQuantity,
  syncDurationsToQuantities,
  toggleFormatQuantity,
  totalQuantity,
  type FormatDurations,
  type FormatQuantities,
} from '../lib/formatQuantities'

type FormatPickGridProps<T extends string> = {
  items: FormatOption<T>[]
  /** Legacy checkbox mode (ads) */
  selected?: T[]
  onChange?: (next: T[]) => void
  /** Quantity mode (photos / videos): how many variants per format */
  quantities?: FormatQuantities
  onQuantitiesChange?: (next: FormatQuantities) => void
  /** Video Studio: seconds per selected format */
  durations?: FormatDurations
  onDurationsChange?: (next: FormatDurations) => void
  showDuration?: boolean
  disabled?: boolean
  defaultIds?: T[]
  /** Max total outputs across all formats (plan cap) */
  max?: number
  /** Max variants of a single format */
  maxPerFormat?: number
  ariaLabel: string
  videoAspect?: boolean
  onLimitHit?: () => void
  /** First card: upload your own reference instead of a preset format */
  referenceSlot?: {
    kind: 'image' | 'video'
    previewUrl?: string | null
    error?: string | null
    busy?: boolean
    onPickFile: (file: File | null) => void
    onPickUrl?: (url: string) => void | Promise<void>
  }
}

function FormatVideoCard({
  src,
  poster,
  label,
}: {
  src: string
  poster: string
  label: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const wrapRef = useRef<HTMLSpanElement>(null)

  const syncCardToVideoRatio = () => {
    const video = videoRef.current
    const wrap = wrapRef.current
    if (!video || !wrap || !video.videoWidth || !video.videoHeight) return
    const card = wrap.closest('.format-pick') as HTMLElement | null
    if (!card) return
    // Width fills the grid cell; height = original clip ratio (no empty top band)
    const width = card.getBoundingClientRect().width || card.clientWidth || 118
    if (!width) return
    const height = Math.round((width * video.videoHeight) / video.videoWidth)
    card.style.aspectRatio = `${video.videoWidth} / ${video.videoHeight}`
    card.style.setProperty('--video-card-h', `${height}px`)
    card.style.setProperty('height', `${height}px`, 'important')
    card.classList.add('is-video-ratio-ready')
  }

  useEffect(() => {
    const video = videoRef.current
    const wrap = wrapRef.current
    if (!video || !wrap) return

    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.loop = true

    syncCardToVideoRatio()
    video.addEventListener('loadedmetadata', syncCardToVideoRatio)
    video.addEventListener('loadeddata', syncCardToVideoRatio)

    const ro = new ResizeObserver(() => syncCardToVideoRatio())
    const card = wrap.closest('.format-pick')
    if (card) ro.observe(card)

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.25) {
            void video.play().catch(() => {})
          } else {
            video.pause()
          }
        }
      },
      { threshold: [0, 0.25, 0.5], rootMargin: '80px 0px' },
    )
    io.observe(wrap)
    return () => {
      ro.disconnect()
      io.disconnect()
      video.removeEventListener('loadedmetadata', syncCardToVideoRatio)
      video.removeEventListener('loadeddata', syncCardToVideoRatio)
    }
  }, [src])

  return (
    <span className="format-pick-media format-pick-media-video" ref={wrapRef}>
      {/* pointer-events:none so the parent select button receives the click */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        className="format-pick-video-el"
        aria-hidden="true"
        onLoadedMetadata={syncCardToVideoRatio}
      />
      <span className="format-pick-name">{label}</span>
      <span className="format-pick-check" aria-hidden="true">
        ✓
      </span>
    </span>
  )
}

export default function FormatPickGrid<T extends string>({
  items,
  selected = [],
  onChange,
  quantities,
  onQuantitiesChange,
  durations,
  onDurationsChange,
  showDuration,
  disabled,
  defaultIds = [],
  max,
  maxPerFormat = MAX_PER_FORMAT,
  ariaLabel,
  videoAspect,
  onLimitHit,
  referenceSlot,
}: FormatPickGridProps<T>) {
  const qtyMode = Boolean(onQuantitiesChange)
  const qtyMap = quantities || {}
  const durationMap = durations || {}
  const durationEnabled = Boolean(showDuration && onDurationsChange)
  const total = qtyMode ? totalQuantity(qtyMap) : selected.length
  const hasReference = Boolean(referenceSlot?.previewUrl)
  const usingDefaults = !hasReference && (qtyMode ? total === 0 : selected.length === 0)
  const refInputRef = useRef<HTMLInputElement>(null)
  const [refMode, setRefMode] = useState<'file' | 'url'>('file')
  const [refLink, setRefLink] = useState('')

  function clearFormatsForReference() {
    onQuantitiesChange?.({})
    if (durationEnabled) onDurationsChange?.({})
    if (onChange) onChange([])
  }

  function applyQuantities(nextQty: FormatQuantities) {
    if (hasReference && totalQuantity(nextQty) > 0) {
      referenceSlot?.onPickFile(null)
    }
    onQuantitiesChange?.(nextQty)
    if (durationEnabled) {
      onDurationsChange?.(syncDurationsToQuantities(nextQty, durationMap))
    }
  }

  function toggleLegacy(id: T) {
    if (!onChange) return
    if (hasReference) referenceSlot?.onPickFile(null)
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id))
      return
    }
    if (typeof max === 'number' && selected.length >= max) {
      onLimitHit?.()
      return
    }
    onChange([...selected, id])
  }

  function onCardActivate(id: T) {
    if (disabled) return
    if (!qtyMode) {
      toggleLegacy(id)
      return
    }
    const maxTotal = typeof max === 'number' ? max : 99
    const current = qtyMap[id] || 0
    if (current === 0 && total >= maxTotal) {
      onLimitHit?.()
      return
    }
    applyQuantities(toggleFormatQuantity(qtyMap, id, maxTotal))
  }

  function bump(id: T, delta: number) {
    if (disabled || !onQuantitiesChange) return
    const maxTotal = typeof max === 'number' ? max : 99
    const current = qtyMap[id] || 0
    if (delta > 0 && total >= maxTotal && current === 0) {
      onLimitHit?.()
      return
    }
    if (delta > 0 && total >= maxTotal) {
      onLimitHit?.()
      return
    }
    applyQuantities(
      setFormatQuantity(qtyMap, id, current + delta, maxTotal, maxPerFormat),
    )
  }

  function setDuration(id: T, seconds: number) {
    if (disabled || !onDurationsChange) return
    onDurationsChange(setFormatDuration(durationMap, id, seconds))
  }

  function onReferenceInput(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null
    if (file) clearFormatsForReference()
    referenceSlot?.onPickFile(file)
    e.target.value = ''
  }

  const isVideoRef = referenceSlot?.kind === 'video'
  const refBusy = Boolean(referenceSlot?.busy)

  async function applyReferenceLink() {
    const url = refLink.trim()
    if (!url || !referenceSlot?.onPickUrl || disabled || refBusy) return
    clearFormatsForReference()
    try {
      await referenceSlot.onPickUrl(url)
      // Parent sets preview on success; leave URL mode so filled card shows.
      setRefMode('file')
      setRefLink('')
    } catch {
      /* parent sets referenceSlot.error */
    }
  }

  function onReferenceLinkKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return
    // Nested inside Studio's <form> — never let Enter submit the outer form.
    e.preventDefault()
    e.stopPropagation()
    void applyReferenceLink()
  }

  const refUrlInputId = isVideoRef ? 'format-ref-video-url' : 'format-ref-image-url'

  return (
    <div
      className={`format-pick-grid${videoAspect ? ' format-pick-grid-video format-pick-grid-fastlane' : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      {referenceSlot ? (
        <div
          className={`format-pick format-pick-reference${hasReference ? ' is-checked' : ''}`}
          title={
            isVideoRef
              ? 'Add your own reference video instead of a preset format'
              : 'Add your own reference photo instead of a preset format'
          }
        >
          <input
            ref={refInputRef}
            type="file"
            accept={
              isVideoRef
                ? 'video/mp4,video/webm,video/quicktime'
                : 'image/jpeg,image/png,image/webp,image/gif'
            }
            hidden
            onChange={onReferenceInput}
            disabled={disabled || refBusy}
          />
          {hasReference ? (
            <>
              <div className="format-pick-media format-pick-media-ref">
                {isVideoRef ? (
                  <video
                    src={referenceSlot.previewUrl!}
                    muted
                    playsInline
                    preload="metadata"
                  />
                ) : (
                  <img src={referenceSlot.previewUrl!} alt="" />
                )}
                <span className="format-pick-tag">Yours</span>
                <span className="format-pick-check" aria-hidden="true">
                  ✓
                </span>
              </div>
              <span className="format-pick-body">
                <strong>Your reference</strong>
              </span>
              <div className="format-pick-ref-actions">
                <button
                  type="button"
                  className="format-pick-ref-chip"
                  disabled={disabled || refBusy}
                  onClick={() => {
                    setRefMode('file')
                    refInputRef.current?.click()
                  }}
                >
                  Replace
                </button>
                <button
                  type="button"
                  className="format-pick-ref-chip"
                  disabled={disabled || refBusy}
                  onClick={() => {
                    setRefLink('')
                    setRefMode('file')
                    referenceSlot.onPickFile(null)
                  }}
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <div
              className={`format-pick-ref-panel format-pick-ref-panel-empty${
                refMode === 'url' ? ' is-url-mode' : ''
              }`}
            >
              {refMode === 'url' && referenceSlot.onPickUrl ? (
                <div
                  className="format-pick-ref-url-sheet"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <p className="format-pick-ref-url-title">Paste a link</p>
                  <label className="sr-only" htmlFor={refUrlInputId}>
                    {isVideoRef ? 'Reference video URL' : 'Reference image URL'}
                  </label>
                  <input
                    id={refUrlInputId}
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    value={refLink}
                    onChange={(e) => setRefLink(e.target.value)}
                    onKeyDown={onReferenceLinkKeyDown}
                    placeholder={
                      isVideoRef
                        ? 'https://…/clip.mp4'
                        : 'https://…/photo.jpg or product page'
                    }
                    disabled={disabled || refBusy}
                    autoFocus
                  />
                  {referenceSlot.error ? (
                    <p className="format-pick-ref-error is-on-sheet" role="alert">
                      {referenceSlot.error}
                    </p>
                  ) : (
                    <p className="format-pick-ref-url-hint">
                      {isVideoRef
                        ? 'Direct video file link (mp4, webm, mov)'
                        : 'Image file or product page URL'}
                    </p>
                  )}
                  <div className="format-pick-ref-url-row">
                    <button
                      type="button"
                      className="format-pick-ref-chip is-ghost"
                      disabled={disabled || refBusy}
                      onClick={() => {
                        setRefMode('file')
                        setRefLink('')
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="format-pick-ref-chip is-solid"
                      disabled={disabled || refBusy || !refLink.trim()}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        void applyReferenceLink()
                      }}
                    >
                      {refBusy ? '…' : 'Add'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="format-pick-ref-empty">
                  <button
                    type="button"
                    className="format-pick-hit format-pick-ref-drop"
                    disabled={disabled || refBusy}
                    onClick={() => refInputRef.current?.click()}
                    aria-label={
                      isVideoRef ? 'Upload reference video' : 'Upload reference photo'
                    }
                  >
                    <span className="format-pick-media format-pick-media-blank">
                      <span className="format-pick-tag format-pick-tag-ref">
                        {refBusy
                          ? 'Loading…'
                          : isVideoRef
                            ? 'Your vibe'
                            : 'Your reference'}
                      </span>
                      <span className="format-pick-ref-plus" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                          <path
                            d="M12 7v10M7 12h10"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      </span>
                    </span>
                    <span className="format-pick-body">
                      {!refBusy ? (
                        <span>
                          {isVideoRef ? 'Drop a clip to match' : 'Drop a photo to match'}
                        </span>
                      ) : (
                        <strong>Loading…</strong>
                      )}
                    </span>
                  </button>
                  <div className="format-pick-ref-cta-row">
                    <button
                      type="button"
                      className="format-pick-ref-cta"
                      disabled={disabled || refBusy}
                      onClick={() => refInputRef.current?.click()}
                    >
                      Upload
                    </button>
                    {referenceSlot.onPickUrl ? (
                      <button
                        type="button"
                        className="format-pick-ref-cta is-soft"
                        disabled={disabled || refBusy}
                        onClick={() => setRefMode('url')}
                      >
                        Link
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}
          {referenceSlot.error ? (
            <p className="format-pick-ref-error" role="alert">
              {referenceSlot.error}
            </p>
          ) : null}
        </div>
      ) : null}

      {items.map((item) => {
        const count = qtyMode ? qtyMap[item.id] || 0 : selected.includes(item.id) ? 1 : 0
        const checked = count > 0
        const softDefault = usingDefaults && defaultIds.includes(item.id)
        return (
          <div
            key={item.id}
            className={`format-pick${videoAspect ? ' format-pick-fastlane' : ''}${checked ? ' is-checked' : ''}${softDefault ? ' is-default' : ''}${hasReference ? ' is-ref-dimmed' : ''}`}
            title={item.description}
          >
            <button
              type="button"
              className="format-pick-hit"
              aria-pressed={checked}
              disabled={disabled}
              onClick={() => onCardActivate(item.id)}
            >
              {videoAspect && item.videoUrl ? (
                <FormatVideoCard
                  src={item.videoUrl}
                  poster={item.thumb}
                  label={item.label}
                />
              ) : (
                <>
                  <span className="format-pick-media">
                    <img src={item.thumb} alt="" />
                    {item.tag ? (
                      <span className="format-pick-tag">{item.tag}</span>
                    ) : null}
                    <span className="format-pick-check" aria-hidden="true">
                      ✓
                    </span>
                  </span>
                  <span className="format-pick-body">
                    <strong>{item.label}</strong>
                    <span>{item.description}</span>
                  </span>
                </>
              )}
            </button>
            {videoAspect && item.videoUrl ? (
              <button
                type="button"
                className="format-pick-mute"
                aria-label={`Toggle sound for ${item.label} preview`}
                title="Sound"
                disabled={disabled}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const root = e.currentTarget.parentElement
                  const v = root?.querySelector('video')
                  if (!(v instanceof HTMLVideoElement)) return
                  v.muted = !v.muted
                  void v.play().catch(() => {})
                }}
              >
                ♪
              </button>
            ) : null}

            {qtyMode && checked ? (
              <div
                className="format-pick-qty"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div className="format-pick-qty-row">
                  <span className="format-pick-qty-label">Variants</span>
                  <div className="format-pick-qty-controls">
                    <button
                      type="button"
                      className="format-pick-qty-btn"
                      aria-label={`Fewer ${item.label}`}
                      disabled={disabled || count <= 1}
                      onClick={() => bump(item.id, -1)}
                    >
                      −
                    </button>
                    <span className="format-pick-qty-value" aria-live="polite">
                      {count}
                    </span>
                    <button
                      type="button"
                      className="format-pick-qty-btn"
                      aria-label={`More ${item.label}`}
                      disabled={
                        disabled ||
                        count >= maxPerFormat ||
                        (typeof max === 'number' && total >= max)
                      }
                      onClick={() => bump(item.id, 1)}
                    >
                      +
                    </button>
                  </div>
                </div>
                {durationEnabled ? (
                  <div className="format-pick-duration" role="group" aria-label={`${item.label} length`}>
                    <span className="format-pick-qty-label">Length</span>
                    <div className="format-pick-duration-options">
                      {VIDEO_DURATION_OPTIONS.map((sec) => {
                        const active =
                          clampVideoDuration(
                            durationMap[item.id] ?? DEFAULT_VIDEO_DURATION,
                          ) === sec
                        return (
                          <button
                            key={sec}
                            type="button"
                            className={`format-pick-duration-btn${active ? ' is-active' : ''}`}
                            aria-pressed={active}
                            disabled={disabled}
                            onClick={() => setDuration(item.id, sec)}
                          >
                            {sec}s
                          </button>
                        )
                      })}
                      <label className="format-pick-duration-custom">
                        <span className="sr-only">Custom seconds</span>
                        <input
                          type="number"
                          min={MIN_VIDEO_DURATION}
                          max={MAX_VIDEO_DURATION}
                          step={1}
                          inputMode="numeric"
                          disabled={disabled}
                          value={clampVideoDuration(
                            durationMap[item.id] ?? DEFAULT_VIDEO_DURATION,
                          )}
                          aria-label={`${item.label} custom length in seconds`}
                          title={`Custom length (${MIN_VIDEO_DURATION}–${MAX_VIDEO_DURATION} seconds)`}
                          onChange={(e) => {
                            const v = e.target.value
                            if (v === '') return
                            setDuration(item.id, Number(v))
                          }}
                          onBlur={(e) => {
                            setDuration(item.id, Number(e.target.value))
                          }}
                        />
                        <span aria-hidden="true">s</span>
                      </label>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
