import { useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'
import { CONTENT_MIX_TYPES, CREDIT_COSTS } from '../config/credits'
import {
  PLAN_OPTIONS,
  isPaidPlan,
  planLabel as formatPlanLabel,
  type UserPlan,
} from '../lib/plans'

const PLAN_CREDITS: Record<UserPlan, number> = {
  free: 20,
  starter: 120,
  growth: 300,
  pro: 800,
}

export default function PlansCreditsPage() {
  const { user, loading, plan, updatePlan } = useAuth()
  const [yearly, setYearly] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const allotment = PLAN_CREDITS[plan] || 20
  // Demo usage split until real metering ships
  const used = useMemo(() => {
    if (plan === 'free') return Math.min(6, allotment)
    if (plan === 'starter') return Math.min(48, allotment)
    if (plan === 'growth') return Math.min(146, allotment)
    return Math.min(220, allotment)
  }, [plan, allotment])
  const left = Math.max(0, allotment - used)
  const videos = Math.round(used * 0.45)
  const images = Math.round(used * 0.37)
  const copy = Math.max(0, used - videos - images)
  const pct = allotment ? Math.round((used / allotment) * 100) : 0

  async function onChangePlan(next: UserPlan) {
    setBusy(true)
    setMsg(null)
    try {
      await updatePlan(next)
      setMsg(
        next === plan
          ? null
          : next === 'free'
            ? 'Moved to Free plan'
            : `Switched to ${formatPlanLabel(next)}`,
      )
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Could not update plan.')
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
            <p>Credits this cycle and your subscription.</p>
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
              {isPaidPlan(plan) ? '' : ' · Upgrade to unlock video and campaign packs'}
            </p>
          </section>

          <section className="plans-addon-card">
            <h2>Need more this month?</h2>
            <p>Add-on packs top up without changing your plan.</p>
            <div className="plans-addon-options">
              <button type="button" className="plans-addon-chip" disabled>
                100 credits
              </button>
              <button type="button" className="plans-addon-chip" disabled>
                500 credits
              </button>
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
                Yearly — save 20%
              </button>
            </div>
          </div>

          <div className="plans-grid">
            {PLAN_OPTIONS.map((option) => {
              const active = plan === option.id
              const price = yearly ? option.yearly : option.monthly
              const credits = PLAN_CREDITS[option.id]
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
                  <p className="plans-card-credits">{credits} credits / month</p>
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
          <ul>
            <li>
              <span>Product image, per variation</span>
              <strong>{CREDIT_COSTS.productImage} credits</strong>
            </li>
            <li>
              <span>Carousel, 5 slides with copy</span>
              <strong>{CREDIT_COSTS.carousel} credits</strong>
            </li>
            <li>
              <span>ASMR or cinematic video (up to 15s)</span>
              <strong>{CREDIT_COSTS.sprayAsmr} credits</strong>
            </li>
            <li>
              <span>UGC or GRWM video with AI creator (20s)</span>
              <strong>{CREDIT_COSTS.ugcSelfie} credits</strong>
            </li>
            {CONTENT_MIX_TYPES.filter((row) =>
              ['aiTestimonial', 'hookCopy'].includes(row.id),
            ).map((row) => (
              <li key={row.id}>
                <span>{row.name}</span>
                <strong>{row.credits} credits</strong>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </AppLayout>
  )
}
