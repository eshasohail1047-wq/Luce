import type { VercelRequest, VercelResponse } from '@vercel/node'
import { authFailureMessage, verifyBearerToken } from './_lib/firebaseAdmin.js'
import { pollVideoJob } from './_lib/openRouter.js'
import { rateLimit } from './_lib/rateLimit.js'

/** Poll an async video job started by POST /api/generate-videos { async: true }. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const decoded = await verifyBearerToken(req.headers.authorization)
    if (!decoded?.uid) {
      return res
        .status(401)
        .json({ error: authFailureMessage(req.headers.authorization, 'videos') })
    }

    const raw = req.query.jobId
    const jobId = Array.isArray(raw) ? raw[0] : raw
    if (!jobId || typeof jobId !== 'string' || !/^gen-vid-[\w-]+$/i.test(jobId)) {
      return res.status(400).json({ error: 'Valid jobId required' })
    }

    const limited = await rateLimit(`vid-status:${decoded.uid}`, 1500, 3600)
    if (!limited.ok) {
      res.setHeader('Retry-After', String(limited.retryAfterSec))
      return res.status(429).json({ error: 'Too many requests. Try again later.' })
    }

    const result = await pollVideoJob(jobId)
    if (result.status === 'completed') {
      const videoUrl = `/api/openrouter-video/${encodeURIComponent(jobId)}`
      return res.status(200).json({ ok: true, status: 'completed', videoUrl })
    }
    if (result.status === 'failed') {
      return res.status(200).json({ ok: true, status: 'failed', error: result.error })
    }
    return res.status(200).json({ ok: true, status: 'pending' })
  } catch (err) {
    console.error('[video-status] failed', err)
    return res.status(502).json({ error: 'Could not check video status.' })
  }
}
