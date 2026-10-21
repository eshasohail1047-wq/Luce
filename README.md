# LUCE

AI campaign creation platform — bring your product to light.

## Develop

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in values. Never commit secrets.

### Image + video generation

| Variable | Purpose |
| --- | --- |
| `MUSE_API_KEY` (or `MODEL_API_KEY`) | **Preferred images** — Meta Muse Image (~$0.01/image) |
| `MUSE_IMAGE_MODEL` | Default `muse-image-1.0` |
| `HEYGEN_API_KEY` | **Preferred videos** — HeyGen `heygen-video-1` (image/text → video) |
| `OPENROUTER_API_KEY` | Fallback for images + videos if Muse/HeyGen fail or are unset |
| `OPENROUTER_IMAGE_MODEL` | Default `google/gemini-3-pro-image` (not Flash) |
| `OPENROUTER_VIDEO_MODEL` | Default `heygen/heygen-video-1` via OpenRouter |

Photo Studio → Muse (edit with product photo when present), else OpenRouter.  
Video Studio → HeyGen direct (`image_to_video` / `reference_to_video`), else OpenRouter.  
Missing keys or failed calls keep demo stills / format clips.

## Build

```bash
npm run build
npm run preview
```
