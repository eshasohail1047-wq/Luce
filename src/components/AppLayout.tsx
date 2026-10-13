import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Logo from '../Logo'
import { useAuth } from '../auth/AuthProvider'

const NAV = [
  { to: '/app', label: 'Dashboard', end: true, icon: 'home' },
  { to: '/app/products', label: 'Products', end: false, icon: 'box' },
  { to: '/app/campaigns', label: 'Campaigns', end: false, icon: 'layers' },
  { to: '/app/studio/photos', label: 'Image Studio', end: false, icon: 'image' },
  { to: '/app/studio/videos', label: 'Video Studio', end: false, icon: 'video' },
  { to: '/app/studio/ads', label: 'Ads & Social', end: false, icon: 'tag' },
  { to: '/app/library', label: 'Library', end: false, icon: 'folder' },
  { to: '/app/settings', label: 'Settings', end: false, icon: 'settings' },
] as const

function NavIcon({ name }: { name: (typeof NAV)[number]['icon'] }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  }

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V21h13V9.5" />
        </svg>
      )
    case 'box':
      return (
        <svg {...common}>
          <path d="M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7Z" />
          <path d="M3 8.5 12 14l9-5.5" />
          <path d="M12 14v7" />
        </svg>
      )
    case 'layers':
      return (
        <svg {...common}>
          <path d="m12 2 9 5-9 5-9-5 9-5Z" />
          <path d="m3 12 9 5 9-5" />
          <path d="m3 17 9 5 9-5" />
        </svg>
      )
    case 'image':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="9" cy="10" r="1.5" />
          <path d="m21 15-4.5-4.5L7 20" />
        </svg>
      )
    case 'video':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="m16 10 5-3v10l-5-3" />
        </svg>
      )
    case 'tag':
      return (
        <svg {...common}>
          <path d="M20.6 13.4 12.4 21.6a2 2 0 0 1-2.8 0L3 15V4h11l6.6 6.6a2 2 0 0 1 0 2.8Z" />
          <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'folder':
      return (
        <svg {...common}>
          <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10Z" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
      )
  }
}

type AppLayoutProps = {
  children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, signOut } = useAuth()
  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Account'
  const initial = displayName.slice(0, 1).toUpperCase()

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
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="studio-rail-footer">
          <div className="studio-promo">
            <span className="studio-promo-icon" aria-hidden="true">
              ✦
            </span>
            <p>Turn one product into a full campaign.</p>
            <Link className="studio-promo-btn" to="/app/campaigns/new">
              Create New
            </Link>
          </div>
          <div className="studio-rail-user">
            <span className="app-user-avatar" aria-hidden="true">
              {user?.photoURL ? <img src={user.photoURL} alt="" /> : initial}
            </span>
            <div className="studio-rail-user-meta">
              <strong>{displayName}</strong>
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
