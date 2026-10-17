import {
  createResend,
  EMAIL_RE,
  emailShell,
  escapeHtml,
  getAppUrl,
  getResendFrom,
} from './resendClient'

export type TransactionalType =
  | 'welcome'
  | 'plan_upgraded'
  | 'pack_ready'
  | 'pack_exported'

export type TransactionalResult =
  | { status: 200; body: { ok: true; id: string | null; skipped?: boolean } }
  | { status: number; body: { ok?: false; error: string } }

type TransactionalInput = {
  type: TransactionalType
  email: string
  name?: string
  planName?: string
  productName?: string
  campaignUrl?: string
}

function cta(href: string, label: string) {
  return `
    <p style="margin:24px 0">
      <a href="${href}"
         style="display:inline-block;background:#6d28d9;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700">
        ${label}
      </a>
    </p>
  `
}

function buildMessage(input: TransactionalInput) {
  const appUrl = getAppUrl()
  const name = escapeHtml((input.name || '').trim() || 'there')
  const product = escapeHtml((input.productName || '').trim() || 'your product')
  const plan = escapeHtml((input.planName || '').trim() || 'paid')
  const campaignUrl = escapeHtml(
    (input.campaignUrl || '').trim() || `${appUrl}/app`,
  )
  const studioUrl = `${appUrl}/app/studio/photos`
  const settingsUrl = `${appUrl}/app/settings#plan`

  switch (input.type) {
    case 'welcome':
      return {
        subject: 'Welcome to LUCE — your free image try is ready',
        html: emailShell(
          `Welcome, ${name}`,
          `
            <p>You’re in. LUCE turns one real product into campaign-ready creatives.</p>
            <p><strong>On Free:</strong> explore every studio, then generate one image pack at no cost.</p>
            <p>Video, ads, full campaigns, and extra images unlock when you upgrade.</p>
            ${cta(studioUrl, 'Start your free image try')}
            <p style="color:#656570;font-size:14px">Tip: upload a clear product photo so packaging stays true across every still.</p>
          `,
        ),
        idempotencyKey: `welcome/${input.email}`,
      }
    case 'plan_upgraded':
      return {
        subject: `You’re on LUCE ${plan}`,
        html: emailShell(
          `${plan} is active`,
          `
            <p>Hi ${name} — thanks for upgrading. You can now generate images, video, ads, and full campaigns.</p>
            ${cta(`${appUrl}/app`, 'Open your workspace')}
            <p style="color:#656570;font-size:14px">Manage billing anytime in <a href="${settingsUrl}">Settings → Plan</a>.</p>
          `,
        ),
        idempotencyKey: `plan/${input.email}/${plan}/${new Date().toISOString().slice(0, 10)}`,
      }
    case 'pack_ready':
      return {
        subject: `Your ${product} pack is ready`,
        html: emailShell(
          'Your creatives are ready',
          `
            <p>Hi ${name} — the demo pack for <strong>${product}</strong> finished generating.</p>
            <p>Preview each asset, recreate anything you want, then export when you’re happy.</p>
            ${cta(campaignUrl, 'Review pack')}
          `,
        ),
        idempotencyKey: `pack-ready/${input.email}/${product}/${Date.now()}`,
      }
    case 'pack_exported':
      return {
        subject: `Export started for ${product}`,
        html: emailShell(
          'Export on the way',
          `
            <p>Hi ${name} — your export for <strong>${product}</strong> has started.</p>
            <p>Check your downloads for the pack files. You can reopen the project anytime from Library.</p>
            ${cta(campaignUrl, 'Open project')}
          `,
        ),
        idempotencyKey: `pack-exported/${input.email}/${product}/${Date.now()}`,
      }
    default:
      return null
  }
}

export async function sendTransactionalEmail(
  input: TransactionalInput,
): Promise<TransactionalResult> {
  const resend = createResend()
  if (!resend) {
    return {
      status: 501,
      body: {
        error: 'Resend is not configured. Add a real RESEND_API_KEY.',
      },
    }
  }

  const email = String(input.email ?? '')
    .trim()
    .toLowerCase()
  if (!EMAIL_RE.test(email)) {
    return { status: 400, body: { error: 'Enter a valid email address' } }
  }

  const message = buildMessage({ ...input, email })
  if (!message) {
    return { status: 400, body: { error: 'Unknown email type' } }
  }

  const sent = await resend.emails.send({
    from: getResendFrom(),
    to: [email],
    subject: message.subject,
    html: message.html,
    tags: [{ name: 'category', value: input.type }],
    idempotencyKey: message.idempotencyKey.slice(0, 256),
  })

  if (sent.error) {
    console.error(`[transactional] ${input.type} failed`, sent.error)
    return {
      status: 502,
      body: { error: sent.error.message || 'Failed to send email via Resend' },
    }
  }

  return {
    status: 200,
    body: { ok: true, id: sent.data?.id ?? null },
  }
}
