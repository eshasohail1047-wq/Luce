import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router-dom'
import Logo from '../Logo'
import ThemeToggle from './ThemeToggle'
import { useAuth } from '../auth/AuthProvider'
import { isPaidPlan, planLabel as formatPlanLabel } from '../lib/plans'

type NavIconName =
  | 'home'
  | 'box'
  | 'layers'
  | 'folder'
  | 'settings'
  | 'image'
  | 'video'
  | 'tag'
  | 'spark'
  | 'plus'
  | 'crown'
  | 'guide'

type NavItem = {
  to: string
  label: string
  end?: boolean
  icon: NavIconName
  pro?: boolean
  comingSoon?: boolean
}

const ICON_RAIL: NavItem[] = [
  { to: '/app', label: 'Home', end: true, icon: 'home' },
  { to: '/app/studio/photos', label: 'Image Studio', icon: 'image' },
  { to: '/app/studio/videos', label: 'Video Studio', icon: 'video', pro: true },
  { to: '/app/campaigns/new', label: 'Full Campaign', icon: 'spark', pro: true },
  { to: '/app/campaigns', label: 'Campaigns', icon: 'layers' },
  { to: '/app/library', label: 'Library', icon: 'folder' },
]

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Create',
    items: [
      { to: '/app', label: 'Home', end: true, icon: 'home' },
      { to: '/app/studio/photos', label: 'Image Studio', icon: 'image' },
      { to: '/app/studio/videos', label: 'Video Studio', icon: 'video', pro: true },
      { to: '/app/campaigns/new', label: 'Full Campaign', icon: 'spark', pro: true },
    ],
  },
  {
    label: 'Manage',
    items: [
      { to: '/app/products', label: 'Products', icon: 'box' },
      { to: '/app/campaigns', label: 'Campaigns', icon: 'layers' },
      { to: '/app/library', label: 'Library', icon: 'folder' },
      {
        to: '/app/studio/ads',
        label: 'Ads & Social',
        icon: 'tag',
        pro: true,
        comingSoon: true,
      },
    ],
  },
  {
    label: 'Account',
    items: [{ to: '/app/settings', label: 'Settings', icon: 'settings' }],
  },
]

function NavIcon({ name }: { name: NavIconName }) {
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
    case 'image':
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8.5" cy="10" r="1.5" />
          <path d="m21 16-4.5-4.5L9 19" />
        </svg>
      )
    case 'video':
      return (
        <svg {...common}>
          <rect x="3" y="6" width="13" height="12" rx="2" />
          <path d="m16 10 5-3v10l-5-3V10Z" />
        </svg>
      )
    case 'tag':
      return (
        <svg {...common}>
          <path d="M20.6 13.05 12.7 21a1.5 1.5 0 0 1-2.1 0L3 13.4V3h10.4l7.2 7.2a1.5 1.5 0 0 1 0 2.85Z" />
          <circle cx="7.5" cy="7.5" r="1.2" />
        </svg>
      )
    case 'spark':
      return (
        <svg {...common}>
          <path d="M12 3v4M12 17v4M3 12h4M17 12h4" />
          <path d="m6.2 6.2 2.8 2.8M15 15l2.8 2.8M17.8 6.2 15 9M9 15l-2.8 2.8" />
        </svg>
      )
    case 'plus':
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      )
    case 'crown':
      return (
        <svg {...common}>
          <path d="m3 8 4 3 5-6 5 6 4-3v10H3V8Z" />
        </svg>
      )
    case 'guide':
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
        </svg>
      )
  }
}

function renderNavItem(item: NavItem, paid: boolean) {
  if (item.comingSoon) {
    return (
      <span
        key={item.to + item.label}
        className="studio-rail-link is-soon"
        title="Coming soon — not in MVP"
      >
        <NavIcon name={item.icon} />
        <span>{item.label}</span>
        <span className="studio-rail-soon">Soon</span>
      </span>
    )
  }
  return (
    <NavLink
      key={item.to + item.label}
      to={item.to}
      end={item.end}
      className={({ isActive }) => `studio-rail-link${isActive ? ' is-active' : ''}`}
    >
      <NavIcon name={item.icon} />
      <span>{item.label}</span>
      {item.pro && !paid ? <span className="studio-rail-pro">Paid</span> : null}
    </NavLink>
  )
}

