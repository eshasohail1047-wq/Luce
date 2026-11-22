/** Platform owner — full Pro access without checkout. */
export const OWNER_EMAIL = 'eshasohail1047@gmail.com'

export function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase()
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return normalizeEmail(email) === OWNER_EMAIL
}

export const OWNER_PLAN = 'pro' as const
