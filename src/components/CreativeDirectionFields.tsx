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
}: CreativeDirectionFieldsProps) {
  return (
    <section className="form-section create-direction">
      <div className="form-section-head">
        <h2>Creative direction</h2>
        <p>
          {compact
            ? 'Optional — one prompt applied across every selected format'
            : 'Optional — guide every asset with your prompt and theme choices'}
        </p>
      </div>

      <div className="auth-field">
        <label htmlFor="creative-prompt">Your prompt</label>
        <textarea
          id="creative-prompt"
          rows={3}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder={promptPlaceholder}
          disabled={disabled}
        />
      </div>

      {compact ? null : (
        <>

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
        </>
      )}
    </section>
  )
}
