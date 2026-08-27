import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Without this Vite binds IPv6 only ([::1]), so http://127.0.0.1:5173
    // refuses connections. `true` binds every interface, which also makes the
    // dev site reachable from a phone on the same Wi-Fi.
    host: true,
    port: 5173,
    proxy: {
      // No rewrite: the backend serves the API under /api itself, so the same
      // request path works in development and in production.
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true
      }
    }
  }
})
