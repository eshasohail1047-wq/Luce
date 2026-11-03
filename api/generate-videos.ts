import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authFailureMessage, verifyBearerToken } from './_lib/firebaseAdmin.js'
import { gateVideos } from './_lib/planGate.js'
import { rateLimit } from './_lib/rateLimit.js'
import {
  generateCampaignVideos,
  startCampaignVideoJob,
  VIDEO_ASSET_KINDS,
  type VideoAssetKind,
} from './_lib/generateVideos.js'

export const config = {
  maxDuration: 120,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
  const decoded = await verifyBearerToken(req.headers.authorization)
  if (!decoded?.uid) {
    return res
      .status(401)
      .json({ error: authFailureMessage(req.headers.authorization, 'videos') })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
  const assetsRaw = Array.isArray(body.assets) ? body.assets : []
  const assets = assetsRaw
    .map((a: unknown) => String(a))
    .filter((a: string): a is VideoAssetKind =>
      (VIDEO_ASSET_KINDS as string[]).includes(a),
    )

  const uniqueAssets = [...new Set(assets)]
  if (uniqueAssets.length === 0) {
    return res.status(400).json({ error: 'Select at least one video format.' })
  }

  const limited = await rateLimit(`gen-vid:${decoded.uid}`, 20, 3600)
  if (!limited.ok) {
    res.setHeader('Retry-After', String(limited.retryAfterSec))
    return res.status(429).json({ error: 'Too many requests. Try again later.' })
  }

  const gate = await gateVideos(decoded.uid, uniqueAssets.length)
  if (!gate.ok) {
    return res
      .status(gate.status)
      .json({ error: gate.error, needsPaywall: gate.needsPaywall ?? false })
  }

  const creativeDirection =
    body.creativeDirection && typeof body.creativeDirection === 'object'
      ? {
          prompt:
            typeof body.creativeDirection.prompt === 'string'
              ? body.creativeDirection.prompt
              : undefined,
          lighting:
            typeof body.creativeDirection.lighting === 'string'
              ? body.creativeDirection.lighting
              : undefined,
          background:
            typeof body.creativeDirection.background === 'string'
              ? body.creativeDirection.background
              : undefined,
          mood:
            typeof body.creativeDirection.mood === 'string'
              ? body.creativeDirection.mood
              : undefined,
          styleTheme:
            typeof body.creativeDirection.styleTheme === 'string'
              ? body.creativeDirection.styleTheme
              : undefined,
        }
      : undefined

  const wantsAsync = body.async === true
  if (wantsAsync && uniqueAssets.length !== 1) {
    return res.status(400).json({ error: 'Async mode takes exactly one video format.' })
  }
  const runVideos = wantsAsync ? startCampaignVideoJob : generateCampaignVideos
  const result = await runVideos({
    productName: String(body.productName ?? ''),
    productImage:
      typeof body.productImage === 'string' ? body.productImage : undefined,
    referenceFrameImage:
      typeof body.referenceFrameImage === 'string'
        ? body.referenceFrameImage
        : typeof body.referenceImage === 'string'
          ? body.referenceImage
          : undefined,
    creativeDirection,
    assets: uniqueAssets,
    recreateNote:
      typeof body.recreateNote === 'string' ? body.recreateNote : undefined,
    durationSeconds:
      typeof body.durationSeconds === 'number'
        ? body.durationSeconds
        : typeof body.durationSeconds === 'string'
          ? Number(body.durationSeconds)
          : undefined,
  })

  return res.status(result.status).json(result.body)
  } catch (err) {
    console.error('[generate-videos] handler failed', err)
    return res.status(500).json({
      error:
        err instanceof Error && err.message
          ? err.message
          : 'Video generation failed on server',
    })
  }
}
