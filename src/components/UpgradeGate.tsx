import { Link } from 'react-router-dom'
import { PRO_UPGRADE_COPY } from '../lib/planAccess'

type UpgradeGateProps = {
  title: string
  feature: string
}

export default function UpgradeGate({ title, feature }: UpgradeGateProps) {
  return (
    <main className="dash dash-simple upgrade-gate">
      <div className="upgrade-gate-card">
        <p className="upgrade-gate-kicker">Pro feature</p>
        <h1>{title}</h1>
        <p>
          <strong>{feature}</strong> is included on Pro. {PRO_UPGRADE_COPY}
        </p>
        <div className="upgrade-gate-actions">
          <Link className="dash-create-btn" to="/app/settings#plan">
            Upgrade to Pro
          </Link>
          <Link className="dash-create-btn dash-create-btn-ghost" to="/app/studio/photos">
            Continue with free images
          </Link>
        </div>
      </div>
    </main>
  )
}
