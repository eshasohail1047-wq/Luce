import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authFailureMessage, verifyBearerToken } from './_lib/firebaseAdmin.js'
import {
  COPY_ASSET_KINDS,
  generateCampaignCopy,
  type CopyAssetKind,
} from './_lib/generateCopy.js'
import { parseCreativeDirectionBody } from './_lib/parseCreativeDirection.js'
import { assertCanGenerate } from './_lib/userAccess.js'

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
        .json({ error: authFailureMessage(req.headers.authorization, 'copy') })
    }

    const access = await assertCanGenerate(decoded.uid, 'copy', decoded.email)
    if (!access.ok) {
      return res.status(access.status).json({ error: access.error })
    }

    const body =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
    const assetsRaw = Array.isArray(body.assets) ? body.assets : []
    const assets = assetsRaw
      .map((a: unknown) => String(a))
      .filter((a: string): a is CopyAssetKind =>
        (COPY_ASSET_KINDS as readonly string[]).includes(a),
      )

    const creativeDirection = parseCreativeDirectionBody(body.creativeDirection)

    const result = await generateCampaignCopy({
      productName: String(body.productName ?? ''),
      brand: typeof body.brand === 'string' ? body.brand : undefined,
      description:
        typeof body.description === 'string' ? body.description : undefined,
      category: typeof body.category === 'string' ? body.category : undefined,
      creativeDirection,
      assets,
      recreateNote:
        typeof body.recreateNote === 'string' ? body.recreateNote : undefined,
    })

    return res.status(result.status).json(result.body)
  } catch (err) {
    console.error('[generate-copy] handler failed', err)
    return res.status(500).json({
      error:
        err instanceof Error && err.message
          ? err.message
          : 'Copy generation failed on server',
    })
  }
}
