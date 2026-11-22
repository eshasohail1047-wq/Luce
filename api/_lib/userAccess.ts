import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getAdminApp } from './firebaseAdmin.js'
import { isOwnerEmail, OWNER_PLAN } from './ownerAccess.js'

export type UserPlan = 'free' | 'starter' | 'growth' | 'pro'
export type GenerateKind = 'images' | 'videos' | 'copy'

export type UserAccess = {
  plan: UserPlan
  freeImageUsed: boolean
  paid: boolean
}

function normalizePlan(value: unknown): UserPlan {
  if (value === 'starter' || value === 'growth' || value === 'pro') return value
  return 'free'
}

export async function loadUserAccess(
  uid: string,
  email?: string | null,
): Promise<UserAccess> {
  if (isOwnerEmail(email)) {
    return {
      plan: OWNER_PLAN,
      freeImageUsed: false,
      paid: true,
    }
  }

  const db = getFirestore(getAdminApp())
  const snap = await db.collection('users').doc(uid).get()
  const data = (snap.data() || {}) as Record<string, unknown>
  const docEmail =
    typeof data.email === 'string' ? data.email : undefined
  if (isOwnerEmail(docEmail) || isOwnerEmail(email)) {
    return {
      plan: OWNER_PLAN,
      freeImageUsed: false,
      paid: true,
    }
  }
  const plan = normalizePlan(data.plan)
  return {
    plan,
    freeImageUsed: Boolean(data.freeImageUsed),
    paid: plan !== 'free',
  }
}

/**
 * Server-side plan gate.
 * Free: one Image Studio generate only.
 * Owner email: full Pro.
 * Paid: images, videos, copy.
 */
export async function assertCanGenerate(
  uid: string,
  kind: GenerateKind,
  email?: string | null,
): Promise<{ ok: true; access: UserAccess } | { ok: false; status: number; error: string }> {
  let access: UserAccess
  try {
    access = await loadUserAccess(uid, email)
  } catch (err) {
    console.error('[userAccess] load failed', err)
    return {
      ok: false,
      status: 503,
      error: 'Could not verify your plan. Try again in a moment.',
    }
  }

  if (access.paid) {
    return { ok: true, access }
  }

  if (kind === 'images' && !access.freeImageUsed) {
    return { ok: true, access }
  }

  if (kind === 'images') {
    return {
      ok: false,
      status: 402,
      error:
        'Your free image trial is finished. Upgrade to a paid plan for more images, video, and campaigns.',
    }
  }

  if (kind === 'videos') {
    return {
      ok: false,
      status: 402,
      error: 'Video generation requires a paid plan. Upgrade to unlock Video Studio and campaigns.',
    }
  }

  return {
    ok: false,
    status: 402,
    error: 'This feature requires a paid plan.',
  }
}

/** Mark free image try as used (idempotent). */
export async function markFreeImageUsedServer(uid: string): Promise<void> {
  const db = getFirestore(getAdminApp())
  await db.collection('users').doc(uid).set(
    {
      freeImageUsed: true,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  )
}
