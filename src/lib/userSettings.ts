import { updateProfile, type User } from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { requireDb } from './firebase'
import { normalizeUserPlan, type UserPlan } from './plans'

export type { UserPlan } from './plans'

export type WorkspaceSettings = {
  brandName: string
  brandTone: string
  notifyExports: boolean
}

export const DEFAULT_WORKSPACE: WorkspaceSettings = {
  brandName: '',
  brandTone: 'premium',
  notifyExports: true,
}

export const BRAND_TONE_OPTIONS = [
  { id: 'premium', label: 'Premium / refined' },
  { id: 'playful', label: 'Playful / bold' },
  { id: 'minimal', label: 'Minimal / clean' },
  { id: 'clinical', label: 'Clinical / trusted' },
] as const

export async function loadUserSettings(userId: string): Promise<{
  plan: UserPlan
  freeImageUsed: boolean
  workspace: WorkspaceSettings
}> {
  const snap = await getDoc(doc(requireDb(), 'users', userId))
  const data = snap.data() || {}
  return {
    plan: normalizeUserPlan(data.plan),
    freeImageUsed: Boolean(data.freeImageUsed),
    workspace: {
      brandName: typeof data.brandName === 'string' ? data.brandName : '',
      brandTone: typeof data.brandTone === 'string' ? data.brandTone : DEFAULT_WORKSPACE.brandTone,
      notifyExports:
        typeof data.notifyExports === 'boolean'
          ? data.notifyExports
          : DEFAULT_WORKSPACE.notifyExports,
    },
  }
}

export async function saveDisplayName(user: User, name: string) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Enter a display name.')
  await updateProfile(user, { displayName: trimmed })
  await setDoc(
    doc(requireDb(), 'users', user.uid),
    {
      displayName: trimmed,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function saveUserPlan(userId: string, plan: UserPlan) {
  await setDoc(
    doc(requireDb(), 'users', userId),
    {
      plan,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function markFreeImageUsed(userId: string) {
  await setDoc(
    doc(requireDb(), 'users', userId),
    {
      freeImageUsed: true,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}

export async function saveWorkspaceSettings(
  userId: string,
  workspace: Partial<WorkspaceSettings>,
) {
  await setDoc(
    doc(requireDb(), 'users', userId),
    {
      ...workspace,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  )
}
