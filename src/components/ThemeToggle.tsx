import { useTheme } from '../theme/ThemeProvider'
import type { ThemePreference } from '../lib/theme'

type ThemeToggleProps = {
  variant?: 'icon' | 'segmented'
}

export default function ThemeToggle({ variant = 'icon' }: ThemeToggleProps) {
  const { preference, resolved, setPreference, toggleLightDark } = useTheme()

  if (variant === 'segmented') {
    const options: { id: ThemePreference; label: string }[] = [
      { id: 'light', label: 'Light' },
      { id: 'dark', label: 'Dark' },
      { id: 'system', label: 'System' },
    ]
    return (
      <div className="theme-segmented" role="group" aria-label="Color theme">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={preference === option.id ? 'is-active' : ''}
            onClick={() => setPreference(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    )
  }

  const isDark = resolved === 'dark'
  return (
    <button
      type="button"
      className="studio-topbar-icon theme-toggle-icon"
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
      onClick={toggleLightDark}
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3 7 7 0 0 0 21 14.5z" />
        </svg>
      )}
    </button>
  )
}
