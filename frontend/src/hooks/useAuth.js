import { useEffect, useMemo } from 'react'
import { getMe } from '../api/auth'
import useAuthStore from '../store/authStore'

/** Auth state plus the derived role flags the routes and navbar need. */
export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const token = useAuthStore((s) => s.token)
  const setAuth = useAuthStore((s) => s.setAuth)
  const setUser = useAuthStore((s) => s.setUser)
  const logout = useAuthStore((s) => s.logout)

  return useMemo(
    () => ({
      user,
      token,
      setAuth,
      setUser,
      logout,
      isAuthenticated: Boolean(token && user),
      isSuperadmin: user?.role === 'superadmin',
      // The panel is for venue administrators; a superadmin reaches the same
      // screens through the full admin section and does not need the link.
      isVenueAdmin: user?.role === 'venue_admin',
      isStaff: ['superadmin', 'venue_admin'].includes(user?.role),
      isScanner: ['superadmin', 'venue_admin', 'scanner'].includes(user?.role),
    }),
    [user, token, setAuth, setUser, logout],
  )
}

/**
 * Pulls a fresh copy of the signed-in user from the API once per mount.
 *
 * The user object lives in localStorage, so without this a role granted by an
 * admin would not reach the browser until the person signed out and back in:
 * reloading the page just re-reads the stale copy.
 */
export function useSyncUser() {
  const token = useAuthStore((s) => s.token)
  const setUser = useAuthStore((s) => s.setUser)

  useEffect(() => {
    if (!token) return undefined
    let cancelled = false

    getMe()
      .then((fresh) => {
        if (!cancelled) setUser(fresh)
      })
      // A 401 is already handled by the axios interceptor, which signs out.
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [token, setUser])
}

export default useAuth
