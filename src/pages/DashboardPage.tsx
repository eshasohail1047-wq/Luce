import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CreativeShowcase from '../components/CreativeShowcase'
import { useAuth } from '../auth/AuthProvider'

type StartSource = 'upload' | 'url' | null

const DESTINATIONS = [
  { to: '/app/studio/photos', title: 'Images' },
  { to: '/app/studio/videos', title: 'Videos' },
  { to: '/app/campaigns/new', title: 'Full Campaign' },
]

function destinationHref(base: string, source: StartSource) {
  if (!source) return base
  const join = base.includes('?') ? '&' : '?'
  return `${base}${join}source=${source}`
}

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const firstName =
    user?.displayName?.trim()?.split(/\s+/)[0] ||
    user?.email?.split('@')[0] ||
    'there'

  const [startSource, setStartSource] = useState<StartSource>(null)

  if (loading) {
    return (
      <div className="studio-shell studio-shell-alone">
        <p className="app-loading">Loading…</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  const choosing = startSource !== null

  return (
    <AppLayout>
      <main className="dash dash-home">
        <section className="dash-home-hero" aria-labelledby="dash-hero-title">
          <h1 id="dash-hero-title" className="dash-home-title">
            Create <em>your creatives</em>
            {firstName !== 'there' ? `, ${firstName}` : ''}
          </h1>

          <div className="dash-home-composer" data-open={choosing ? 'true' : 'false'}>
            <div className="dash-home-entry" role="group" aria-label="How to start">
              <button
                type="button"
                className={`dash-home-entry-btn${startSource === 'upload' ? ' is-active' : ''}`}
                aria-pressed={startSource === 'upload'}
                onClick={() => setStartSource((s) => (s === 'upload' ? null : 'upload'))}
              >
                <span className="dash-home-entry-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path
                      d="M12 16V8m0 0 3 3m-3-3-3 3M5 19h14a2 2 0 0 0 2-2V9.5A2.5 2.5 0 0 0 18.5 7H16l-1.5-2h-5L8 7H5.5A2.5 2.5 0 0 0 3 9.5V17a2 2 0 0 0 2 2Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <strong>Upload product</strong>
              </button>

              <span className="dash-home-or">or</span>

              <button
                type="button"
                className={`dash-home-entry-btn${startSource === 'url' ? ' is-active' : ''}`}
                aria-pressed={startSource === 'url'}
                onClick={() => setStartSource((s) => (s === 'url' ? null : 'url'))}
              >
                <span className="dash-home-entry-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                    <path
                      d="M10 13a5 5 0 0 0 7.07 0l2.12-2.12a5 5 0 0 0-7.07-7.07L11 5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                    <path
                      d="M14 11a5 5 0 0 0-7.07 0L4.8 13.12a5 5 0 0 0 7.07 7.07L13 19"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <strong>Paste URL</strong>
              </button>
            </div>

            {choosing ? (
              <div className="dash-home-dest" role="region" aria-label="Choose what to create">
                <div className="dash-home-dest-head">
                  <strong>Choose a studio</strong>
                  <button
                    type="button"
                    className="dash-home-dest-close"
                    onClick={() => setStartSource(null)}
                  >
                    Cancel
                  </button>
                </div>
                <div className="dash-home-dest-grid">
                  {DESTINATIONS.map((dest) => (
                    <Link
                      key={dest.to}
                      to={destinationHref(dest.to, startSource)}
                      className="dash-home-dest-card"
                    >
                      <strong>{dest.title}</strong>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <CreativeShowcase />
      </main>
    </AppLayout>
  )
}
