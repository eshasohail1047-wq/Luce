import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authFailureMessage, verifyBearerToken } from './_lib/firebaseAdmin.js'
import {
  generateCampaignVideos,
  VIDEO_ASSET_KINDS,
  type VideoAssetKind,
} from './_lib/generateVideos.js'

export const config = {
  maxDuration: 300,
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

  const result = await generateCampaignVideos({
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
    assets,
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
