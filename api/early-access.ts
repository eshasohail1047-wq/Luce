import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendEarlyAccessEmail } from './_lib/earlyAccess.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
  const result = await sendEarlyAccessEmail({
    email: String(body.email ?? ''),
    productUrl: String(body.productUrl ?? ''),
    source: String(body.source ?? 'landing'),
  })
  return res.status(result.status).json(result.body)
}
