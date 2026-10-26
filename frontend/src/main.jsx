import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {/* reducedMotion="user" disables animation when the OS asks for it. */}
        <MotionConfig reducedMotion="user">
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
          <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--surface2)',
              color: 'var(--text)',
              border: '1px solid var(--border2)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '14px',
              fontFamily: "'Golos Text', system-ui, sans-serif",
              padding: '10px 14px',
              boxShadow: '0 24px 48px -16px rgba(0, 0, 0, 0.8)',
            },
            success: { iconTheme: { primary: 'var(--ok)', secondary: 'var(--bg)' } },
            error: { iconTheme: { primary: 'var(--err)', secondary: 'var(--bg)' } },
          }}
          />
        </MotionConfig>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
