import { useEffect, useState } from 'react'

const STEPS = [
  {
    id: 'upload',
    num: '01',
    label: 'Add product',
    title: 'Start with one product',
    detail: 'Paste a URL or upload photos. LUCE learns packaging, features, and brand context.',
    url: 'app.luce.ai/campaigns/new',
  },
  {
    id: 'brief',
    num: '02',
    label: 'Confirm',
    title: 'Confirm what LUCE understood',
    detail: 'Review name, features, and category so every asset starts from one source of truth.',
    url: 'app.luce.ai/campaigns/brief',
  },
  {
    id: 'research',
    num: '03',
    label: 'Research',
    title: 'Research & strategy',
    detail: 'Market context informs audience, positioning, angle, message, and creative direction.',
    url: 'app.luce.ai/campaigns/strategy',
  },
  {
    id: 'export',
    num: '04',
    label: 'Generate',
    title: 'Generate the full campaign',
    detail: 'Visuals, UGC, social, ads, and strategy in one pack — download a ZIP to publish.',
    url: 'app.luce.ai/campaigns/dashboard',
  },
]

const STEP_MS = 4200

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
    <div className="site-demo">
      <div className="site-demo-frame">
        <div className="site-demo-chrome" aria-hidden="true">
          <div className="site-demo-dots">
            <span />
            <span />
            <span />
          </div>
          <div className="site-demo-url">
            <em />
            <p>{step.url}</p>
          </div>
        </div>

        <div className="site-demo-workspace" data-step={step.id}>
          <aside className="site-demo-rail" aria-hidden="true">
            <strong>LUCE</strong>
            <nav>
              <span className={index === 0 ? 'on' : ''}>New</span>
              <span className={index === 1 ? 'on' : ''}>Brief</span>
              <span className={index === 2 ? 'on' : ''}>Strategy</span>
              <span className={index === 3 ? 'on' : ''}>Assets</span>
            </nav>
          </aside>

          <div key={step.id} className="site-demo-main">
            {step.id === 'upload' && (
              <>
                <header className="site-demo-header">
                  <div>
                    <p>Create campaign</p>
                    <h3>Add your product</h3>
                  </div>
                  <button type="button" tabIndex={-1}>
                    Continue
                  </button>
                </header>
                <div className="site-demo-upload">
                  <div className="site-demo-drop">
                    <img src="/images/moisturizer-studio.jpg" alt="" />
                    <div>
                      <strong>Daily Moisturizer</strong>
                      <span>brand.com/products/daily-moisturizer</span>
                    </div>
                  </div>
                  <div className="site-demo-files">
                    <figure>
                      <img src="/images/moisturizer-studio.jpg" alt="" />
                      <figcaption>Front</figcaption>
                    </figure>
                    <figure>
                      <img src="/images/campaign-beauty-flatlay.jpg" alt="" />
                      <figcaption>Angle</figcaption>
                    </figure>
                    <figure>
                      <img src="/images/moisturizer-ugc-poster.jpg" alt="" />
                      <figcaption>Label</figcaption>
                    </figure>
                  </div>
                </div>
              </>
            )}

            {step.id === 'brief' && (
              <>
                <header className="site-demo-header">
                  <div>
                    <p>Product brief</p>
                    <h3>Daily Moisturizer</h3>
                  </div>
                  <button type="button" tabIndex={-1}>
                    Confirm
                  </button>
                </header>
                <div className="site-demo-brief">
                  <div className="site-demo-brief-hero">
                    <img src="/images/moisturizer-studio.jpg" alt="" />
                  </div>
                  <div className="site-demo-brief-meta">
                    <div>
                      <span>Category</span>
                      <strong>Skincare · Hydration</strong>
                    </div>
                    <div>
                      <span>Audience</span>
                      <strong>Clean beauty · 18–34</strong>
                    </div>
                    <div>
                      <span>Fidelity</span>
                      <strong className="ok">Packaging match ready</strong>
                    </div>
                    <div>
                      <span>Tone</span>
                      <strong>Soft · Premium · Clear</strong>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step.id === 'research' && (
              <>
                <header className="site-demo-header">
                  <div>
                    <p>Campaign strategy</p>
                    <h3>Research-backed brief</h3>
                  </div>
                  <button type="button" tabIndex={-1}>
                    Generate
                  </button>
                </header>
                <div className="site-demo-generate">
                  <ul>
                    <li className="done">
                      <strong>Market research</strong>
                      <span>Ready</span>
                    </li>
                    <li className="done">
                      <strong>Audience · Positioning</strong>
                      <span>Locked</span>
                    </li>
                    <li className="active">
                      <strong>Creative direction</strong>
                      <span>Premium · Clear CTA</span>
                    </li>
                  </ul>
                  <div className="site-demo-brief-meta">
                    <div>
                      <span>Angle</span>
                      <strong>Daily ritual, visible glow</strong>
                    </div>
                    <div>
                      <span>Message</span>
                      <strong>One pump. All-day soft skin.</strong>
                    </div>
                  </div>
                </div>
              </>
            )}

            {step.id === 'export' && (
              <>
                <header className="site-demo-header">
                  <div>
                    <p>Dashboard</p>
                    <h3>Moisturizer campaign</h3>
                  </div>
                  <button type="button" tabIndex={-1}>
                    Download ZIP
                  </button>
                </header>
                <div className="site-demo-dashboard">
                  <article>
                    <img src="/images/moisturizer-studio.jpg" alt="" />
                    <p>Studio still</p>
                  </article>
                  <article>
                    <img src="/images/moisturizer-ugc-poster.jpg" alt="" />
                    <p>UGC clip</p>
                  </article>
                  <article>
                    <img src="/images/campaign-ugc-serum.jpg" alt="" />
                    <p>Social frame</p>
                  </article>
                  <article>
                    <img src="/images/luce-dashboard-mock.jpg" alt="" />
                    <p>Ad creative</p>
                  </article>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="site-demo-footer">
        <div className="site-demo-copy">
          <p className="site-demo-kicker">
            Step {step.num}
            <span aria-hidden="true"> / 04</span>
          </p>
          <h3>{step.title}</h3>
          <p>{step.detail}</p>
        </div>

        <div className="site-demo-steps" role="tablist" aria-label="How LUCE works">
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
              <span className="site-demo-step-num">{s.num}</span>
              <span className="site-demo-step-label">{s.label}</span>
              {i === index && (
                <i className="site-demo-step-bar" style={{ transform: `scaleX(${progress})` }} />
              )}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="site-demo-toggle"
          onClick={() => setPlaying((p) => !p)}
          aria-label={playing ? 'Pause walkthrough' : 'Play walkthrough'}
        >
          {playing ? 'Pause' : 'Play'}
        </button>
      </div>
    </div>
  )
}
