import { Navigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { loadOnboarding, stepPath } from '../lib/onboarding'

/**
 * App routes: send users who haven't finished brand setup into /onboarding.
 * Legacy accounts (no onboarding field) are treated as already complete.
 */
export default function RequireOnboarding({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()
  const [checking, setChecking] = useState(true)
  const [redirectTo, setRedirectTo] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      if (loading) return
      if (!user) {
        if (alive) {
          setRedirectTo('/login')
          setChecking(false)
        }
        return
      }
      try {
        const state = await loadOnboarding(user.uid)
        if (!alive) return
        if (!state.completed) {
          setRedirectTo(stepPath(state.step || 'personal'))
        } else {
          setRedirectTo(null)
        }
      } catch {
        if (alive) setRedirectTo(null)
      } finally {
        if (alive) setChecking(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [user, loading, location.pathname])

  if (loading || checking) {
    return (
      <div className="studio-shell studio-shell-alone">
        <p className="app-loading">Loading…</p>
      </div>
    )
  }

  if (redirectTo && redirectTo !== location.pathname) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
