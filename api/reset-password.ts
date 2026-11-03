import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendPasswordResetForEmail } from './_lib/passwordReset.js'
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

  const byIp = await rateLimit(`reset-ip:${clientIp(req)}`, 10, 3600)
  if (!byIp.ok) {
    res.setHeader('Retry-After', String(byIp.retryAfterSec))
    return res.status(429).json({ error: 'Too many requests. Try again later.' })
  }
  // Per-address cap: over the limit we answer exactly like success, so it can't be probed.
  const byEmail = await rateLimit(`reset-email:${email}`, 3, 3600)
  if (!byEmail.ok) {
    return res.status(200).json({ ok: true, via: 'resend', id: null })
  }

  const result = await sendPasswordResetForEmail(email)
  return res.status(result.status).json(result.body)
}
