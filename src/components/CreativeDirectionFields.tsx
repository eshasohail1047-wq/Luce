import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
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
  /** Paste a public image/video URL as the style reference */
  onReferenceUrl?: (url: string) => void | Promise<void>
  referenceUrlBusy?: boolean
  referenceError?: string | null
  /** Image studio uses photo refs; video studio uses video refs */
  referenceKind?: 'image' | 'video'
  /** Video Studio: product image drives generation; prompt + ref video optional */
  videoStudioMode?: boolean
  sectionTitle?: string
  sectionHint?: string
  /** When true, skip outer section chrome (parent already provides the heading). */
  embedded?: boolean
  /** Reference is set — formats are skipped; copy should say match-the-look. */
  referenceActive?: boolean
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
  onReferenceUrl,
  referenceUrlBusy = false,
  referenceError,
  referenceKind = 'image',
  videoStudioMode = false,
  sectionTitle,
  sectionHint,
  /** When true, skip outer section chrome (parent already provides the heading). */
  embedded = false,
  referenceActive = false,
}: CreativeDirectionFieldsProps) {
  const refInput = useRef<HTMLInputElement>(null)
  const [refMode, setRefMode] = useState<'file' | 'url'>('file')
  const [refLink, setRefLink] = useState('')
  const isVideoRef = referenceKind === 'video'
  /** Once a reference is active, lead with it — it drives the look. */
  const refFirst = referenceActive

  function onPickRef(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null
    onReferenceFile?.(file)
    e.target.value = ''
  }

  async function onSubmitRefLink(e: FormEvent) {
    e.preventDefault()
    const url = refLink.trim()
    if (!url || !onReferenceUrl) return
    await onReferenceUrl(url)
  }

  const referenceBlock = onReferenceFile ? (
    <div className={`ref-upload-block${referenceActive ? ' is-active-ref' : ''}`}>
      <div className="ref-upload-head">
        <div>
          <strong>
            {isVideoRef ? 'Reference video' : 'Reference photo'}
            {referenceActive ? ' · driving the look' : ' · optional'}
          </strong>
          <p>
            {referenceActive
              ? isVideoRef
                ? 'We’ll match this clip’s pace and framing. Format picking is skipped.'
                : 'We’ll match this look. Format picking is skipped — remove the reference to choose formats instead.'
              : videoStudioMode
                ? 'Add a vibe clip to match its look, or skip and pick formats below.'
                : isVideoRef
                  ? 'Optional vibe clip — or skip and pick formats below.'
                  : 'Add a look to match, or skip and pick formats below. Don’t mix both.'}
          </p>
        </div>
      </div>
      {onReferenceUrl ? (
        <div className="source-toggle ref-source-toggle" role="tablist" aria-label="Reference source">
          <button
            type="button"
            role="tab"
            aria-selected={refMode === 'file'}
            className={refMode === 'file' ? 'is-active' : ''}
            onClick={() => setRefMode('file')}
            disabled={disabled || referenceUrlBusy}
          >
            <span className="source-toggle-title">
              {isVideoRef ? 'Upload video' : 'Upload photo'}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={refMode === 'url'}
            className={refMode === 'url' ? 'is-active' : ''}
            onClick={() => setRefMode('url')}
            disabled={disabled || referenceUrlBusy}
          >
            <span className="source-toggle-title">Paste link</span>
          </button>
        </div>
      ) : null}
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
              onClick={() => {
                if (refMode === 'url') setRefMode('url')
                else refInput.current?.click()
              }}
              disabled={disabled || referenceUrlBusy}
            >
              Replace
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                onReferenceFile(null)
                setRefLink('')
              }}
              disabled={disabled || referenceUrlBusy}
            >
              Remove
            </button>
          </div>
        </div>
      ) : refMode === 'url' && onReferenceUrl ? (
        <form className="ref-url-form" onSubmit={(e) => void onSubmitRefLink(e)}>
          <label htmlFor="creative-ref-url">
            {isVideoRef ? 'Reference video URL' : 'Reference image URL'}
          </label>
          <div className="ref-url-row">
            <input
              id="creative-ref-url"
              type="url"
              value={refLink}
              onChange={(e) => setRefLink(e.target.value)}
              placeholder={
                isVideoRef
                  ? 'https://…/reference.mp4'
                  : 'https://…/reference.jpg'
              }
              disabled={disabled || referenceUrlBusy}
            />
            <button
              type="submit"
              className="btn btn-ghost"
              disabled={disabled || referenceUrlBusy || !refLink.trim()}
            >
              {referenceUrlBusy ? 'Loading…' : 'Use link'}
            </button>
          </div>
          <p className="field-hint">
            Public direct link to {isVideoRef ? 'an MP4/WebM' : 'a JPG/PNG/WebP'} works best.
          </p>
        </form>
      ) : (
        <button
          type="button"
          className="ref-upload-empty"
          onClick={() => refInput.current?.click()}
          disabled={disabled}
        >
          <span className="ref-upload-empty-title">
            {isVideoRef ? 'Drop a reference video' : 'Drop a reference photo'}
          </span>
          <span className="ref-upload-empty-copy">
            {isVideoRef
              ? 'Match pace & framing · MP4 / WebM · up to 40MB'
              : 'Match lighting & mood · JPG / PNG · up to 12MB'}
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
        Prompt · optional
      </label>
      <textarea
        id="creative-prompt"
        rows={3}
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder={promptPlaceholder}
        disabled={disabled}
      />
      <p className="field-hint">
        {referenceActive
          ? 'Optional notes on top of the reference look.'
          : videoStudioMode
            ? 'Optional — scene, dialogue, or offer. Next: formats or your own reference.'
            : 'Optional — lighting, scene, or mood. Next: formats or your own reference.'}
      </p>
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
