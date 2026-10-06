import { useEffect, useRef } from 'react'

type Clip = {
  id: string
  creator: string
  product: string
  src: string
  poster: string
}

/** Five creators — mix of moisturizer + perfume UGC */
const CLIPS: Clip[] = [
  {
    id: 'ava',
    creator: '@ava.skin',
    product: 'Daily Moisturizer',
    src: '/videos/creator-1.mp4',
    poster: '/images/moisturizer-studio.jpg',
  },
  {
    id: 'luna',
    creator: '@luna.scent',
    product: 'Rose Oud Perfume',
    src: '/videos/perfume-1.mp4',
    poster: '/images/luce-product-photo.jpg',
  },
  {
    id: 'mila',
    creator: '@mila.glow',
    product: 'Face Cream',
    src: '/videos/creator-2.mp4',
    poster: '/images/campaign-beauty-flatlay.jpg',
  },
  {
    id: 'isla',
    creator: '@isla.fragrance',
    product: 'Amber Perfume',
    src: '/videos/perfume-5.mp4',
    poster: '/images/campaign-perfume-studio.jpg',
  },
  {
    id: 'ria',
    creator: '@ria.reviews',
    product: 'Soft Perfume',
    src: '/videos/perfume-2.mp4',
    poster: '/images/luce-product-photo.jpg',
  },
]

function MarqueeCard({ clip }: { clip: Clip }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = true
    const tryPlay = () => {
      void video.play().catch(() => {})
    }
    tryPlay()
    video.addEventListener('loadeddata', tryPlay)
    return () => video.removeEventListener('loadeddata', tryPlay)
  }, [clip.src])

  return (
    <article className="ugc-marquee-card">
      <div className="ugc-marquee-phone">
        <video
          ref={videoRef}
          src={clip.src}
          poster={clip.poster}
          muted
          playsInline
          loop
          autoPlay
          preload="auto"
        />
        <span className="ugc-marquee-creator">{clip.creator}</span>
        <span className="ugc-marquee-product">{clip.product}</span>
      </div>
    </article>
  )
}

export default function UgcReel() {
  const loop = [...CLIPS, ...CLIPS]

  return (
    <div className="ugc-marquee" aria-label="Creator UGC videos">
      <div className="ugc-marquee-track">
        {loop.map((clip, i) => (
          <MarqueeCard key={`${clip.id}-${i}`} clip={clip} />
        ))}
      </div>
    </div>
  )
}
