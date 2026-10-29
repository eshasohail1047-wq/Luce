import { Link, Navigate } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import CreativeShowcase from '../components/CreativeShowcase'
import { useAuth } from '../auth/AuthProvider'

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const firstName =
    user?.displayName?.trim()?.split(/\s+/)[0] ||
    user?.email?.split('@')[0] ||
    'there'

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

  return (
    <AppLayout>
      <main className="dash dash-creatify">
        <section className="dash-creatify-top" aria-labelledby="dash-hero-title">
          <h1 id="dash-hero-title" className="dash-creatify-title">
            Create <mark>your creatives</mark>
            {firstName !== 'there' ? `, ${firstName}` : ''}
          </h1>

          <div className="dash-creatify-composer">
            <div className="dash-creatify-composer-bar">
              <Link className="dash-creatify-action" to="/app/studio/photos">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                  <path
                    d="M12 16V8m0 0 3 3m-3-3-3 3M5 19h14a2 2 0 0 0 2-2V9.5A2.5 2.5 0 0 0 18.5 7H16l-1.5-2h-5L8 7H5.5A2.5 2.5 0 0 0 3 9.5V17a2 2 0 0 0 2 2Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Upload product
              </Link>
              <Link className="dash-creatify-action" to="/app/studio/photos?source=url">
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
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
                Paste URL
              </Link>
              <div className="dash-creatify-composer-spacer" />
              <Link
                className="dash-creatify-send"
                to="/app/studio/photos"
                aria-label="Start in Image Studio"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
                  <path
                    d="M12 19V5m0 0 5 5M12 5l-5 5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
            </div>
          </div>
        </section>

        <CreativeShowcase />
      </main>
    </AppLayout>
  )
}
