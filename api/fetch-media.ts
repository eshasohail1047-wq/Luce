import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authFailureMessage, verifyBearerToken } from './_lib/firebaseAdmin.js'
import { rateLimit } from './_lib/rateLimit.js'
import { fetchRemoteMedia } from './_lib/fetchRemoteMedia.js'

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
        .json({ error: authFailureMessage(req.headers.authorization, 'media') })
    }
    const limited = await rateLimit(`fetch-media:${decoded.uid}`, 40, 3600)
    if (!limited.ok) {
      res.setHeader('Retry-After', String(limited.retryAfterSec))
      return res.status(429).json({ error: 'Too many requests. Try again later.' })
    }

    let body: Record<string, unknown>
    try {
      const parsed: unknown =
        typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
      body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' })
    }
    const url = typeof body.url === 'string' ? body.url : ''
    const preferRaw = typeof body.prefer === 'string' ? body.prefer : 'any'
    const prefer =
      preferRaw === 'image' || preferRaw === 'video' ? preferRaw : 'any'
    const result = await fetchRemoteMedia(url, prefer)
    if (!result.ok) {
      return res.status(result.status).json({ error: result.error })
    }
    return res.status(200).json({ ok: true, ...result.data })
  } catch (err) {
    console.error('[fetch-media]', err)
    return res.status(500).json({
      error:
        err instanceof Error && err.message
          ? err.message
          : 'Could not fetch media.',
    })
  }
}
