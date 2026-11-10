import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../../Logo'
import { useAuth } from '../../auth/AuthProvider'
import {
  ONBOARDING_GROUPS,
  ONBOARDING_STEPS,
  groupForStep,
  stepNumber,
  type OnboardingStepId,
} from '../../lib/onboarding'

type OnboardingLayoutProps = {
  step: OnboardingStepId
  children: ReactNode
  footerLeft?: ReactNode
  footerRight?: ReactNode
  hideFooter?: boolean
  onSaveExit?: () => void
  savingExit?: boolean
}

export default function OnboardingLayout({
  step,
  children,
  footerLeft,
  footerRight,
  hideFooter,
  onSaveExit,
  savingExit,
}: OnboardingLayoutProps) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const n = stepNumber(step)
  const total = ONBOARDING_STEPS.length
  const progress = (n / total) * 100
  const currentGroup = groupForStep(step)
  const groupIndex = ONBOARDING_GROUPS.findIndex((g) => g.id === currentGroup.id)

  return (
    <div className="ob-shell">
      <header className="ob-top">
        <Logo href="/" />
        <nav className="ob-groups" aria-label="Onboarding progress">
          {ONBOARDING_GROUPS.map((group, i) => {
            const done = i < groupIndex
            const active = i === groupIndex
            return (
              <div key={group.id} className="ob-group-wrap">
                {i > 0 ? (
                  <span
                    className={`ob-group-line${i <= groupIndex ? ' is-done' : ''}`}
                    aria-hidden="true"
                  />
                ) : null}
                <span
                  className={`ob-group${active ? ' is-active' : ''}${done ? ' is-done' : ''}`}
                >
                  <em aria-hidden="true">{done ? '✓' : i + 1}</em>
                  {group.label}
                </span>
              </div>
            )
          })}
        </nav>
        <div className="ob-top-actions">
          <span className="ob-meta">
            Step {n} of {total}
          </span>
          {onSaveExit ? (
            <button
              type="button"
              className="ob-skip"
              onClick={onSaveExit}
              disabled={savingExit}
            >
              {savingExit ? 'Saving…' : 'Save and exit'}
            </button>
          ) : null}
          <button
            type="button"
            className="ob-signout"
            onClick={async () => {
              await signOut()
              navigate('/login', { replace: true })
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="ob-progress" aria-hidden="true">
        <i style={{ width: `${progress}%` }} />
      </div>

      <main className="ob-main">{children}</main>

      {!hideFooter ? (
        <footer className="ob-footer">
          <div className="ob-footer-inner">
            <div className="ob-footer-left">{footerLeft}</div>
            <div className="ob-footer-right">{footerRight}</div>
          </div>
        </footer>
      ) : null}
    </div>
  )
}
