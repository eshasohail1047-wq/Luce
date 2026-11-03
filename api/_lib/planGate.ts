import { FieldValue } from 'firebase-admin/firestore'
import { getAdminDb } from './firebaseAdmin.js'

export type ServerPlan = 'free' | 'starter' | 'growth' | 'pro'

const PAID: ReadonlySet<string> = new Set(['starter', 'growth', 'pro'])

/** Hard ceiling per request, even for paid plans (bounds provider spend). */
export const MAX_ASSETS_PER_REQUEST = 20

export type GateResult =
  | { ok: true; plan: ServerPlan; refund?: () => Promise<void> }
  | { ok: false; status: number; error: string; needsPaywall?: boolean }

function normalizePlan(value: unknown): ServerPlan {
  return typeof value === 'string' && PAID.has(value) ? (value as ServerPlan) : 'free'
}

export function isPaid(plan: ServerPlan): boolean {
  return PAID.has(plan)
}

/** Source of truth for the plan: users/{uid}.plan, which clients cannot write (firestore.rules). */
export async function getServerPlan(uid: string): Promise<ServerPlan> {
  const snap = await getAdminDb().collection('users').doc(uid).get()
  return normalizePlan(snap.data()?.plan)
}

function tooMany(count: number): GateResult | null {
  return count > MAX_ASSETS_PER_REQUEST
    ? {
        ok: false,
        status: 400,
        error: `Too many assets in one request (max ${MAX_ASSETS_PER_REQUEST}).`,
      }
    : null
}

/**
 * Images: paid plans pass. Free gets exactly one asset, once. The free try is reserved
 * atomically BEFORE generating; call `refund()` if generation produced nothing.
 */
export async function gateImages(uid: string, assetCount: number): Promise<GateResult> {
  const capped = tooMany(assetCount)
  if (capped) return capped

  const db = getAdminDb()
  const ref = db.collection('users').doc(uid)
  return db.runTransaction(async (tx): Promise<GateResult> => {
    const snap = await tx.get(ref)
    const data = snap.data()
    const plan = normalizePlan(data?.plan)
    if (isPaid(plan)) return { ok: true, plan }

    if (assetCount > 1) {
      return {
        ok: false,
        status: 402,
        needsPaywall: true,
        error: 'Free includes one image. Upgrade to generate more.',
      }
    }
    if (data?.freeImageUsed === true) {
      return {
        ok: false,
        status: 402,
        needsPaywall: true,
        error: 'Your free image pack is used. Upgrade to keep generating.',
      }
    }

    tx.set(ref, { freeImageUsed: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    return {
      ok: true,
      plan,
      refund: async () => {
        await ref.set(
          { freeImageUsed: false, updatedAt: FieldValue.serverTimestamp() },
          { merge: true },
        )
      },
    }
  })
}

/** Videos: paid plans only. */
export async function gateVideos(uid: string, assetCount: number): Promise<GateResult> {
  const capped = tooMany(assetCount)
  if (capped) return capped
  const plan = await getServerPlan(uid)
  if (!isPaid(plan)) {
    return {
      ok: false,
      status: 402,
      needsPaywall: true,
      error: 'Video generation requires a paid plan.',
    }
  }
  return { ok: true, plan }
}
