import { createHash } from 'node:crypto'
import { FieldValue } from 'firebase-admin/firestore'
import type { VercelRequest } from '@vercel/node'
import { getAdminDb } from './firebaseAdmin.js'

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number }

/**
 * Fixed-window counter in Firestore (`rateLimits/{hash}`, Admin-only; client rules deny it).
 * Throws if Firestore is unreachable so callers fail closed.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSec: number,
): Promise<RateLimitResult> {
  const db = getAdminDb()
  const id = createHash('sha256').update(key).digest('hex').slice(0, 40)
  const ref = db.collection('rateLimits').doc(id)
  const now = Date.now()
  const windowMs = windowSec * 1000

  return db.runTransaction(async (tx): Promise<RateLimitResult> => {
    const snap = await tx.get(ref)
    const data = snap.data() as { count?: number; windowStart?: number } | undefined
    const start = typeof data?.windowStart === 'number' ? data.windowStart : 0

    if (!data || now - start >= windowMs) {
      tx.set(ref, {
        count: 1,
        windowStart: now,
        expiresAt: new Date(now + windowMs * 2),
        updatedAt: FieldValue.serverTimestamp(),
      })
      return { ok: true }
    }
    if ((data.count ?? 0) >= max) {
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((start + windowMs - now) / 1000)),
      }
    }
    tx.update(ref, { count: FieldValue.increment(1) })
    return { ok: true }
  })
}

export function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for']
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(',')[0]?.trim()
  return first || req.socket?.remoteAddress || 'unknown'
}
