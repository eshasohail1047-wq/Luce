import { Link } from 'react-router-dom'
import type { MockOutput } from '../lib/mockCampaign'

export type StudioStagePhase =
  | 'idle'
  | 'preparing'
  | 'analyzing'
  | 'generating'
  | 'checking'
  | 'ready'
  | 'error'

const STEPS: { id: StudioStagePhase; label: string; hint: string }[] = [
  { id: 'preparing', label: 'Prepare', hint: 'Locking product & uploads' },
  { id: 'analyzing', label: 'Analyze', hint: 'Reading packaging & reference' },
  { id: 'generating', label: 'Generate', hint: 'Building your creatives' },
  { id: 'checking', label: 'Review', hint: 'Checking fidelity' },
]

type StudioStagePanelProps = {
  kind: 'photos' | 'videos'
  phase: StudioStagePhase
  progress: number
  message: string | null
  previewUrl?: string | null
  outputs: MockOutput[]
  campaignId?: string | null
  activeOutputId?: string | null
  onSelectOutput?: (id: string) => void
  onDismiss?: () => void
}

function stepIndex(phase: StudioStagePhase): number {
  if (phase === 'ready') return STEPS.length
  if (phase === 'error' || phase === 'idle') return -1
  const i = STEPS.findIndex((s) => s.id === phase)
  return i >= 0 ? i : 0
}

export default function StudioStagePanel({
  kind,
  phase,
  progress,
  message,
  previewUrl,
  outputs,
  campaignId,
  activeOutputId,
  onSelectOutput,
  onDismiss,
}: StudioStagePanelProps) {
  const working = phase !== 'idle' && phase !== 'ready' && phase !== 'error'
  const active =
    outputs.find((o) => o.id === activeOutputId) || outputs[0] || null
  const activeVideo = active?.kind === 'video' ? active.videoUrl || null : null
  const failed =
    Boolean(active?.note?.toLowerCase().includes('failed')) ||
    Boolean(active?.note?.toLowerCase().includes('upgrade'))
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
  const currentStep = stepIndex(phase)
  const headline =
    phase === 'ready'
      ? failed
        ? 'Generation didn’t finish'
        : 'Your creatives are ready'
      : phase === 'error'
        ? 'Something went wrong'
        : kind === 'videos'
          ? 'Creating your clips'
          : 'Creating your shots'

  return (
    <aside
      className={`studio-create-screen${working ? ' is-working' : ''}${phase === 'ready' ? ' is-ready' : ''}${phase === 'error' ? ' is-error' : ''}`}
      aria-live="polite"
    >
      <div className="studio-create-glow" aria-hidden="true" />

      <header className="studio-create-head">
        <p className="studio-create-kicker">
          {kind === 'videos' ? 'Video Studio' : 'Image Studio'}
        </p>
        <h2>{headline}</h2>
        <p className="studio-create-sub">
          {working
            ? message || 'Stay on this page — we’re building each frame.'
            : phase === 'ready'
              ? failed
                ? message ||
                  active?.note ||
                  'Upgrade or retry — we didn’t replace your upload with AI.'
                : message || 'Review, export, or recreate any format.'
              : message || 'Generation stopped.'}
        </p>
      </header>

      {working ? (
        <div className="studio-create-progress" aria-label={`${pct} percent`}>
          <div className="studio-create-ring" style={{ ['--pct' as string]: pct }}>
            <strong>{pct}</strong>
            <span>%</span>
          </div>
          <ol className="studio-create-steps">
            {STEPS.map((step, i) => {
              const state =
                i < currentStep ? 'is-done' : i === currentStep ? 'is-active' : ''
              return (
                <li key={step.id} className={state}>
                  <span className="studio-create-step-index">
                    {i < currentStep ? '✓' : String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="studio-create-step-copy">
                    <strong>{step.label}</strong>
                    <em>
                      {i === currentStep && message ? message : step.hint}
                    </em>
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      ) : null}

      <div className="studio-create-stage">
        {active && phase === 'ready' && !failed && (activeVideo || active.imageUrl) ? (
          activeVideo ? (
            <video
              src={activeVideo}
              controls
              playsInline
              poster={active.imageUrl}
            />
          ) : (
            <img src={active.imageUrl} alt={active.label} />
          )
        ) : working && previewUrl ? (
          <div className="studio-create-preview">
            <img src={previewUrl} alt="" referrerPolicy="no-referrer" />
            <div className="studio-create-veil">
              <span className="studio-create-pulse" aria-hidden="true" />
              <p>{message || 'Generating…'}</p>
            </div>
          </div>
        ) : phase === 'ready' && failed ? (
          <div className="studio-create-fail">
            <strong>{active?.label || 'Creative'}</strong>
            <p>{active?.note || 'AI did not return a new image.'}</p>
          </div>
        ) : phase === 'error' ? (
          <div className="studio-create-fail">
            <strong>Error</strong>
            <p>{message || 'Try again in a moment.'}</p>
          </div>
        ) : (
          <div className="studio-create-empty">
            <strong>Live stage</strong>
            <p>
              {kind === 'videos'
                ? 'Clips appear here as each format finishes.'
                : 'Shots appear here as each format finishes.'}
            </p>
          </div>
        )}
      </div>

      {phase === 'ready' && outputs.length > 0 ? (
        <ul className="studio-create-thumbs" aria-label="Generated outputs">
          {outputs.map((o) => {
            const vid = o.kind === 'video' ? o.videoUrl : null
            const bad =
              Boolean(o.note?.toLowerCase().includes('failed')) ||
              Boolean(o.note?.toLowerCase().includes('upgrade'))
            return (
              <li key={o.id}>
                <button
                  type="button"
                  className={`${o.id === active?.id ? 'is-active' : ''}${bad ? ' is-failed' : ''}`}
                  onClick={() => onSelectOutput?.(o.id)}
                >
                  {vid && !bad ? (
                    <video src={vid} muted playsInline preload="metadata" />
                  ) : o.imageUrl && !bad ? (
                    <img src={o.imageUrl} alt="" />
                  ) : (
                    <span>{o.label}</span>
                  )}
                  <em>{o.label}</em>
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {phase === 'ready' || phase === 'error' ? (
        <div className="studio-create-actions">
          {phase === 'ready' && active && !failed && (active.imageUrl || activeVideo) ? (
            <a
              className="btn btn-grad"
              href={activeVideo || active.imageUrl}
              download={`luce-${active.assetType}`}
              target="_blank"
              rel="noreferrer"
            >
              Download
            </a>
          ) : null}
          {campaignId ? (
            <Link className="btn btn-ghost" to={`/app/campaigns/${campaignId}`}>
              Open project
            </Link>
          ) : null}
          {onDismiss ? (
            <button type="button" className="btn btn-ghost" onClick={onDismiss}>
              Back to studio
            </button>
          ) : null}
        </div>
      ) : null}
    </aside>
  )
}
