import { getAuth } from 'firebase-admin/auth'
import { Resend } from 'resend'
import { getAdminApp } from './firebaseAdmin'
import { EMAIL_RE, escapeHtml } from './resendClient'

export type PasswordResetResult =
  | {
      status: 200
      body: {
        ok: true
        via: 'resend'
        id: string | null
        googleOnly?: boolean
      }
    }
  | {
      status: number
      body: { ok?: false; error: string; googleOnly?: boolean }
    }

export async function sendPasswordResetForEmail(
  emailRaw: string,
): Promise<PasswordResetResult> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || apiKey.includes('xxxxxxxxx')) {
    return {
      status: 501,
      body: {
        error:
          'Resend is not configured. Add a real RESEND_API_KEY to .env.local.',
      },
    }
  }

  const email = String(emailRaw ?? '')
    .trim()
    .toLowerCase()

  if (!EMAIL_RE.test(email)) {
    return { status: 400, body: { error: 'Enter a valid email address' } }
  }

  let app: App
  try {
    app = getAdminApp()
  } catch {
    return {
      status: 501,
      body: {
        error:
          'Firebase Admin is not configured. Add FIREBASE_SERVICE_ACCOUNT_JSON or firebase-service-account.json.',
      },
    }
  }

  const auth = getAuth(app)

  let user
  try {
    user = await auth.getUserByEmail(email)
  } catch {
    // Don't reveal whether the account exists
    return { status: 200, body: { ok: true, via: 'resend', id: null } }
  }

  // Google-only users can still receive a reset link to *add* a password.
  const providers = user.providerData.map((p) => p.providerId)
  const googleOnly =
    providers.includes('google.com') && !providers.includes('password')

  const continueUrl =
    process.env.PASSWORD_RESET_CONTINUE_URL ||
    process.env.VITE_APP_URL ||
    'http://localhost:5176/login'

  let link: string
  try {
    link = await auth.generatePasswordResetLink(email, {
      url: continueUrl,
      handleCodeInApp: false,
    })
  } catch (err) {
    console.error('[reset-password] generate link failed', err)
    return {
      status: 502,
      body: {
        error:
          'Could not create reset link. Is Email/Password enabled in Firebase Auth?',
      },
    }
  }

  const from = process.env.RESEND_FROM ?? 'LUCE <onboarding@resend.dev>'
  const resend = new Resend(apiKey)
  const safeEmail = escapeHtml(email)

  const sent = await resend.emails.send({
    from,
    to: [email],
    subject: 'Reset your LUCE password',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#1a1428;max-width:520px">
        <h1 style="font-size:22px;margin:0 0 12px">Reset your password</h1>
        <p>We received a request to reset the password for <strong>${safeEmail}</strong>.</p>
        <p style="margin:24px 0">
          <a href="${link}"
             style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">
            Reset password
          </a>
        </p>
        <p style="color:#656570;font-size:14px">This link expires soon. If you did not ask for a reset, you can ignore this email.</p>
        <p style="color:#6d28d9;font-weight:700;margin-top:28px">LUCE</p>
      </div>
    `,
    tags: [{ name: 'category', value: 'password_reset' }],
  })

  if (sent.error) {
    console.error('[reset-password] resend failed', sent.error)
    return {
      status: 502,
      body: {
        error: sent.error.message || 'Failed to send reset email via Resend',
      },
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      via: 'resend',
      id: sent.data?.id ?? null,
      ...(googleOnly ? { googleOnly: true } : {}),
    },
  }
}
