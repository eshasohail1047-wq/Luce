import { Link, Navigate, useLocation } from 'react-router-dom'
import AppLayout from '../components/AppLayout'
import { useAuth } from '../auth/AuthProvider'

const COPY: Record<string, { title: string; body: string; cta?: { to: string; label: string } }> = {
  '/app/products': {
    title: 'Products',
    body: 'Your product library will live here. Start by adding a product to a campaign.',
    cta: { to: '/app/campaigns/new', label: 'Add product' },
  },
  '/app/campaigns': {
    title: 'Campaigns',
    body: 'All of your campaigns in one place. Create a new one anytime from the dashboard.',
    cta: { to: '/app/campaigns/new', label: 'Create campaign' },
  },
  '/app/library': {
    title: 'Library',
    body: 'Saved assets, exports, and regenerations will appear here.',
  },
  '/app/settings': {
    title: 'Settings',
    body: 'Workspace preferences, brand defaults, and account settings are coming soon.',
  },
}

export default function WorkspaceStubPage() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const page = COPY[pathname] || {
    title: 'Workspace',
    body: 'This section is coming soon.',
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
      <main className="dash dash-stub">
        <header className="dash-hero">
          <div className="dash-hero-copy">
            <h1>{page.title}</h1>
            <p>{page.body}</p>
          </div>
          {page.cta ? (
            <Link className="dash-create-btn" to={page.cta.to}>
              {page.cta.label}
            </Link>
          ) : (
            <Link className="dash-create-btn dash-create-btn-ghost" to="/app">
              ← Back to dashboard
            </Link>
          )}
        </header>
      </main>
    </AppLayout>
  )
}
