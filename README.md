# LUCE

AI campaign creation platform — bring your product to light.

## Develop

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and fill in values. Never commit secrets.

### Image generation (OpenRouter)

Photo / promo / ad **image** assets call OpenRouter when configured:

| Variable | Purpose |
| --- | --- |
| `OPENROUTER_API_KEY` | Bearer token for `POST https://openrouter.ai/api/v1/images` |
| `OPENROUTER_IMAGE_MODEL` | Image model (default `google/gemini-2.5-flash-image`) |

If the key is missing or the API fails, LUCE keeps existing demo stills so generate still works. Videos and copy stay mock.

## Build

```bash
npm run build
npm run preview
```
