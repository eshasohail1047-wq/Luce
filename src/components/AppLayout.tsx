import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Logo from '../Logo'
import { useAuth } from '../auth/AuthProvider'

const MAIN_NAV = [
  { to: '/app', label: 'Dashboard', end: true, icon: 'home' as const },
  { to: '/app/products', label: 'Products', end: false, icon: 'box' as const },
  { to: '/app/campaigns', label: 'Campaigns', end: false, icon: 'layers' as const },
  { to: '/app/library', label: 'Library', end: false, icon: 'folder' as const },
]

const CREATE_NAV = [
  { to: '/app/studio/photos', label: 'Image Studio', icon: 'image' as const, pro: false },
  { to: '/app/studio/videos', label: 'Video Studio', icon: 'video' as const, pro: true },
  { to: '/app/studio/ads', label: 'Ads & Social', icon: 'tag' as const, pro: true },
  { to: '/app/campaigns/new', label: 'Full Campaign', icon: 'spark' as const, pro: true },
]

function NavIcon({
  name,
}: {
  name:
    | 'home'
    | 'box'
    | 'layers'
    | 'folder'
    | 'settings'
    | 'help'
    | 'logout'
    | 'image'
    | 'video'
    | 'tag'
    | 'spark'
}) {
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
    case 'folder':
      return (
        <svg {...common}>
          <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10Z" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h10M4 17h13" />
          <circle cx="18" cy="12" r="2" />
          <circle cx="15" cy="17" r="2" />
          <circle cx="20" cy="7" r="2" />
        </svg>
      )
    case 'help':
      return (
        <svg {...common}>
          <path d="M21 12a8.5 8.5 0 0 1-12.4 7.5L3 21l1.7-5.1A8.5 8.5 0 1 1 21 12Z" />
        </svg>
      )
    case 'logout':
      return (
        <svg {...common}>
          <path d="M10 17H5.5A2.5 2.5 0 0 1 3 14.5v-5A2.5 2.5 0 0 1 5.5 7H10" />
          <path d="M15 12H8" />
          <path d="m13 9 3 3-3 3" />
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
    case 'spark':
      return (
        <svg {...common}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
        </svg>
      )
  }
}

type AppLayoutProps = {
  children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, plan, signOut } = useAuth()
  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Account'
  const initial = displayName.slice(0, 1).toUpperCase()
  const planLabel = plan === 'pro' ? 'Pro plan' : 'Free plan'
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()

  async function handleLogout() {
    setMenuOpen(false)
    try {
      await signOut()
    } finally {
      // Full navigation so app routes don't redirect to /login first
      window.location.replace('/')
    }
  }

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  return (
    <div className="studio-shell">
      <aside className="studio-rail">
        <Link to="/app" className="studio-rail-brand" aria-label="LUCE home">
          <Logo href={null} />
        </Link>

        <div className="studio-rail-scroll">
          <nav className="studio-rail-nav" aria-label="Workspace">
            {MAIN_NAV.map((item) => (
              <NavLink
                key={item.to + item.label}
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

          <div className="studio-rail-group">
            <p className="studio-rail-label">Create</p>
            <nav className="studio-rail-nav" aria-label="Create">
              {CREATE_NAV.map((item) => {
                const locked = item.pro && plan !== 'pro'
                return (
                  <NavLink
                    key={item.to + item.label}
                    to={item.to}
                    className={({ isActive }) =>
                      `studio-rail-link${isActive ? ' is-active' : ''}${locked ? ' is-locked' : ''}`
                    }
                  >
                    <NavIcon name={item.icon} />
                    <span>{item.label}</span>
                    {locked ? <span className="studio-rail-pro">Pro</span> : null}
                  </NavLink>
                )
              })}
            </nav>
          </div>

          <div className="studio-rail-group">
            <p className="studio-rail-label">General</p>
            <nav className="studio-rail-nav" aria-label="General">
              <NavLink
                to="/app/settings"
                className={({ isActive }) =>
                  `studio-rail-link${isActive ? ' is-active' : ''}`
                }
              >
                <NavIcon name="settings" />
                <span>Settings</span>
              </NavLink>
              <NavLink
                to="/app/settings#help"
                className="studio-rail-link"
              >
                <NavIcon name="help" />
                <span>Help</span>
              </NavLink>
              <button
                type="button"
                className="studio-rail-link studio-rail-logout"
                onClick={() => {
                  void handleLogout()
                }}
              >
                <NavIcon name="logout" />
                <span>Logout</span>
              </button>
            </nav>
          </div>
        </div>

        <div className="studio-rail-footer">
          <div className="studio-promo">
            {plan === 'pro' ? (
              <>
                <strong>Start a full campaign</strong>
                <p>One product → images, video &amp; ads</p>
                <Link className="studio-promo-btn" to="/app/campaigns/new">
                  Create
                </Link>
              </>
            ) : (
              <>
                <strong>Free: Image Studio</strong>
                <p>Generate product images — upgrade for video &amp; ads</p>
                <Link className="studio-promo-btn" to="/app/studio/photos">
                  Create images
                </Link>
              </>
            )}
          </div>
        </div>
      </aside>

      <div className="studio-stage">
        <header className="studio-topbar">
          <div className="studio-topbar-left">
            <label className="studio-topbar-search">
              <span className="sr-only">Search</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                placeholder="Search coming soon…"
                disabled
                title="Search will be available after generation launches"
              />
            </label>
          </div>

          <div className="studio-topbar-actions">
            <button
              type="button"
              className="studio-topbar-icon"
              aria-label="Notifications coming soon"
              title="Notifications coming soon"
              disabled
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
                <path d="M10 20a2 2 0 0 0 4 0" />
              </svg>
            </button>
            <div className="studio-topbar-account" ref={menuRef}>
              <button
                type="button"
                className={`studio-topbar-user${menuOpen ? ' is-open' : ''}`}
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <span className="studio-topbar-avatar" aria-hidden="true">
                  {user?.photoURL ? <img src={user.photoURL} alt="" /> : initial}
                </span>
                <span className="studio-topbar-meta">
                  <strong className="studio-topbar-name">{displayName}</strong>
                  <span className={`studio-topbar-plan${plan === 'pro' ? ' is-pro' : ''}`}>
                    {plan === 'pro' ? <span className="studio-topbar-plan-badge">PRO</span> : null}
                    {planLabel}
                  </span>
                </span>
              </button>

              {menuOpen ? (
                <div className="studio-account-menu" id={menuId} role="menu">
                  <div className="studio-account-menu-head">
                    <strong>{displayName}</strong>
                    <span>{user?.email || planLabel}</span>
                  </div>
                  <Link
                    role="menuitem"
                    to="/app/settings"
                    className="studio-account-menu-item"
                    onClick={() => setMenuOpen(false)}
                  >
                    Settings
                  </Link>
                  <Link
                    role="menuitem"
                    to="/app/settings#plan"
                    className="studio-account-menu-item"
                    onClick={() => setMenuOpen(false)}
                  >
                    {plan === 'pro' ? 'Manage plan' : 'Upgrade to Pro'}
                  </Link>
                  <Link
                    role="menuitem"
                    to="/app/settings#help"
                    className="studio-account-menu-item"
                    onClick={() => setMenuOpen(false)}
                  >
                    Help &amp; support
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="studio-account-menu-item studio-account-menu-logout"
                    onClick={() => {
                      void handleLogout()
                    }}
                  >
                    Log out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <div className="studio-stage-body">{children}</div>
      </div>
    </div>
  )
}
