import axios from 'axios'

export const TOKEN_KEY = 'velox_token'

const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

// Attach the stored JWT to every outgoing request.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// A 401 means the token is gone or expired: drop it and bounce to /login.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem('velox_user')
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

/** Pull a readable message out of a FastAPI error response. */
export function apiError(error, fallback = 'Something went wrong') {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail) && detail.length) return detail[0].msg ?? fallback
  return error?.message ?? fallback
}

export default client
