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
}: StudioStagePanelProps) {
  const working = phase !== 'idle' && phase !== 'ready' && phase !== 'error'
  const active =
    outputs.find((o) => o.id === activeOutputId) || outputs[0] || null
  const activeVideo = active?.kind === 'video' ? active.videoUrl || null : null

  return (
    <aside className="studio-stage-panel" aria-live="polite">
      <div className="studio-stage-status">
        <span
          className={`studio-stage-dot${working ? ' is-busy' : ''}${phase === 'ready' ? ' is-ready' : ''}${phase === 'error' ? ' is-error' : ''}`}
        />
        <strong>
          {phase === 'idle'
            ? 'Ready'
            : phase === 'ready'
              ? 'Done'
              : phase === 'error'
                ? 'Error'
                : 'Generating'}
        </strong>
        {message ? <span className="studio-stage-msg">{message}</span> : null}
        {working ? (
          <span className="studio-stage-pct">{Math.round(progress)}%</span>
        ) : null}
      </div>

      <div className="studio-stage-canvas">
        {active && phase === 'ready' ? (
          activeVideo ? (
            <video
              src={activeVideo}
              controls
              playsInline
              poster={active.imageUrl}
            />
          ) : active.imageUrl ? (
            <img src={active.imageUrl} alt={active.label} />
          ) : (
            <div className="studio-stage-empty">No preview</div>
          )
        ) : previewUrl ? (
          <div className="studio-stage-preview-wrap">
            <img src={previewUrl} alt="" referrerPolicy="no-referrer" />
            {working ? (
              <div className="studio-stage-overlay">
                <div className="studio-stage-spinner" aria-hidden="true" />
                <p>{message || 'Generating…'}</p>
                <div className="studio-stage-bar" aria-hidden="true">
                  <span
                    style={{
                      width: `${Math.max(8, Math.min(100, progress))}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="studio-stage-empty">
            <p>
              {kind === 'videos'
                ? 'Results appear here after you generate.'
                : 'Results appear here after you generate.'}
            </p>
          </div>
        )}
      </div>

      {phase === 'ready' && outputs.length > 1 ? (
        <ul className="studio-stage-thumbs" aria-label="Generated outputs">
          {outputs.map((o) => {
            const vid = o.kind === 'video' ? o.videoUrl : null
            return (
              <li key={o.id}>
                <button
                  type="button"
                  className={o.id === active?.id ? 'is-active' : ''}
                  onClick={() => onSelectOutput?.(o.id)}
                >
                  {vid ? (
                    <video src={vid} muted playsInline preload="metadata" />
                  ) : o.imageUrl ? (
                    <img src={o.imageUrl} alt="" />
                  ) : (
                    <span>{o.label}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}

      {phase === 'ready' && active ? (
        <div className="studio-stage-actions">
          {active.imageUrl || activeVideo ? (
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
        </div>
      ) : null}
    </aside>
  )
}
