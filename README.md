# LUCE

AI campaign creation platform — bring your product to light.

## Develop

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in values. Never commit secrets.

### Image + video generation (OpenRouter)

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Bearer for images + videos |
| `OPENROUTER_IMAGE_MODEL` | Default `google/gemini-2.5-flash-image` → `POST /api/generate-images` |
| `OPENROUTER_VIDEO_MODEL` | Default `heygen/heygen-video-1` → `POST /api/generate-videos` |

Photo Studio / campaign image assets use the images API. Video Studio / video assets use the async videos API (reference still + prompt preferred). If the key is missing or a call fails, LUCE keeps demo stills / format clips so generate still works.

## Build

```bash
npm run build
npm run preview
```
