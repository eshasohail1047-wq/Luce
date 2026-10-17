import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import {
  PLAN_OPTIONS,
  type PaidPlanId,
  type UserPlan,
} from '../lib/plans'
import { PRO_UPGRADE_COPY } from '../lib/planAccess'

type PaywallModalProps = {
  open: boolean
  title?: string
  reason?: string
  onClose: () => void
  onUpgraded?: (plan: UserPlan) => void
}

export default function PaywallModal({
  open,
  title = 'Upgrade to continue',
  reason,
  onClose,
  onUpgraded,
}: PaywallModalProps) {
  const { updatePlan } = useAuth()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [busy, setBusy] = useState<PaidPlanId | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!open) return null

  const paidPlans = PLAN_OPTIONS.filter((p) => p.id !== 'free')

  async function choosePlan(planId: PaidPlanId) {
    setBusy(planId)
    setError(null)
    try {
      await updatePlan(planId)
      onUpgraded?.(planId)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update plan.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="paywall-overlay" role="dialog" aria-modal="true" aria-labelledby="paywall-title">
      <button type="button" className="paywall-backdrop" aria-label="Close" onClick={onClose} />
      <div className="paywall-sheet">
        <div className="paywall-head">
          <p className="paywall-kicker">Paid feature</p>
          <h2 id="paywall-title">{title}</h2>
          <p className="paywall-copy">{reason || PRO_UPGRADE_COPY}</p>
          <p className="paywall-note">
            You can explore the full workflow on Free. Generating video, ads, campaigns, or extra
            images requires a plan.
          </p>
        </div>

        <div className="paywall-billing" role="group" aria-label="Billing period">
          <button
            type="button"
            className={billing === 'monthly' ? 'is-active' : ''}
            onClick={() => setBilling('monthly')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={billing === 'yearly' ? 'is-active' : ''}
            onClick={() => setBilling('yearly')}
          >
            Yearly
          </button>
        </div>

        <div className="paywall-plans">
          {paidPlans.map((plan) => {
            const price = billing === 'monthly' ? plan.monthly : plan.yearly
            const id = plan.id as PaidPlanId
            return (
              <article
                key={plan.id}
                className={`paywall-plan${plan.featured ? ' is-featured' : ''}`}
              >
                {plan.featured ? <span className="paywall-plan-badge">Popular</span> : null}
                <h3>{plan.name}</h3>
                <p className="paywall-plan-tagline">{plan.tagline}</p>
                <p className="paywall-plan-price">
                  <strong>${price}</strong>
                  <span>/ month</span>
                </p>
                {billing === 'yearly' ? (
                  <p className="paywall-plan-billed">Billed yearly</p>
                ) : null}
                <ul>
                  {plan.perks.slice(0, 4).map((perk) => (
                    <li key={perk}>{perk}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`btn ${plan.featured ? 'btn-grad' : 'btn-ghost'}`}
                  disabled={Boolean(busy)}
                  onClick={() => void choosePlan(id)}
                >
                  {busy === id ? 'Activating…' : `Choose ${plan.name}`}
                </button>
              </article>
            )
          })}
        </div>

        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="paywall-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Keep browsing
          </button>
          <Link className="paywall-link" to="/app/studio/photos" onClick={onClose}>
            Use free image try
          </Link>
        </div>
      </div>
    </div>
  )
}
