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
  /** Prefer taller cards for video formats */
  videoAspect?: boolean
  onLimitHit?: () => void
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
      className={`format-pick-grid${videoAspect ? ' format-pick-grid-video' : ''}`}
      role="group"
      aria-label={ariaLabel}
    >
      {items.map((item) => {
        const checked = selected.includes(item.id)
        const softDefault = usingDefaults && defaultIds.includes(item.id)
        return (
          <label
            key={item.id}
            className={`format-pick${checked ? ' is-checked' : ''}${softDefault ? ' is-default' : ''}`}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(item.id)}
              disabled={disabled}
            />
            <span
              className={`format-pick-media${videoAspect ? ' format-pick-media-video' : ''}`}
            >
              {videoAspect && item.videoUrl ? (
                <video
                  src={item.videoUrl}
                  poster={item.thumb}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                  onMouseEnter={(e) => {
                    void e.currentTarget.play().catch(() => {})
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause()
                    e.currentTarget.currentTime = 0
                  }}
                />
              ) : (
                <img src={item.thumb} alt="" />
              )}
              {item.tag ? <span className="format-pick-tag">{item.tag}</span> : null}
              {videoAspect ? (
                <span className="format-pick-play" aria-hidden="true">
                  ▶
                </span>
              ) : null}
              <span className="format-pick-check" aria-hidden="true">
                ✓
              </span>
            </span>
            <span className="format-pick-body">
              <strong>{item.label}</strong>
              <span>{item.description}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}
