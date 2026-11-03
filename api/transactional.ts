import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyBearerToken } from './_lib/firebaseAdmin.js'
import { getServerPlan, isPaid } from './_lib/planGate.js'
import { rateLimit } from './_lib/rateLimit.js'
import {
  sendTransactionalEmail,
  type TransactionalType,
} from './_lib/transactional.js'

const ALLOWED: TransactionalType[] = [
  'welcome',
  'plan_upgraded',
  'pack_ready',
  'pack_exported',
]

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const decoded = await verifyBearerToken(req.headers.authorization)
  if (!decoded?.email) {
    return res.status(401).json({ error: 'Sign in required to send account emails.' })
  }
  // Mail only goes to the token's own address, and only once that address is verified,
  // so nobody can sign up with someone else's email to relay branded mail to them.
  if (!decoded.emailVerified) {
    return res.status(403).json({ error: 'Verify your email address to receive account emails.' })
  }

  let body: Record<string, unknown>
  try {
    const parsed: unknown = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
    body = parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' })
  }
  const type = String(body.type ?? '') as TransactionalType
  if (!ALLOWED.includes(type)) {
    return res.status(400).json({ error: 'Unknown email type' })
  }

  const limited = await rateLimit(`mail:${decoded.uid}`, 10, 3600)
  if (!limited.ok) {
    res.setHeader('Retry-After', String(limited.retryAfterSec))
    return res.status(429).json({ error: 'Too many emails requested. Try again later.' })
  }

  // The plan in a "plan upgraded" email comes from server state, never from the request.
  let planName = ''
  if (type === 'plan_upgraded') {
    const plan = await getServerPlan(decoded.uid)
    if (!isPaid(plan)) {
      return res.status(403).json({ error: 'No paid plan on this account.' })
    }
    planName = plan.charAt(0).toUpperCase() + plan.slice(1)
  }

  const result = await sendTransactionalEmail({
    type,
    email: decoded.email,
    name: String(body.name ?? decoded.name ?? '').slice(0, 80),
    planName,
    productName: String(body.productName ?? '').slice(0, 120),
    campaignUrl: String(body.campaignUrl ?? '').slice(0, 500),
  })

  return res.status(result.status).json(result.body)
}
