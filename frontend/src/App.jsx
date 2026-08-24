import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import useAuth from './hooks/useAuth'
import Cabinet from './pages/Cabinet'
import Confirm from './pages/Confirm'
import EventDetail from './pages/EventDetail'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Register from './pages/Register'
import Dashboard from './pages/admin/Dashboard'
import AdminEvents from './pages/admin/Events'
import AdminTickets from './pages/admin/Tickets'
import AdminUsers from './pages/admin/Users'

/** Requires a signed-in user; remembers where they were headed. */
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  return children
}

/** Superadmin-only. Signed-in non-admins get sent home, not to the login page. */
function AdminRoute({ children }) {
  const { isAuthenticated, isSuperadmin } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (!isSuperadmin) {
    return <Navigate to="/" replace />
  }
  return children
}

/** Keeps signed-in users away from the login / register screens. */
function GuestRoute({ children }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <Navigate to="/" replace /> : children
}

export default function App() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />

      <main className="flex-1 pb-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/event/:id" element={<EventDetail />} />

          <Route
            path="/login"
            element={
              <GuestRoute>
                <Login />
              </GuestRoute>
            }
          />
          <Route
            path="/register"
            element={
              <GuestRoute>
                <Register />
              </GuestRoute>
            }
          />
          <Route path="/confirm" element={<Confirm />} />

          <Route
            path="/cabinet"
            element={
              <ProtectedRoute>
                <Cabinet />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Dashboard />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/events"
            element={
              <AdminRoute>
                <AdminEvents />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <AdminUsers />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/tickets"
            element={
              <AdminRoute>
                <AdminTickets />
              </AdminRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}
