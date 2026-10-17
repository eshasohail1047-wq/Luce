import { requireAuth } from './firebase'

export type TransactionalType =
  | 'welcome'
  | 'plan_upgraded'
  | 'pack_ready'
  | 'pack_exported'

export type TransactionalPayload = {
  type: TransactionalType
  name?: string
  planName?: string
  productName?: string
  campaignUrl?: string
}

/**
 * Fire-and-forget Resend transactional email.
 * Never blocks the UI — failures are logged only.
 */
export async function sendTransactionalEmail(
  payload: TransactionalPayload,
): Promise<void> {
  try {
    const user = requireAuth().currentUser
    if (!user?.email) return
    const token = await user.getIdToken()
    const res = await fetch('/api/transactional', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ...payload,
        name: payload.name || user.displayName || '',
      }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      console.warn('[email]', payload.type, data.error || res.status)
    }
  } catch (err) {
    console.warn('[email]', payload.type, err)
  }
}
