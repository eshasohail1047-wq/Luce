import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendEarlyAccessEmail } from './_lib/earlyAccess.js'
import { clientIp, rateLimit } from './_lib/rateLimit.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  let body: Record<string, unknown>
  try {
    const parsed: unknown = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
    body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }
  const email = String(body.email ?? '').trim().toLowerCase()

  const byIp = await rateLimit(`early-ip:${clientIp(req)}`, 5, 3600)
  if (!byIp.ok) {
    res.setHeader('Retry-After', String(byIp.retryAfterSec))
    return res.status(429).json({ error: 'Too many requests. Try again later.' })
  }
  const byEmail = await rateLimit(`early-email:${email}`, 2, 86400)
  if (!byEmail.ok) {
    return res.status(200).json({ ok: true, id: null })
  }

  const result = await sendEarlyAccessEmail({
    email,
    productUrl: String(body.productUrl ?? '').slice(0, 500),
    source: String(body.source ?? 'landing').slice(0, 64),
  })
  return res.status(result.status).json(result.body)
}
