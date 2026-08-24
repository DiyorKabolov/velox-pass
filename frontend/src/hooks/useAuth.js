import { useMemo } from 'react'
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
      isStaff: ['superadmin', 'venue_admin'].includes(user?.role),
      isScanner: ['superadmin', 'venue_admin', 'scanner'].includes(user?.role),
    }),
    [user, token, setAuth, setUser, logout],
  )
}

export default useAuth
