import { useEffect, useRef, useState } from 'react'

const STEPS = [
  {
    id: 'upload',
    label: '01 · Add product',
    title: 'Paste a product URL or upload photos',
    detail: 'LUCE reads packaging, category, and brand tone in seconds.',
    image: '/images/luce-product-photo.jpg',
    panel: {
      eyebrow: 'Create campaign',
      heading: 'Add your product',
      rows: ['brand.com/products/daily-moisturizer', 'Upload images · or paste URL'],
    },
  },
  {
    id: 'brief',
    label: '02 · Confirm brief',
    title: 'Review the product brief',
    detail: 'Name, audience, and fidelity check — one source of truth.',
    image: '/images/campaign-perfume-studio.jpg',
    panel: {
      eyebrow: 'Product brief',
      heading: 'Daily Moisturizer',
      rows: ['Skincare · Hydration', 'Fidelity check · Ready'],
    },
  },
  {
    id: 'generate',
    label: '03 · Generate',
    title: 'Build the full campaign pack',
    detail: 'Studio photos, UGC, social posts, and ads from that one product.',
    image: '/images/campaign-ugc-serum.jpg',
    panel: {
      eyebrow: 'Generating',
      heading: 'Campaign assets',
      rows: ['Product photos ✓', 'UGC · Social · Ads ✓'],
    },
  },
  {
    id: 'export',
    label: '04 · Export',
    title: 'Review in the dashboard and export',
    detail: 'Pick winners, regenerate anything, download one ZIP.',
    image: '/images/luce-dashboard-mock.jpg',
    panel: {
      eyebrow: 'Workspace',
      heading: 'Campaign dashboard',
      rows: ['Moisturizer-Campaign.zip', 'Ready to publish'],
    },
  },
]

const STEP_MS = 3200

export default function DemoVideoPlayer() {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const started = useRef(false)

  const step = STEPS[index]

  useEffect(() => {
    if (!playing) return
    setProgress(0)
    const startedAt = performance.now()
    let frame = 0

    const tick = (now: number) => {
      const t = (now - startedAt) / STEP_MS
      setProgress(Math.min(1, t))
      if (t >= 1) {
        setIndex((i) => (i + 1) % STEPS.length)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, index])

  useEffect(() => {
    started.current = true
  }, [])

  return (
    <div className="demo-walk">
      <div className="demo-walk-stage">
        <div className="demo-walk-chrome" aria-hidden="true">
          <span />
          <span />
          <span />
          <p>app.luce.ai / campaign</p>
        </div>

        <div className="demo-walk-body">
          <div className="demo-walk-visual">
            {STEPS.map((s, i) => (
              <img
                key={s.id}
                className={i === index ? 'is-active' : ''}
                src={s.image}
                alt=""
              />
            ))}
            <div className="demo-walk-panel">
              <p>{step.panel.eyebrow}</p>
              <strong>{step.panel.heading}</strong>
              {step.panel.rows.map((row) => (
                <span key={row}>{row}</span>
              ))}
            </div>
          </div>

          <div className="demo-walk-copy">
            <p className="demo-walk-kicker">{step.label}</p>
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
            <div className="demo-walk-steps" role="tablist" aria-label="Demo steps">
              {STEPS.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  className={i === index ? 'active' : ''}
                  onClick={() => {
                    setIndex(i)
                    setPlaying(true)
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="demo-walk-controls">
        <button
          type="button"
          className="control-play"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause demo' : 'Play demo'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="control-track" aria-hidden="true">
          <span style={{ width: `${((index + progress) / STEPS.length) * 100}%` }} />
        </div>
        <span className="demo-walk-caption">How LUCE works</span>
      </div>
    </div>
  )
}
