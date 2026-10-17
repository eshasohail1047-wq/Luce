import type { VercelRequest, VercelResponse } from '@vercel/node'
import { verifyBearerToken } from './_lib/firebaseAdmin'
import {
  sendTransactionalEmail,
  type TransactionalType,
} from './_lib/transactional'

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

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body ?? {}
  const type = String(body.type ?? '') as TransactionalType
  if (!ALLOWED.includes(type)) {
    return res.status(400).json({ error: 'Unknown email type' })
  }

  const result = await sendTransactionalEmail({
    type,
    email: decoded.email,
    name: String(body.name ?? decoded.name ?? ''),
    planName: String(body.planName ?? ''),
    productName: String(body.productName ?? ''),
    campaignUrl: String(body.campaignUrl ?? ''),
  })

  return res.status(result.status).json(result.body)
}
