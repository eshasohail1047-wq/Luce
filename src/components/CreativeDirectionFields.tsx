import { useRef, type ChangeEvent } from 'react'
import {
  BACKGROUND_OPTIONS,
  LIGHTING_OPTIONS,
  MOOD_OPTIONS,
  STYLE_THEME_OPTIONS,
  type BackgroundId,
  type LightingId,
  type MoodId,
  type StyleThemeId,
} from '../lib/creativeDirection'

type CreativeDirectionFieldsProps = {
  prompt: string
  onPromptChange: (value: string) => void
  lighting: LightingId | ''
  onLightingChange: (value: LightingId | '') => void
  background: BackgroundId | ''
  onBackgroundChange: (value: BackgroundId | '') => void
  mood: MoodId | ''
  onMoodChange: (value: MoodId | '') => void
  styleTheme: StyleThemeId | ''
  onStyleThemeChange: (value: StyleThemeId | '') => void
  disabled?: boolean
  promptPlaceholder?: string
  /** Prompt only — hide lighting/mood/theme selects */
  compact?: boolean
  /** Optional mood/style reference (not the product) */
  referencePreviewUrl?: string | null
  onReferenceFile?: (file: File | null) => void
  referenceError?: string | null
  /** Image studio uses photo refs; video studio uses video refs */
  referenceKind?: 'image' | 'video'
  /** Video Studio: reference first, then prompt; both required */
  videoStudioMode?: boolean
  sectionTitle?: string
  sectionHint?: string
  /** When true, skip outer section chrome (parent already provides the heading). */
  embedded?: boolean
}

export default function CreativeDirectionFields({
  prompt,
  onPromptChange,
  lighting,
  onLightingChange,
  background,
  onBackgroundChange,
  mood,
  onMoodChange,
  styleTheme,
  onStyleThemeChange,
  disabled,
  promptPlaceholder = 'Describe the look, scene, offer, or message you want…',
  compact = false,
  referencePreviewUrl,
  onReferenceFile,
  referenceError,
  referenceKind = 'image',
  videoStudioMode = false,
  sectionTitle,
  sectionHint,
  /** When true, skip outer section chrome (parent already provides the heading). */
  embedded = false,
}: CreativeDirectionFieldsProps) {
  const refInput = useRef<HTMLInputElement>(null)
  const isVideoRef = referenceKind === 'video'
  const refFirst = videoStudioMode && isVideoRef

  function onPickRef(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null
    onReferenceFile?.(file)
    e.target.value = ''
  }

  const referenceBlock = onReferenceFile ? (
    <div className={`ref-upload-block${videoStudioMode ? ' is-required' : ''}`}>
      <div className="ref-upload-head">
        <div>
          <strong>
            {isVideoRef ? 'Reference video' : 'Reference photo'}
            {videoStudioMode ? ' · required' : ''}
          </strong>
          <p>
            {videoStudioMode
              ? 'Primary guide — we match this clip’s pace, framing, and energy first. Your product photo stays packaging-true.'
              : isVideoRef
                ? 'Optional — a short clip of the vibe you want (pace, framing, energy). Your product photo stays the packaging source of truth.'
                : 'Optional — a mood or style pic for the shoot (lighting, scene, vibe). Your product photo stays the packaging source of truth.'}
          </p>
        </div>
      </div>
      <input
        ref={refInput}
        type="file"
        accept={
          isVideoRef
            ? 'video/mp4,video/webm,video/quicktime'
            : 'image/jpeg,image/png,image/webp,image/gif'
        }
        hidden
        onChange={onPickRef}
        disabled={disabled}
      />
      {referencePreviewUrl ? (
        <div className="ref-upload-preview">
          {isVideoRef ? (
            <video src={referencePreviewUrl} muted playsInline controls preload="metadata" />
          ) : (
            <img src={referencePreviewUrl} alt="Shoot reference" />
          )}
          <div className="ref-upload-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => refInput.current?.click()}
              disabled={disabled}
            >
              Replace
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onReferenceFile(null)}
              disabled={disabled}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="ref-upload-empty"
          onClick={() => refInput.current?.click()}
          disabled={disabled}
        >
          <span className="ref-upload-empty-title">
            {isVideoRef ? 'Add a reference video' : 'Add a reference photo'}
          </span>
          <span className="ref-upload-empty-copy">
            {isVideoRef
              ? 'MP4 / WebM / MOV · up to 40MB · short clips work best'
              : 'e.g. a shoot look you like · JPG / PNG · up to 12MB'}
          </span>
        </button>
      )}
      {referenceError ? (
        <p className="auth-error" role="alert">
          {referenceError}
        </p>
      ) : null}
    </div>
  ) : null

  const promptBlock = (
    <div className="auth-field">
      <label htmlFor="creative-prompt">
        Your prompt{videoStudioMode ? ' · required' : ''}
      </label>
      <textarea
        id="creative-prompt"
        rows={3}
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder={promptPlaceholder}
        disabled={disabled}
        required={videoStudioMode}
      />
      {videoStudioMode ? (
        <p className="field-hint">Used after the reference video to refine scene, dialogue, and offer.</p>
      ) : null}
    </div>
  )

  const body = (
    <>
      {!embedded ? (
        <div className="form-section-head">
          <h2>{sectionTitle || 'Creative direction'}</h2>
          <p>
            {sectionHint ||
              (compact
                ? isVideoRef
                  ? 'Optional — prompt and a reference video for the shoot style'
                  : 'Optional — prompt and a style reference for the shoot'
                : 'Optional — guide every asset with your prompt and theme choices')}
          </p>
        </div>
      ) : null}

      {refFirst ? (
        <>
          {referenceBlock}
          {promptBlock}
        </>
      ) : (
        <>
          {promptBlock}
          {referenceBlock}
        </>
      )}

      {compact ? null : (
        <div className="create-direction-grid">
          <div className="auth-field">
            <label htmlFor="creative-lighting">Lighting</label>
            <select
              id="creative-lighting"
              value={lighting}
              onChange={(e) => onLightingChange(e.target.value as LightingId | '')}
              disabled={disabled}
            >
              <option value="">Choose lighting</option>
              {LIGHTING_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="auth-field">
            <label htmlFor="creative-background">Background</label>
            <select
              id="creative-background"
              value={background}
              onChange={(e) => onBackgroundChange(e.target.value as BackgroundId | '')}
              disabled={disabled}
            >
              <option value="">Choose background</option>
              {BACKGROUND_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="auth-field">
            <label htmlFor="creative-mood">Mood</label>
            <select
              id="creative-mood"
              value={mood}
              onChange={(e) => onMoodChange(e.target.value as MoodId | '')}
              disabled={disabled}
            >
              <option value="">Choose mood</option>
              {MOOD_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="auth-field">
            <label htmlFor="creative-theme">Style theme</label>
            <select
              id="creative-theme"
              value={styleTheme}
              onChange={(e) => onStyleThemeChange(e.target.value as StyleThemeId | '')}
              disabled={disabled}
            >
              <option value="">Choose theme</option>
              {STYLE_THEME_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}
    </>
  )

  if (embedded) {
    return <div className="create-direction create-direction-embedded">{body}</div>
  }

  return <section className="form-section create-direction">{body}</section>
}
