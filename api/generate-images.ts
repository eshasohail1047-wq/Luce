import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyBearerToken } from './_lib/firebaseAdmin'
import {
  generateCampaignImages,
  IMAGE_ASSET_KINDS,
  type ImageAssetKind,
} from './_lib/generateImages'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const decoded = await verifyBearerToken(req.headers.authorization)
  if (!decoded?.uid) {
    return res.status(401).json({ error: 'Sign in required to generate images.' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
  const assetsRaw = Array.isArray(body.assets) ? body.assets : []
  const assets = assetsRaw
    .map((a: unknown) => String(a))
    .filter((a: string): a is ImageAssetKind =>
      (IMAGE_ASSET_KINDS as string[]).includes(a),
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

  const result = await generateCampaignImages({
    productName: String(body.productName ?? ''),
    productImage:
      typeof body.productImage === 'string' ? body.productImage : undefined,
    referenceImage:
      typeof body.referenceImage === 'string' ? body.referenceImage : undefined,
    creativeDirection,
    assets,
    recreateNote:
      typeof body.recreateNote === 'string' ? body.recreateNote : undefined,
  })

  return res.status(result.status).json(result.body)
}
