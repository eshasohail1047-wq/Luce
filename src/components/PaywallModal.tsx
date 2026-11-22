import { useState } from 'react'
import { Link } from 'react-router-dom'
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

const BILLING_MAIL =
  'mailto:hello@luce.app?subject=LUCE%20plan%20upgrade&body=Hi%20LUCE%20team%2C%0A%0AI%20want%20to%20upgrade%20my%20plan.%0A%0AThanks'

export default function PaywallModal({
  open,
  title = 'Upgrade to continue',
  reason,
  onClose,
}: PaywallModalProps) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [picked, setPicked] = useState<PaidPlanId | null>(null)

  if (!open) return null

  const paidPlans = PLAN_OPTIONS.filter((p) => p.id !== 'free')

  return (
    <div className="paywall-overlay" role="dialog" aria-modal="true" aria-labelledby="paywall-title">
      <button type="button" className="paywall-backdrop" aria-label="Close" onClick={onClose} />
      <div className="paywall-sheet">
        <div className="paywall-head">
          <p className="paywall-kicker">Paid feature</p>
          <h2 id="paywall-title">{title}</h2>
          <p className="paywall-copy">{reason || PRO_UPGRADE_COPY}</p>
          <p className="paywall-note">
            Free includes 1 image trial. Paid plans refill credits monthly — Starter from $9.
            Checkout activates your plan after payment (no self-upgrade).
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
            const selected = picked === id
            return (
              <article
                key={plan.id}
                className={`paywall-plan${plan.featured ? ' is-featured' : ''}${selected ? ' is-selected' : ''}`}
              >
                {plan.featured ? <span className="paywall-plan-badge">Popular</span> : null}
                <h3>{plan.name}</h3>
                <p className="paywall-plan-tagline">{plan.tagline}</p>
                <p className="paywall-plan-price">
                  <strong>${price}</strong>
                  <span>/ month</span>
                </p>
                <p className="paywall-plan-credits">{plan.credits} credits / month</p>
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
                  onClick={() => setPicked(id)}
                >
                  {selected ? `Selected ${plan.name}` : `Choose ${plan.name}`}
                </button>
              </article>
            )
          })}
        </div>

        <p className="paywall-checkout-note" role="status">
          {picked
            ? `You selected ${PLAN_OPTIONS.find((p) => p.id === picked)?.name}. Payment checkout is next — email us to activate, or open Plans.`
            : 'Pick a plan, then request activation. Card checkout ships with the payment provider.'}
        </p>

        <div className="paywall-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Not now
          </button>
          <a className="btn btn-grad" href={BILLING_MAIL}>
            Request upgrade
          </a>
          <Link className="btn btn-ghost" to="/app/plans" onClick={onClose}>
            View plans
          </Link>
        </div>
      </div>
    </div>
  )
}
