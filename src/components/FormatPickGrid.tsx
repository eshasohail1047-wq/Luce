import { useEffect, useRef } from 'react'
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

  useEffect(() => {
    const video = videoRef.current
    const wrap = wrapRef.current
    if (!video || !wrap) return

    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.loop = true

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
    return () => io.disconnect()
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
}: FormatPickGridProps<T>) {
  const qtyMode = Boolean(onQuantitiesChange)
  const qtyMap = quantities || {}
  const durationMap = durations || {}
  const durationEnabled = Boolean(showDuration && onDurationsChange)
  const total = qtyMode ? totalQuantity(qtyMap) : selected.length
  const usingDefaults = qtyMode ? total === 0 : selected.length === 0

  function applyQuantities(nextQty: FormatQuantities) {
    onQuantitiesChange?.(nextQty)
    if (durationEnabled) {
      onDurationsChange?.(syncDurationsToQuantities(nextQty, durationMap))
    }
  }

  function toggleLegacy(id: T) {
    if (!onChange) return
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

  return (
    <div
      className={`format-pick-grid${videoAspect ? ' format-pick-grid-video format-pick-grid-fastlane' : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const count = qtyMode ? qtyMap[item.id] || 0 : selected.includes(item.id) ? 1 : 0
        const checked = count > 0
        const softDefault = usingDefaults && defaultIds.includes(item.id)
        return (
          <div
            key={item.id}
            className={`format-pick${videoAspect ? ' format-pick-fastlane' : ''}${checked ? ' is-checked' : ''}${softDefault ? ' is-default' : ''}`}
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