type AppLayoutProps = {
  children: ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { user, plan, signOut } = useAuth()
  const displayName = user?.displayName?.trim() || user?.email?.split('@')[0] || 'Account'
  const initial = displayName.slice(0, 1).toUpperCase()
  const planLabel = `${formatPlanLabel(plan)} plan`
  const paid = isPaidPlan(plan)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const notifId = useId()

  async function handleLogout() {
    setMenuOpen(false)
    try {
      await signOut()
    } finally {
      window.location.replace('/')
    }
  }

  useEffect(() => {
    if (!menuOpen && !notifOpen) return
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (menuOpen && menuRef.current && !menuRef.current.contains(target)) setMenuOpen(false)
      if (notifOpen && notifRef.current && !notifRef.current.contains(target)) {
        setNotifOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false)
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen, notifOpen])

  return (
    <div className="studio-shell">
      <aside className="studio-rail-dual" aria-label="App navigation">
        <div className="studio-icon-rail">
          <Link to="/app" className="studio-icon-rail-logo" aria-label="LUCE home">
            <span className="studio-icon-rail-mark" aria-hidden="true">
              L
            </span>
          </Link>
          <nav className="studio-icon-rail-nav" aria-label="Quick links">
            {ICON_RAIL.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={item.label}
                aria-label={item.label}
                className={({ isActive }) =>
                  `studio-icon-rail-btn${isActive ? ' is-active' : ''}`
                }
              >
                <NavIcon name={item.icon} />
              </NavLink>
            ))}
          </nav>
          <div className="studio-icon-rail-bottom">
            <Link
              to="/app/settings#help"
              className="studio-icon-rail-btn"
              title="Help"
              aria-label="Help"
            >
              <NavIcon name="guide" />
            </Link>
            <Link
              to="/app/settings"
              className="studio-icon-rail-btn"
              title="Settings"
              aria-label="Settings"
            >
              <NavIcon name="settings" />
            </Link>
          </div>
        </div>

        <div className="studio-rail studio-rail-ayari studio-rail-panel">
          <div className="studio-rail-top">
            <div className="studio-rail-panel-head">
              <Link to="/app" className="studio-rail-brand" aria-label="LUCE home">
                <Logo href={null} />
              </Link>
            </div>

            <Link className="studio-rail-create" to="/app/studio/photos">
              <NavIcon name="plus" />
              <span>Create New</span>
            </Link>
          </div>

          <div className="studio-rail-scroll">
            {NAV_GROUPS.map((group) => (
              <div key={group.label} className="studio-rail-group">
                <p className="studio-rail-label">{group.label}</p>
                <nav className="studio-rail-nav" aria-label={group.label}>
                  {group.items.map((item) => renderNavItem(item, paid))}
                </nav>
              </div>
            ))}
          </div>

          <div className="studio-rail-footer">
            {!paid ? (
              <Link className="studio-rail-upgrade-card" to="/app/settings#plan">
                <span className="studio-rail-upgrade-icon" aria-hidden="true">
                  <NavIcon name="crown" />
                </span>
                <span>
                  <strong>Upgrade plan</strong>
                  <em>Unlock video & campaigns</em>
                </span>
              </Link>
            ) : (
              <Link className="studio-rail-help-card" to="/app/settings#help">
                <span className="studio-rail-upgrade-icon" aria-hidden="true">
                  <NavIcon name="guide" />
                </span>
                <span>
                  <strong>Need help?</strong>
                  <em>View guide →</em>
                </span>
              </Link>
            )}
          </div>
        </div>
      </aside>

      <div className="studio-stage">
        <header className="studio-topbar studio-topbar-compact">
          <div className="studio-topbar-spacer" />
          <div className="studio-topbar-actions">
            {!paid ? (
              <Link className="studio-topbar-upgrade" to="/app/settings#plan">
                Upgrade
              </Link>
            ) : null}
            <ThemeToggle />
            <div className="studio-topbar-notif" ref={notifRef}>
              <button
                type="button"
                className={`studio-topbar-icon${notifOpen ? ' is-open' : ''}`}
                aria-label="Notifications"
                aria-expanded={notifOpen}
                aria-controls={notifId}
                onClick={() => {
                  setNotifOpen((v) => !v)
                  setMenuOpen(false)
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  aria-hidden="true"
                >
                  <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
                  <path d="M10 20a2 2 0 0 0 4 0" />
                </svg>
                <span className="studio-topbar-dot" aria-hidden="true" />
              </button>
              {notifOpen ? (
                <div className="studio-notif-menu" id={notifId} role="menu">
                  <div className="studio-notif-head">
                    <strong>Notifications</strong>
                  </div>
                  <p className="studio-notif-empty">
                    You’re all caught up. Export alerts will appear here when generation finishes.
                  </p>
                  <Link
                    role="menuitem"
                    to="/app/settings#help"
                    className="studio-account-menu-item"
                    onClick={() => setNotifOpen(false)}
                  >
                    Help &amp; support
                  </Link>
                </div>
              ) : null}
            </div>
            <div className="studio-topbar-account" ref={menuRef}>
              <button
                type="button"
                className={`studio-topbar-user${menuOpen ? ' is-open' : ''}`}
                aria-label="Account menu"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                aria-controls={menuId}
                onClick={() => {
                  setMenuOpen((open) => !open)
                  setNotifOpen(false)
                }}
              >
                <span className="studio-topbar-avatar" aria-hidden="true">
                  {user?.photoURL ? <img src={user.photoURL} alt="" /> : initial}
                </span>
                <span className="studio-topbar-meta">
                  <strong className="studio-topbar-name">{displayName}</strong>
                  <span className={`studio-topbar-plan${paid ? ' is-pro' : ''}`}>
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
                    {paid ? 'Manage plan' : 'Upgrade plan'}
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
