import { useEffect, useState } from 'react'

const FRAMES = [
  {
    title: 'Studio product photo',
    caption: 'True-to-packaging lighting',
    image: '/images/campaign-perfume-studio.jpg',
  },
  {
    title: 'Lifestyle campaign still',
    caption: 'Scene changes, product stays true',
    image: '/images/campaign-beauty-flatlay.jpg',
  },
  {
    title: 'UGC-ready moment',
    caption: 'Creator-style short-form',
    image: '/images/campaign-ugc-serum.jpg',
    video: '/videos/creator-1.mp4',
  },
  {
    title: 'Social + ad creative',
    caption: 'Hooks, captions, and ad frames',
    image: '/images/campaign-ad-handbag.jpg',
  },
]

export default function CampaignShowcase() {
  const [index, setIndex] = useState(0)
  const frame = FRAMES[index]

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % FRAMES.length)
    }, 4200)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="campaign-showcase">
      <div className="campaign-showcase-stage">
        {FRAMES.map((item, i) => (
          <div key={item.title} className={`showcase-slide ${i === index ? 'is-active' : ''}`}>
            {item.video ? (
              <video src={item.video} poster={item.image} muted loop playsInline autoPlay preload="metadata" />
            ) : (
              <img src={item.image} alt={item.title} />
            )}
          </div>
        ))}
        <div className="showcase-overlay">
          <p className="showcase-kicker">Campaign output</p>
          <h3>{frame.title}</h3>
          <p>{frame.caption}</p>
        </div>
      </div>
      <div className="showcase-dots" role="tablist" aria-label="Campaign frames">
        {FRAMES.map((item, i) => (
          <button
            key={item.title}
            type="button"
            role="tab"
            aria-selected={i === index}
            className={i === index ? 'active' : ''}
            onClick={() => setIndex(i)}
          >
            {item.title}
          </button>
        ))}
      </div>
    </div>
  )
}
