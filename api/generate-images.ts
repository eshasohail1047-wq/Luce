import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authFailureMessage, verifyBearerToken } from './_lib/firebaseAdmin.js'
import {
  generateCampaignImages,
  IMAGE_ASSET_KINDS,
  type ImageAssetKind,
} from './_lib/generateImages.js'
import { parseCreativeDirectionBody } from './_lib/parseCreativeDirection.js'
import {
  assertCanGenerate,
  markFreeImageUsedServer,
} from './_lib/userAccess.js'

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
        .json({ error: authFailureMessage(req.headers.authorization, 'images') })
    }

    const access = await assertCanGenerate(decoded.uid, 'images', decoded.email)
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error })
    }

    const body =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
    const assetsRaw = Array.isArray(body.assets) ? body.assets : []
    let assets = assetsRaw
      .map((a: unknown) => String(a))
      .filter((a: string): a is ImageAssetKind =>
        (IMAGE_ASSET_KINDS as string[]).includes(a),
      )

    // Free try: one image asset max
    if (!access.access.paid && assets.length > 1) {
      assets = assets.slice(0, 1)
    }

    const creativeDirection = parseCreativeDirectionBody(body.creativeDirection)

    const result = await generateCampaignImages({
      productName: String(body.productName ?? ''),
      productImage:
        typeof body.productImage === 'string' ? body.productImage : undefined,
      referenceImage:
        typeof body.referenceImage === 'string'
          ? body.referenceImage
          : undefined,
      creativeDirection,
      assets,
      recreateNote:
        typeof body.recreateNote === 'string' ? body.recreateNote : undefined,
    })

    if (
      result.status >= 200 &&
      result.status < 300 &&
      !access.access.paid &&
      !access.access.freeImageUsed
    ) {
      try {
        await markFreeImageUsedServer(decoded.uid)
      } catch (markErr) {
        console.warn('[generate-images] markFreeImageUsed failed', markErr)
      }
    }

    return res.status(result.status).json(result.body)
  } catch (err) {
    console.error('[generate-images] handler failed', err)
    return res.status(500).json({
      error:
        err instanceof Error && err.message
          ? err.message
          : 'Image generation failed on server',
    })
  }
}
