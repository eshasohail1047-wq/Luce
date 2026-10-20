import { useEffect, useRef } from 'react'
import type { FormatOption } from '../lib/deliverables'

type FormatPickGridProps<T extends string> = {
  items: FormatOption<T>[]
  selected: T[]
  onChange: (next: T[]) => void
  disabled?: boolean
  /** Soft-highlight these when nothing is selected */
  defaultIds?: T[]
  max?: number
  ariaLabel: string
  /** Prefer taller cards for video formats (Fastlane-style gallery) */
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
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        autoPlay
        preload="auto"
        title="Autoplaying · click for sound"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const v = e.currentTarget
          v.muted = !v.muted
          void v.play().catch(() => {})
        }}
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
  selected,
  onChange,
  disabled,
  defaultIds = [],
  max,
  ariaLabel,
  videoAspect,
  onLimitHit,
}: FormatPickGridProps<T>) {
  const usingDefaults = selected.length === 0

  function toggle(id: T) {
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

  return (
    <div
      className={`format-pick-grid${videoAspect ? ' format-pick-grid-video format-pick-grid-fastlane' : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const checked = selected.includes(item.id)
        const softDefault = usingDefaults && defaultIds.includes(item.id)
        return (
          <label
            key={item.id}
            className={`format-pick${videoAspect ? ' format-pick-fastlane' : ''}${checked ? ' is-checked' : ''}${softDefault ? ' is-default' : ''}`}
            title={item.description}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(item.id)}
              disabled={disabled}
            />
            {videoAspect && item.videoUrl ? (
              <FormatVideoCard src={item.videoUrl} poster={item.thumb} label={item.label} />
            ) : (
              <>
                <span className="format-pick-media">
                  <img src={item.thumb} alt="" />
                  {item.tag ? <span className="format-pick-tag">{item.tag}</span> : null}
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
          </label>
        )
      })}
    </div>
  )
}
