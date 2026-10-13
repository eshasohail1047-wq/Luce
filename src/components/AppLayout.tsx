import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Logo from '../Logo'
import { useAuth } from '../auth/AuthProvider'

const NAV = [
  { to: '/app', label: 'Home', end: true },
  { to: '/app/campaigns/new', label: 'Campaign', end: false },
  { to: '/app/studio/photos', label: 'Photos', end: false },
  { to: '/app/studio/videos', label: 'Videos', end: false },
  { to: '/app/studio/ads', label: 'Ads', end: false },
] as const

type AppLayoutProps = {
  children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth()
  const firstName = user?.displayName?.split(' ')[0]
  const initial = (firstName || user?.email?.[0] || 'U').slice(0, 1).toUpperCase()

  return (
    <div className="studio-shell">
      <aside className="studio-rail">
        <Link to="/app" className="studio-rail-brand" aria-label="LUCE home">
          <Logo href={null} />
        </Link>

        <nav className="studio-rail-nav" aria-label="Studio">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `studio-rail-link${isActive ? ' is-active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="studio-rail-footer">
          <div className="studio-rail-user">
            <span className="app-user-avatar" aria-hidden="true">
              {initial}
            </span>
            <div className="studio-rail-user-meta">
              <strong>{firstName || 'Account'}</strong>
              <button type="button" onClick={() => signOut()}>
                Log out
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="studio-stage">{children}</div>
    </div>
  )
}
