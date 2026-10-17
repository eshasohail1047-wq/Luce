import { Resend } from 'resend'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

export function getResendApiKey() {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey || apiKey.includes('xxxxxxxxx')) return null
  return apiKey
}

export function getResendFrom() {
  return process.env.RESEND_FROM ?? 'LUCE <onboarding@resend.dev>'
}

export function getAppUrl() {
  return (
    process.env.VITE_APP_URL ||
    process.env.PASSWORD_RESET_CONTINUE_URL?.replace(/\/login\/?$/, '') ||
    'http://localhost:5176'
  ).replace(/\/$/, '')
}

export function createResend() {
  const apiKey = getResendApiKey()
  if (!apiKey) return null
  return new Resend(apiKey)
}

export function emailShell(title: string, bodyHtml: string) {
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.55;color:#1a1428;max-width:560px;margin:0 auto;padding:8px">
      <p style="margin:0 0 18px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;font-weight:800;color:#6d28d9">LUCE</p>
      <h1 style="font-size:22px;margin:0 0 12px;color:#17171f">${title}</h1>
      ${bodyHtml}
      <p style="color:#6d28d9;font-weight:700;margin-top:28px">LUCE — Bring your product to light.</p>
    </div>
  `
}
