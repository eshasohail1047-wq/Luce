import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchRemoteMedia } from './_lib/fetchRemoteMedia.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body =
      typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
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
