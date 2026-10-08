import { useEffect, useRef } from 'react'

type Clip = {
  id: string
  format: string
  creator: string
  product: string
  src: string
  poster: string
}

/** Unique creators — real motion clips only (no Ken Burns stills) */
const CLIPS: Clip[] = [
  {
    id: 'lipstick',
    format: 'Makeup',
    creator: '@luxe.lips',
    product: 'Lip color apply',
    src: '/videos/ugc-makeup-lipstick.mp4',
    poster: '/images/ugc-makeup-lipstick.jpg',
  },
  {
    id: 'ring',
    format: 'UGC',
    creator: '@glow.studio',
    product: 'Skincare ritual',
    src: '/videos/ugc-skincare-ringlight.mp4',
    poster: '/images/moisturizer-ugc-poster.jpg',
  },
  {
    id: 'man-skin',
    format: 'Reel',
    creator: '@marcus.skin',
    product: 'Men’s grooming',
    src: '/videos/ugc-man-skincare.mp4',
    poster: '/images/ugc-man-skincare.jpg',
  },
  {
    id: 'p1',
    format: 'Story',
    creator: '@luna.scent',
    product: 'Rose Oud Perfume',
    src: '/videos/perfume-1.mp4',
    poster: '/images/campaign-perfume-studio.jpg',
  },
  {
    id: 'blush',
    format: 'Makeup',
    creator: '@soft.flush',
    product: 'Blush apply',
    src: '/videos/ugc-makeup-blush.mp4',
    poster: '/images/ugc-makeup-blush.jpg',
  },
  {
    id: 'c2',
    format: 'Reel',
    creator: '@mila.glow',
    product: 'Face Cream',
    src: '/videos/creator-2.mp4',
    poster: '/images/campaign-beauty-flatlay.jpg',
  },
  {
    id: 'man-frag',
    format: 'UGC',
    creator: '@alex.notes',
    product: 'Fragrance spray',
    src: '/videos/ugc-man-fragrance.mp4',
    poster: '/images/ugc-man-fragrance.jpg',
  },
  {
    id: 'moist',
    format: 'UGC',
    creator: '@dew.routine',
    product: 'Moisturizer demo',
    src: '/videos/ugc-moisturizer-demo.mp4',
    poster: '/images/moisturizer-ad-apply.jpg',
  },
  {
    id: 'c3',
    format: 'UGC',
    creator: '@noah.beauty',
    product: 'Serum moment',
    src: '/videos/creator-3.mp4',
    poster: '/images/campaign-ugc-serum.jpg',
  },
  {
    id: 'c4',
    format: 'Story',
    creator: '@jade.glow',
    product: 'Morning routine',
    src: '/videos/creator-4.mp4',
    poster: '/images/campaign-beauty-flatlay.jpg',
  },
  {
    id: 'p2',
    format: 'Reel',
    creator: '@ria.reviews',
    product: 'Soft Perfume',
    src: '/videos/perfume-2.mp4',
    poster: '/images/campaign-perfume-studio.jpg',
  },
]

function MarqueeCard({ clip }: { clip: Clip }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const cardRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const video = videoRef.current
    const card = cardRef.current
    if (!video || !card) return
    video.muted = true

    const play = () => {
      void video.play().catch(() => {})
    }

    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play()
        else video.pause()
      },
      { threshold: 0.35 },
    )
    obs.observe(card)
    video.addEventListener('loadeddata', play)
    return () => {
      obs.disconnect()
      video.removeEventListener('loadeddata', play)
    }
  }, [clip.src])

  return (
    <article ref={cardRef} className="ugc-marquee-card">
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
        <div className="ugc-marquee-veil" aria-hidden="true" />
        <span className="ugc-marquee-format">{clip.format}</span>
        <div className="ugc-marquee-caption">
          <span className="ugc-marquee-creator">{clip.creator}</span>
          <span className="ugc-marquee-product">{clip.product}</span>
        </div>
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
