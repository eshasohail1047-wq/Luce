import type { VercelRequest, VercelResponse } from '@vercel/node'
import { fetchOpenRouterVideoContent } from '../_lib/openRouter'

export const config = {
  maxDuration: 60,
}

/** Same-origin proxy so browser <video> can play OpenRouter clips (upstream needs API key). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const raw = req.query.jobId
  const jobId = Array.isArray(raw) ? raw[0] : raw
  if (!jobId || typeof jobId !== 'string') {
    return res.status(400).json({ error: 'jobId required' })
  }

  try {
    const { body, contentType } = await fetchOpenRouterVideoContent(jobId)
    res.setHeader('Content-Type', contentType)
    res.setHeader('Cache-Control', 'private, max-age=3600')
    if (req.method === 'HEAD') {
      res.setHeader('Content-Length', String(body.byteLength))
      return res.status(200).end()
    }
    return res.status(200).send(Buffer.from(body))
  } catch (err) {
    console.error('[openrouter-video] proxy failed', err)
    return res.status(502).json({
      error:
        err instanceof Error && err.message
          ? err.message
          : 'Could not load generated video',
    })
  }
}
