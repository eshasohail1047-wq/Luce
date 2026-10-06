import { useEffect, useState } from 'react'

const STEPS = [
  {
    id: 'upload',
    label: '01 · Start',
    title: 'Open LUCE and add your product',
    detail: 'Paste a product URL or drop photos. The site reads packaging, category, and brand tone.',
    screen: {
      url: 'app.luce.ai / new',
      title: 'Create campaign',
      subtitle: 'Add your product to begin',
      fields: [
        { label: 'Product URL', value: 'brand.com/products/daily-moisturizer' },
        { label: 'Or upload', value: '3 images selected · Ready' },
      ],
      cta: 'Continue',
    },
  },
  {
    id: 'brief',
    label: '02 · Brief',
    title: 'Confirm the product brief',
    detail: 'LUCE builds name, audience, and fidelity checks so every asset stays on-brand.',
    screen: {
      url: 'app.luce.ai / brief',
      title: 'Product brief',
      subtitle: 'Daily Moisturizer',
      fields: [
        { label: 'Category', value: 'Skincare · Hydration' },
        { label: 'Fidelity', value: 'Packaging match · Ready' },
        { label: 'Audience', value: 'Clean beauty · 18–34' },
      ],
      cta: 'Generate campaign',
    },
  },
  {
    id: 'generate',
    label: '03 · Generate',
    title: 'Watch the campaign pack build',
    detail: 'The website creates studio photos, UGC clips, social posts, and ads from that one product.',
    screen: {
      url: 'app.luce.ai / generate',
      title: 'Generating assets',
      subtitle: 'Building your full pack…',
      fields: [
        { label: 'Product photos', value: 'Done' },
        { label: 'UGC videos', value: 'Done' },
        { label: 'Social + ads', value: 'In progress' },
      ],
      cta: 'Open dashboard',
    },
  },
  {
    id: 'export',
    label: '04 · Export',
    title: 'Review in the dashboard and download',
    detail: 'Pick winners, regenerate anything, then export one ZIP ready to publish.',
    screen: {
      url: 'app.luce.ai / dashboard',
      title: 'Campaign dashboard',
      subtitle: 'Moisturizer campaign · 12 assets',
      fields: [
        { label: 'Selected', value: '8 assets ready' },
        { label: 'Export', value: 'Moisturizer-Campaign.zip' },
      ],
      cta: 'Download ZIP',
    },
  },
]

const STEP_MS = 3400

export default function DemoVideoPlayer() {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [progress, setProgress] = useState(0)

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

  return (
    <div className="demo-walk">
      <div className="demo-walk-stage">
        <div className="demo-walk-chrome" aria-hidden="true">
          <span />
          <span />
          <span />
          <p>{step.screen.url}</p>
        </div>

        <div className="demo-walk-body">
          <div className="demo-walk-visual demo-walk-app">
            <div key={step.id} className="demo-app-screen">
              <div className="demo-app-top">
                <div className="demo-app-brand">
                  <strong>LUCE</strong>
                  <span>Campaign studio</span>
                </div>
                <div className="demo-app-nav" aria-hidden="true">
                  <i />
                  <i />
                  <i className="is-on" />
                </div>
              </div>

              <div className="demo-app-card">
                <p className="demo-app-eyebrow">{step.screen.title}</p>
                <h4>{step.screen.subtitle}</h4>
                <ul>
                  {step.screen.fields.map((field) => (
                    <li key={field.label}>
                      <span>{field.label}</span>
                      <strong>{field.value}</strong>
                    </li>
                  ))}
                </ul>
                <div className="demo-app-cta">{step.screen.cta}</div>
              </div>

              <div className="demo-app-side" aria-hidden="true">
                <div className="demo-app-thumb is-wide" />
                <div className="demo-app-thumb" />
                <div className="demo-app-thumb" />
              </div>
            </div>
          </div>

          <div className="demo-walk-copy">
            <p className="demo-walk-kicker">{step.label}</p>
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
            <div className="demo-walk-steps" role="tablist" aria-label="How the website works">
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
          aria-label={playing ? 'Pause walkthrough' : 'Play walkthrough'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <div className="control-track" aria-hidden="true">
          <span style={{ width: `${((index + progress) / STEPS.length) * 100}%` }} />
        </div>
        <span className="demo-walk-caption">Website walkthrough</span>
      </div>
    </div>
  )
}
