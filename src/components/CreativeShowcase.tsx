import { useMemo } from 'react'

export type ShowcaseItem = {
  id: string
  label: string
  kind: 'image' | 'video'
  src: string
  poster?: string
  size?: 'hero' | 'md' | 'sm'
}

const DEFAULT_ITEMS: ShowcaseItem[] = [
  {
    id: 'product-studio',
    label: 'Product Images',
    kind: 'image',
    src: '/images/fidelity-studio.jpg',
    size: 'sm',
  },
  {
    id: 'heygen-1',
    label: 'UGC Video',
    kind: 'video',
    src: '/videos/creator/heygen-ugc-1.mp4',
    poster: '/images/video-poster-ugc.jpg',
    size: 'md',
  },
  {
    id: 'miss-rose-ads',
    label: 'Ad Creative',
    kind: 'image',
    src: '/images/outputs/miss-rose-ads.jpg',
    size: 'sm',
  },
  {
    id: 'cinematic-heygen',
    label: 'UGC Video',
    kind: 'video',
    src: '/videos/showcase/cinematic-heygen.mp4',
    poster: '/images/video-poster-cinematic.jpg',
    size: 'hero',
  },
  {
    id: 'social',
    label: 'Social Content',
    kind: 'image',
    src: '/images/outputs/miss-rose-social.jpg',
    size: 'md',
  },
  {
    id: 'heygen-2',
    label: 'Full Campaign',
    kind: 'video',
    src: '/videos/creator/heygen-ugc-2.mp4',
    size: 'md',
  },
  {
    id: 'daylight',
    label: 'Product Images',
    kind: 'image',
    src: '/images/fidelity-daylight.jpg',
    size: 'sm',
  },
  {
    id: 'miss-rose-ugc',
    label: 'UGC Video',
    kind: 'video',
    src: '/videos/creator/miss-rose-ugc.mp4',
    size: 'md',
  },
  {
    id: 'editorial',
    label: 'Ad Creative',
    kind: 'image',
    src: '/images/outputs/miss-rose-editorial.jpg',
    size: 'sm',
  },
  {
    id: 'unbox',
    label: 'Social Content',
    kind: 'video',
    src: '/videos/formats/unboxing.mp4',
    poster: '/images/video-poster-unbox.jpg',
    size: 'md',
  },
  {
    id: 'packshot',
    label: 'Product Images',
    kind: 'image',
    src: '/images/outputs/miss-rose-packshot.jpg',
    size: 'sm',
  },
  {
    id: 'howto',
    label: 'Full Campaign',
    kind: 'video',
    src: '/videos/formats/howto.mp4',
    poster: '/images/video-poster-howto.jpg',
    size: 'md',
  },
]

type CreativeShowcaseProps = {
  items?: ShowcaseItem[]
  heading?: string
  supporting?: string
}

function ShowcaseCard({ item, index }: { item: ShowcaseItem; index: number }) {
  const size = item.size || 'md'
  const tilt = index % 7
  return (
    <article
      className={`creative-showcase-card creative-showcase-card-${size} creative-showcase-tilt-${tilt}`}
      aria-label={item.label}
    >
      <header className="creative-showcase-chrome">
        <span className="creative-showcase-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="creative-showcase-label">{item.label}</span>
      </header>
      <div className="creative-showcase-media">
        {item.kind === 'video' ? (
          <video
            src={item.src}
            poster={item.poster}
            muted
            loop
            playsInline
            autoPlay
            preload="metadata"
          />
        ) : (
          <img src={item.src} alt="" loading="lazy" decoding="async" />
        )}
      </div>
    </article>
  )
}

export default function CreativeShowcase({
  items = DEFAULT_ITEMS,
  heading = 'One product. Endless possibilities.',
  supporting = 'From product photography to scroll-stopping ads, turn one product into creative assets ready for your next campaign.',
}: CreativeShowcaseProps) {
  // Duplicate once for a seamless CSS marquee loop.
  const track = useMemo(() => [...items, ...items], [items])

  return (
    <section className="creative-showcase" aria-labelledby="creative-showcase-heading">
      <div className="creative-showcase-copy">
        <h2 id="creative-showcase-heading">{heading}</h2>
        <p>{supporting}</p>
      </div>

      <div className="creative-showcase-viewport">
        <div className="creative-showcase-track" aria-hidden="true">
          {track.map((item, index) => (
            <ShowcaseCard key={`${item.id}-${index}`} item={item} index={index} />
          ))}
        </div>
        <ul className="creative-showcase-sr">
          {items.map((item) => (
            <li key={item.id}>
              {item.label}: {item.kind}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
