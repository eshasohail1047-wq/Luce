import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { MockOutput } from '../lib/mockCampaign'
import SafeVideo from './SafeVideo'

export type StudioStagePhase =
  | 'idle'
  | 'preparing'
  | 'analyzing'
  | 'generating'
  | 'checking'
  | 'ready'
  | 'error'

const STEPS: { id: StudioStagePhase; label: string }[] = [
  { id: 'preparing', label: 'Prepare' },
  { id: 'analyzing', label: 'Analyze' },
  { id: 'generating', label: 'Generate' },
  { id: 'checking', label: 'Polish' },
]

const LIVE_TIPS = [
  'Packaging stays locked — we only change scene & light.',
  'Formats finish one by one — keepers appear below live.',
  'Tip: one clear packshot beats three blurry ones.',
  'UGC & studio looks share the same product identity.',
  'You can recreate any shot after this finishes.',
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

function isFailedNote(note?: string) {
  const n = (note || '').toLowerCase()
  return n.includes('failed') || n.includes('upgrade')
}

function isReadyOutput(o: MockOutput) {
  if (isFailedNote(o.note)) return false
  if (o.kind === 'video') return Boolean(o.videoUrl)
  return Boolean(o.imageUrl)
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
  const readyOnes = outputs.filter(isReadyOutput)
  const active =
    outputs.find((o) => o.id === activeOutputId) ||
    readyOnes[readyOnes.length - 1] ||
    outputs[0] ||
    null
  const activeVideo = active?.kind === 'video' ? active.videoUrl || null : null
  const failed = isFailedNote(active?.note)
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
  const currentStep = stepIndex(phase)
  const doneCount = readyOnes.length
  const totalCount = Math.max(outputs.length, 1)

  const [tipIndex, setTipIndex] = useState(0)
  useEffect(() => {
    if (!working) return
    const id = window.setInterval(() => {
      setTipIndex((i) => (i + 1) % LIVE_TIPS.length)
    }, 3200)
    return () => window.clearInterval(id)
  }, [working])

  const headline =
    phase === 'ready'
      ? failed
        ? 'Generation didn’t finish'
        : doneCount === 1
          ? '1 creative ready'
          : `${doneCount} creatives ready`
      : phase === 'error'
        ? 'Something went wrong'
        : kind === 'videos'
          ? 'Bringing your product to motion'
          : 'Lighting your product'

  const stageMedia =
    active && isReadyOutput(active) ? (
      activeVideo ? (
        <SafeVideo
          key={active.id}
          src={activeVideo}
          controls
          playsInline
          autoPlay
          muted={working}
          poster={active.imageUrl}
          loadTimeoutSec={40}
        />
      ) : (
        <img key={active.id} src={active.imageUrl} alt={active.label} />
      )
    ) : null

  return (
    <aside
      className={`studio-create-screen${working ? ' is-working' : ''}${phase === 'ready' ? ' is-ready' : ''}${phase === 'error' ? ' is-error' : ''}`}
      aria-live="polite"
    >
      <div className="studio-create-atmosphere" aria-hidden="true">
        <span className="studio-create-orb studio-create-orb-a" />
        <span className="studio-create-orb studio-create-orb-b" />
        <span className="studio-create-shard" />
      </div>

      <header className="studio-create-head">
        <div className="studio-create-head-row">
          <p className="studio-create-kicker">
            {kind === 'videos' ? 'Video Studio' : 'Image Studio'}
          </p>
          {working ? (
            <span className="studio-create-live">
              <i /> Live
            </span>
          ) : null}
        </div>
        <h2>{headline}</h2>
        <p className="studio-create-sub">
          {working
            ? message || 'Formats appear as soon as each one finishes.'
            : phase === 'ready'
              ? failed
                ? message ||
                  active?.note ||
                  'Upgrade or retry — we didn’t fake a result with your upload.'
                : message || 'Review, download, or open the project.'
              : message || 'Generation stopped.'}
        </p>
      </header>

      {working ? (
        <div className="studio-create-meter" aria-label={`${pct} percent`}>
          <div className="studio-create-meter-top">
            <div className="studio-create-ring" style={{ ['--pct' as string]: pct }}>
              <strong>{pct}</strong>
              <span>%</span>
            </div>
            <div className="studio-create-meter-copy">
              <p className="studio-create-meter-status">{message || 'Working…'}</p>
              <p className="studio-create-meter-count">
                {doneCount} of {totalCount} formats ready
              </p>
              <div className="studio-create-pills" role="list">
                {STEPS.map((step, i) => {
                  const state =
                    i < currentStep
                      ? 'is-done'
                      : i === currentStep
                        ? 'is-active'
                        : ''
                  return (
                    <span key={step.id} className={`studio-create-pill ${state}`} role="listitem">
                      {i < currentStep ? '✓' : step.label}
                    </span>
                  )
                })}
              </div>
            </div>
          </div>
          <div className="studio-create-bar" aria-hidden="true">
            <i style={{ width: `${pct}%` }} />
          </div>
          <p className="studio-create-tip" key={tipIndex}>
            {LIVE_TIPS[tipIndex]}
          </p>
        </div>
      ) : null}

      <div className="studio-create-stage">
        {stageMedia ? (
          <div className={`studio-create-result${working ? ' is-live' : ''}`}>
            {stageMedia}
            {working ? (
              <span className="studio-create-badge">{active?.label || 'Ready'}</span>
            ) : null}
          </div>
        ) : working && previewUrl ? (
          <div className="studio-create-preview">
            <img src={previewUrl} alt="" referrerPolicy="no-referrer" />
            <div className="studio-create-veil">
              <span className="studio-create-scanner" aria-hidden="true" />
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
            <strong>Stage</strong>
            <p>
              {kind === 'videos'
                ? 'Clips appear here the moment each format finishes.'
                : 'Shots appear here the moment each format finishes.'}
            </p>
          </div>
        )}
      </div>

      {outputs.length > 0 && (working || phase === 'ready') ? (
        <ul className="studio-create-thumbs" aria-label="Generated outputs">
          {outputs.map((o) => {
            const vid = o.kind === 'video' ? o.videoUrl : null
            const bad = isFailedNote(o.note)
            const ready = isReadyOutput(o)
            const pending = working && !ready && !bad
            return (
              <li key={o.id}>
                <button
                  type="button"
                  className={`${o.id === active?.id ? 'is-active' : ''}${bad ? ' is-failed' : ''}${pending ? ' is-pending' : ''}${ready ? ' is-ready' : ''}`}
                  onClick={() => onSelectOutput?.(o.id)}
                  disabled={pending}
                >
                  {vid && ready ? (
                    <video src={vid} muted playsInline preload="metadata" />
                  ) : o.imageUrl && ready ? (
                    <img src={o.imageUrl} alt="" />
                  ) : pending ? (
                    <span className="studio-create-thumb-wait">
                      <i />
                    </span>
                  ) : (
                    <span>{o.label.slice(0, 10)}</span>
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
          <Link className="btn btn-ghost" to="/app/products">
            View in Products
          </Link>
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
