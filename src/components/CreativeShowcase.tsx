import { useCallback, useEffect, useRef, useState } from 'react'

export type ShowcaseItem = {
  id: string
  label: string
  kind: 'image' | 'video'
  src: string
  poster?: string
}

/** Five HeyGen clips with format-relative tags */
const DEFAULT_ITEMS: ShowcaseItem[] = [
  {
    id: 'heygen-1',
    label: 'UGC',
    kind: 'video',
    src: '/videos/creator/heygen-ugc-1.mp4',
    poster: '/images/video-poster-ugc.jpg',
  },
  {
    id: 'miss-rose-ugc',
    label: 'UGC',
    kind: 'video',
    src: '/videos/creator/miss-rose-ugc.mp4',
    poster: '/images/ugc-makeup-blush.jpg',
  },
  {
    id: 'image1-ugc',
    label: 'Table Talk',
    kind: 'video',
    src: '/videos/creator/image1-ugc.mp4',
    poster: '/images/ugc-makeup-lipstick.jpg',
  },
  {
    id: 'heygen-2',
    label: 'Ad Creative',
    kind: 'video',
    src: '/videos/creator/heygen-ugc-2.mp4',
    poster: '/images/moisturizer-ugc-poster.jpg',
  },
  {
    id: 'cinematic-heygen',
    label: 'Cinematic Shot',
    kind: 'video',
    src: '/videos/showcase/cinematic-heygen.mp4',
    poster: '/images/video-poster-cinematic.jpg',
  },
]

type CreativeShowcaseProps = {
  items?: ShowcaseItem[]
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => setReduced(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return reduced
}

function wrapIndex(index: number, length: number) {
  return ((index % length) + length) % length
}

function relativeOffset(index: number, active: number, length: number) {
  let offset = index - active
  if (offset > length / 2) offset -= length
  if (offset < -length / 2) offset += length
  return offset
}

function slotClassForOffset(offset: number) {
  if (offset === 0) return 'is-center'
  if (offset === -1) return 'is-left'
  if (offset === 1) return 'is-right'
  if (offset === -2) return 'is-far-left'
  if (offset === 2) return 'is-far-right'
  return 'is-hidden'
}

export default function CreativeShowcase({ items = DEFAULT_ITEMS }: CreativeShowcaseProps) {
  const [active, setActive] = useState(0)
  const reducedMotion = usePrefersReducedMotion()
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const length = items.length

  const goTo = useCallback(
    (index: number) => {
      setActive(wrapIndex(index, length))
    },
    [length],
  )

  const goNext = useCallback(() => {
    setActive((current) => wrapIndex(current + 1, length))
  }, [length])

  useEffect(() => {
    const current = items[active]
    if (!current || reducedMotion || current.kind !== 'video') return

    const video = videoRef.current
    if (!video) return

    const onEnded = () => goNext()
    try {
      video.currentTime = 0
    } catch {
      /* ignore */
    }
    void video.play().catch(() => {
      /* autoplay blocked */
    })
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('ended', onEnded)
    }
  }, [active, goNext, items, reducedMotion])

  if (!length) return null

  return (
    <section className="creative-showcase" aria-label="Creative showcase">
      <div className="creative-showcase-stage">
        {items.map((item, index) => {
          const offset = relativeOffset(index, active, length)
          if (Math.abs(offset) > 2) return null

          const isCenter = offset === 0
          const slotClass = slotClassForOffset(offset)

          return (
            <article
              key={item.id}
              className={`creative-showcase-window ${slotClass}`}
              aria-hidden={!isCenter}
            >
              {/* Tag sits on the top edge of the card — always inside the visible frame */}
              <div className="creative-showcase-tag" aria-hidden={!isCenter}>
                {item.label}
              </div>
              <button
                type="button"
                className="creative-showcase-hit"
                onClick={() => {
                  if (isCenter) goNext()
                  else goTo(index)
                }}
                aria-label={
                  isCenter
                    ? `Playing ${item.label}. Show next creative`
                    : `Show ${item.label}`
                }
              />
              <video
                ref={isCenter ? videoRef : undefined}
                src={item.src}
                poster={item.poster}
                muted
                playsInline
                autoPlay={isCenter && !reducedMotion}
                loop={reducedMotion && isCenter}
                preload={Math.abs(offset) <= 1 ? 'metadata' : 'none'}
              />
            </article>
          )
        })}
      </div>

      <p className="creative-showcase-sr" aria-live="polite">
        Showing {items[active]?.label}
      </p>
    </section>
  )
}
