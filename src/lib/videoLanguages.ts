/** Spoken language for Video Studio + Campaign video clips. */

export type VideoLanguageId =
  | 'en'
  | 'ur'
  | 'ar'
  | 'hi'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'

export const VIDEO_LANGUAGES: {
  id: VideoLanguageId
  label: string
  /** Phrase injected into the video motion prompt */
  promptName: string
}[] = [
  { id: 'en', label: 'English', promptName: 'English' },
  { id: 'ur', label: 'Urdu', promptName: 'Urdu (اردو)' },
  { id: 'ar', label: 'Arabic', promptName: 'Arabic (العربية)' },
  { id: 'hi', label: 'Hindi', promptName: 'Hindi (हिन्दी)' },
  { id: 'es', label: 'Spanish', promptName: 'Spanish (Español)' },
  { id: 'fr', label: 'French', promptName: 'French (Français)' },
  { id: 'de', label: 'German', promptName: 'German (Deutsch)' },
  { id: 'pt', label: 'Portuguese', promptName: 'Portuguese (Português)' },
]

export const DEFAULT_VIDEO_LANGUAGE: VideoLanguageId = 'en'

export function normalizeVideoLanguage(value: unknown): VideoLanguageId {
  const id = typeof value === 'string' ? value.trim() : ''
  return VIDEO_LANGUAGES.some((l) => l.id === id)
    ? (id as VideoLanguageId)
    : DEFAULT_VIDEO_LANGUAGE
}

export function videoLanguageLabel(id: VideoLanguageId): string {
  return VIDEO_LANGUAGES.find((l) => l.id === id)?.label || 'English'
}

/** Append a hard spoken-language instruction for HeyGen / motion prompts. */
export function withVideoLanguagePrompt(
  prompt: string | undefined,
  languageId: VideoLanguageId | string,
): string {
  const lang =
    VIDEO_LANGUAGES.find((l) => l.id === languageId) || VIDEO_LANGUAGES[0]!
  const instruction = `SPOKEN LANGUAGE (required): All dialogue, speech, and talking in this video must be in ${lang.promptName}. Natural delivery for that language. Do not mix languages unless the user prompt explicitly asks.`
  const base = prompt?.trim()
  return base ? `${base}\n\n${instruction}` : instruction
}
