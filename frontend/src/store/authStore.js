import { create } from 'zustand'
import { TOKEN_KEY } from '../api/client'

const USER_KEY = 'velox_user'

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    // Corrupted entry — treat it as logged out.
    return null
  }
}

export const useAuthStore = create((set) => ({
  user: readStoredUser(),
  token: localStorage.getItem(TOKEN_KEY) || null,

  setAuth: (user, token) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ user, token })
  },

  setUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
    set({ user })
  },

  logout: () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    set({ user: null, token: null })
  },
}))

export default useAuthStore
