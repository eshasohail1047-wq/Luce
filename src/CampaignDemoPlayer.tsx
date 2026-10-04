import { useEffect, useRef, useState } from 'react'

export type DemoScene = {
  id: string
  title: string
  narration: string
  duration: number
  image: string
  ui: 'intro' | 'url' | 'confirm' | 'generate' | 'assets' | 'export'
}

const DEFAULT_SCENES: DemoScene[] = [
  {
    id: 'intro',
    title: 'Bring your product into the light',
    narration:
      'LUCE is your campaign studio. Start with one real product — we light the whole campaign around it.',
    duration: 5200,
    image: '/images/studio-lights.jpg',
    ui: 'intro',
  },
  {
    id: 'add',
    title: 'Step 1 — Add your product',
    narration:
      'Paste a Shopify product URL or upload product images. LUCE reads name, features, category, and visuals.',
    duration: 5600,
    image: '/images/luce-product-photo.jpg',
    ui: 'url',
  },
  {
    id: 'confirm',
    title: 'Step 2 — Confirm what LUCE understood',
    narration:
      'Review the product details before generation. Edit anything so the campaign stays faithful to the real product.',
    duration: 5600,
    image: '/images/product-studio.jpg',
    ui: 'confirm',
  },
  {
    id: 'generate',
    title: 'Step 3 — Generate the full campaign',
    narration:
      'Click Generate Full Campaign. LUCE creates product photos, UGC video, social content, and ad creatives together.',
    duration: 5800,
    image: '/images/luce-dashboard-mock.jpg',
    ui: 'generate',
  },
  {
    id: 'assets',
    title: 'Step 4 — Review every asset',
    narration:
      'Preview results by category. Regenerate any single asset without breaking campaign consistency.',
    duration: 5600,
    image: '/images/product-lifestyle.jpg',
    ui: 'assets',
  },
  {
    id: 'export',
    title: 'Step 5 — Download and publish',
    narration:
      'Export one ZIP with images, videos, and copy. Then post manually to Instagram, TikTok, or ads.',
    duration: 5600,
    image: '/images/ad-creative.jpg',
    ui: 'export',
  },
]

function SceneUI({ type }: { type: DemoScene['ui'] }) {
  if (type === 'intro') {
    return (
      <div className="scene-ui scene-intro">
        <p>Campaign studio</p>
        <h4>One product → full campaign</h4>
        <div className="scene-chips">
          <span>Photos</span>
          <span>UGC</span>
          <span>Social</span>
          <span>Ads</span>
        </div>
      </div>
    )
  }

  if (type === 'url') {
    return (
      <div className="scene-ui">
        <p className="scene-label">Create campaign</p>
        <h4>Add your product</h4>
        <div className="scene-field">brand.com/products/rose-oud</div>
        <div className="scene-or">or upload product images</div>
        <div className="scene-btn">Continue</div>
      </div>
    )
  }

  if (type === 'confirm') {
    return (
      <div className="scene-ui">
        <p className="scene-label">We found your product</p>
        <h4>Rose Oud Perfume</h4>
        <ul>
          <li>Category: Fragrance</li>
          <li>Features: Long lasting · Premium oud</li>
          <li>Fidelity check: Ready</li>
        </ul>
        <div className="scene-btn">Confirm & continue</div>
      </div>
    )
  }

  if (type === 'generate') {
    return (
      <div className="scene-ui">
        <p className="scene-label">Creating your campaign…</p>
        <ul className="scene-progress">
          <li className="done">Understanding product</li>
          <li className="done">Lighting visual concepts</li>
          <li className="active">Generating product images</li>
          <li>Creating UGC video</li>
          <li>Writing social + ads</li>
        </ul>
      </div>
    )
  }

  if (type === 'assets') {
    return (
      <div className="scene-ui">
        <p className="scene-label">Campaign results</p>
        <div className="scene-assets">
          <span>Product Photos</span>
          <span>UGC Video</span>
          <span>Social Content</span>
          <span>Ad Creatives</span>
        </div>
        <div className="scene-btn ghost">Regenerate selected</div>
      </div>
    )
  }

  return (
    <div className="scene-ui">
      <p className="scene-label">Export</p>
      <h4>Rose-Oud-Campaign.zip</h4>
      <ul>
        <li>Images / Videos / Copy</li>
        <li>Ready for manual publishing</li>
      </ul>
      <div className="scene-btn">Download campaign</div>
    </div>
  )
}

type Props = {
  scenes?: DemoScene[]
}

export default function CampaignDemoPlayer({ scenes = DEFAULT_SCENES }: Props) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const started = useRef(false)
  const scene = scenes[index]
  const total = scenes.reduce((sum, item) => sum + item.duration, 0)
  const elapsedBefore = scenes.slice(0, index).reduce((sum, item) => sum + item.duration, 0)

  useEffect(() => {
    if (!playing) return undefined

    const startedAt = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const local = now - startedAt
      const overall = elapsedBefore + local
      setProgress(Math.min(overall / total, 1))

      if (local >= scene.duration) {
        if (index < scenes.length - 1) {
          setIndex((value) => value + 1)
        } else {
          setPlaying(false)
          setProgress(1)
        }
        return
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, index, scene.duration, elapsedBefore, total, scenes.length])

  const toggle = () => {
    if (!started.current) {
      started.current = true
      setIndex(0)
      setProgress(0)
    }
    if (progress >= 1) {
      setIndex(0)
      setProgress(0)
      setPlaying(true)
      return
    }
    setPlaying((value) => !value)
  }

  const jumpTo = (next: number) => {
    started.current = true
    setIndex(next)
    setProgress(scenes.slice(0, next).reduce((sum, item) => sum + item.duration, 0) / total)
    setPlaying(true)
  }

  return (
    <div className="campaign-player">
      <div className="campaign-stage">
        <img key={scene.id} className="campaign-bg" src={scene.image} alt="" />
        <div className="campaign-veil" />
        <div className="campaign-frame">
          <SceneUI type={scene.ui} />
        </div>
        <div className="campaign-caption">
          <p className="campaign-step">{scene.title}</p>
          <p>{scene.narration}</p>
        </div>
        {!playing && progress === 0 && (
          <button className="video-play" onClick={toggle} aria-label="Play campaign demo">
            <span>▶</span>
            Watch how to create a campaign
          </button>
        )}
      </div>

      <div className="campaign-controls">
        <button className="control-play" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="control-track" aria-hidden="true">
          <span style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="control-scenes">
          {scenes.map((item, sceneIndex) => (
            <button
              key={item.id}
              className={sceneIndex === index ? 'active' : ''}
              onClick={() => jumpTo(sceneIndex)}
              title={item.title}
            >
              {sceneIndex + 1}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
