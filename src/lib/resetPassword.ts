export type ResetPasswordResult =
  | { ok: true; via: 'resend' | 'firebase'; googleOnly?: boolean }
  | { ok: false; error: string; googleOnly?: boolean }

/**
 * Prefer Resend (reliable inbox delivery). Fall back to Firebase's built-in
 * mail only if the API is not configured / not running.
 */
export async function requestPasswordReset(
  email: string,
): Promise<ResetPasswordResult> {
  const trimmed = email.trim().toLowerCase()

  try {
    const res = await fetch('/api/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmed }),
    })
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return { ok: false, error: '__FALLBACK_FIREBASE__' }
    }

    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean
      error?: string
      googleOnly?: boolean
      via?: 'resend' | 'firebase'
    }

    if (res.ok && data.ok) {
      return {
        ok: true,
        via: data.via ?? 'resend',
        googleOnly: data.googleOnly,
      }
    }

    // API exists but rejected (e.g. Google-only, invalid email)
    if (res.status === 400 || res.status === 404) {
      return {
        ok: false,
        error: data.error || 'Could not send reset email.',
        googleOnly: data.googleOnly,
      }
    }

    // 501/503 = not configured — fall through to Firebase client send
    if (res.status !== 501 && res.status !== 503 && res.status !== 404) {
      if (data.error) {
        return { ok: false, error: data.error, googleOnly: data.googleOnly }
      }
    }
  } catch {
    /* Vite-only local has no /api — fall back to Firebase client */
  }

  return { ok: false, error: '__FALLBACK_FIREBASE__' }
}
