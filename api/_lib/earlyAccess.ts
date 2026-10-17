import {
  createResend,
  EMAIL_RE,
  escapeHtml,
  getResendFrom,
} from './resendClient'

export type EarlyAccessResult =
  | { status: 200; body: { ok: true; id: string | null } }
  | { status: number; body: { ok?: false; error: string } }

export async function sendEarlyAccessEmail(input: {
  email: string
  productUrl?: string
  source?: string
}): Promise<EarlyAccessResult> {
  const resend = createResend()
  if (!resend) {
    return {
      status: 500,
      body: { error: 'RESEND_API_KEY is not configured' },
    }
  }

  const email = String(input.email ?? '')
    .trim()
    .toLowerCase()
  const productUrl = String(input.productUrl ?? '').trim()
  const source = String(input.source ?? 'landing').trim()

  if (!EMAIL_RE.test(email)) {
    return { status: 400, body: { error: 'Enter a valid email address' } }
  }

  const from = getResendFrom()
  const notifyTo = process.env.EARLY_ACCESS_NOTIFY_EMAIL
  const safeEmail = escapeHtml(email)
  const safeUrl = escapeHtml(productUrl || 'Not provided')
  const safeSource = escapeHtml(source)

  const welcome = await resend.emails.send({
    from,
    to: [email],
    subject: 'Welcome to LUCE — your product, to light',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1a1428">
        <h1 style="font-size:22px;margin:0 0 12px">Welcome to LUCE</h1>
        <p>Thanks for joining early access. We’re building research-backed campaigns from one real product.</p>
        <p><strong>Your product link:</strong> ${safeUrl}</p>
        <p style="margin-top:20px">We’ll email you when your first campaign workspace is ready.</p>
        <p style="color:#6d28d9;font-weight:700">LUCE — Bring Your Product to Light.</p>
      </div>
    `,
    tags: [
      { name: 'category', value: 'early_access' },
      { name: 'source', value: source.slice(0, 64) },
    ],
    idempotencyKey: `early-access/${email}/${new Date().toISOString().slice(0, 10)}`,
  })

  if (welcome.error) {
    console.error('[resend] welcome failed', welcome.error)
    return {
      status: 502,
      body: { error: welcome.error.message || 'Failed to send email' },
    }
  }

  if (
    notifyTo &&
    EMAIL_RE.test(notifyTo) &&
    !notifyTo.includes('example.com') &&
    notifyTo !== email
  ) {
    const notify = await resend.emails.send({
      from,
      to: [notifyTo],
      subject: `LUCE early access: ${email}`,
      html: `
        <p><strong>New early access signup</strong></p>
        <p>Email: ${safeEmail}</p>
        <p>Product URL: ${safeUrl}</p>
        <p>Source: ${safeSource}</p>
      `,
      tags: [{ name: 'category', value: 'early_access_notify' }],
    })

    if (notify.error) {
      console.error('[resend] notify failed', notify.error)
    }
  }

  return { status: 200, body: { ok: true, id: welcome.data?.id ?? null } }
}
