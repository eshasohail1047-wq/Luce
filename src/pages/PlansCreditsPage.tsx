import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import { CREDIT_ADDONS, CREDIT_COSTS, videoCreditsForDuration } from '../config/credits'
import {
  PLAN_OPTIONS,
  isPaidPlan,
  planCredits,
  planLabel as formatPlanLabel,
  type UserPlan,
} from '../lib/plans'

export default function PlansCreditsPage() {
  const { user, loading, plan } = useAuth()
  const [yearly, setYearly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const allotment = planCredits(plan)
  // Demo usage split until real metering ships
  const used = useMemo(() => {
    if (plan === 'free') return Math.min(4, allotment)
    if (plan === 'starter') return Math.min(28, allotment)
    if (plan === 'growth') return Math.min(96, allotment)
    return Math.min(180, allotment)
  }, [plan, allotment])
  const left = Math.max(0, allotment - used)
  const videos = Math.round(used * 0.35)
  const images = Math.round(used * 0.5)
  const copy = Math.max(0, used - videos - images)
  const pct = allotment ? Math.round((used / allotment) * 100) : 0

  async function onChangePlan(next: UserPlan) {
    setBusy(true)
    setMsg(null)
    try {
      if (next === plan) {
        setMsg(null)
        return
      }
      // Clients cannot self-upgrade — paid plan is activated after purchase / admin.
      if (next !== 'free') {
        setMsg(
          `To switch to ${formatPlanLabel(next)}, complete checkout or email hello@luce.app — plans are activated after payment.`,
        )
        return
      }
      setMsg('Stay on Free, or email hello@luce.app if you need your paid plan adjusted.')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="studio-shell studio-shell-alone">
        <p className="app-loading">Loading…</p>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />

  return (
    <AppLayout>
      <main className="plans-page">
        <header className="plans-top">
          <div>
            <h1>Plans and credits</h1>
            <p>1 credit = 1 image. Videos cost more by length. Plans refill monthly.</p>
          </div>
          <div className="plans-top-actions">
            <Link to="/app/settings#plan" className="brand-kit-ghost">
              Billing history
            </Link>
            <Link to="/app/settings#plan" className="brand-kit-ghost">
              Manage payment
            </Link>
          </div>
        </header>

        <div className="plans-hero-grid">
          <section className="plans-credits-card">
            <div className="plans-credits-head">
              <h2>
                {left} of {allotment} left
              </h2>
              <span>Renews next month</span>
            </div>
            <div className="plans-credits-bar" aria-hidden="true">
              <i style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="plans-credits-split">
              <span>Videos ({videos})</span>
              <span>Images ({images})</span>
              <span>Copy and edits ({copy})</span>
            </div>
            <p className="plans-credits-note">
              Current plan: <strong>{formatPlanLabel(plan)}</strong>
              {isPaidPlan(plan) ? '' : ' · Upgrade for more credits + video'}
            </p>
          </section>

          <section className="plans-addon-card">
            <h2>Need more this month?</h2>
            <p>Add-on packs top up without changing your plan.</p>
            <div className="plans-addon-options">
              {CREDIT_ADDONS.map((pack) => (
                <button key={pack.credits} type="button" className="plans-addon-chip" disabled>
                  {pack.label} · ${pack.price}
                </button>
              ))}
            </div>
            <button type="button" className="brand-kit-cta" disabled title="Coming soon">
              Add credits
            </button>
            <p className="plans-addon-soon">Add-on checkout ships with payment provider.</p>
          </section>
        </div>

        <section className="plans-grid-wrap">
          <div className="plans-grid-head">
            <h2>Choose a plan</h2>
            <div className="ob-plan-billing" role="group" aria-label="Billing period">
              <button
                type="button"
                className={!yearly ? 'is-active' : undefined}
                onClick={() => setYearly(false)}
              >
                Monthly
              </button>
              <button
                type="button"
                className={yearly ? 'is-active' : undefined}
                onClick={() => setYearly(true)}
              >
                Yearly — save ~20%
              </button>
            </div>
          </div>

          <div className="plans-grid">
            {PLAN_OPTIONS.map((option) => {
              const active = plan === option.id
              const price = yearly ? option.yearly : option.monthly
              return (
                <article
                  key={option.id}
                  className={`plans-card${active ? ' is-current' : ''}${option.featured ? ' is-featured' : ''}`}
                >
                  <div className="plans-card-top">
                    <h3>{option.name}</h3>
                    {active ? <em>Current</em> : option.featured ? <em>Best value</em> : null}
                  </div>
                  <p className="plans-card-price">
                    {option.monthly === 0 ? (
                      <strong>$0</strong>
                    ) : (
                      <>
                        <strong>${price}</strong>
                        <span>/{yearly ? 'mo billed yearly' : 'mo'}</span>
                      </>
                    )}
                  </p>
                  <p className="plans-card-credits">{option.credits} credits / month</p>
                  <ul>
                    {option.perks.map((perk) => (
                      <li key={perk}>{perk}</li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={active ? 'brand-kit-ghost' : 'brand-kit-cta'}
                    disabled={busy || active}
                    onClick={() => void onChangePlan(option.id)}
                  >
                    {busy
                      ? 'Updating…'
                      : active
                        ? 'Current plan'
                        : option.id === 'free'
                          ? 'Downgrade'
                          : `Switch to ${option.name}`}
                  </button>
                </article>
              )
            })}
          </div>
          {msg ? (
            <p className="settings-success" role="status">
              {msg}
            </p>
          ) : null}
        </section>

        <section className="plans-costs">
          <h2>What things cost</h2>
          <p className="plans-costs-note">
            Credits cover Image Studio, Video Studio, and Full Campaign (images + videos).
          </p>
          <ul>
            <li>
              <span>Product image, per variation</span>
              <strong>{CREDIT_COSTS.productImage} credit</strong>
            </li>
            <li>
              <span>Video · 5s</span>
              <strong>{videoCreditsForDuration(5)} credits</strong>
            </li>
            <li>
              <span>Video · 10s</span>
              <strong>{videoCreditsForDuration(10)} credits</strong>
            </li>
            <li>
              <span>Video · 15s</span>
              <strong>{videoCreditsForDuration(15)} credits</strong>
            </li>
            <li>
              <span>UGC / GRWM creator video</span>
              <strong>{CREDIT_COSTS.ugcSelfie} credits</strong>
            </li>
          </ul>
        </section>
      </main>
    </AppLayout>
  )
}
