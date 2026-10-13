export type EarlyAccessPayload = {
  email: string
  productUrl?: string
  source?: string
}

export type EarlyAccessResult =
  | { ok: true; id: string | null }
  | { ok: false; error: string }

export async function submitEarlyAccess(
  payload: EarlyAccessPayload,
): Promise<EarlyAccessResult> {
  try {
    const res = await fetch('/api/early-access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      id?: string | null
      error?: string
    }

    if (!res.ok || !data.ok) {
      const contentType = res.headers.get('content-type') || ''
      if (!contentType.includes('application/json')) {
        return {
          ok: false,
          error: 'Email API is not running. Restart the dev server and try again.',
        }
      }
      return { ok: false, error: data.error || 'Could not send email. Try again.' }
    }

    return { ok: true, id: data.id ?? null }
  } catch {
    return { ok: false, error: 'Network error. Check your connection and try again.' }
  }
}
