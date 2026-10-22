import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getAiProviderStatus } from './_lib/providers.js'

/** Public readiness check for image/video providers (no secrets). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const status = getAiProviderStatus()
    return res.status(200).json({ ok: true, ...status })
  } catch (err) {
    console.error('[ai-status] failed', err)
    return res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Status check failed',
    })
  }
}
