import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Navbar from './components/layout/Navbar'
import Footer from './components/layout/Footer'
import useAuth, { useSyncUser } from './hooks/useAuth'
import Cabinet from './pages/Cabinet'
import Confirm from './pages/Confirm'
import EventDetail from './pages/EventDetail'
import Home from './pages/Home'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Register from './pages/Register'
import Scanner from './pages/Scanner'
import Venues from './pages/Venues'
import VenuePage from './pages/VenuePage'
import VenueAdminPanel from './pages/VenueAdminPanel'
import Dashboard from './pages/admin/Dashboard'
import AdminEvents from './pages/admin/Events'
import AdminEventForm from './pages/admin/EventForm'
import AdminVenues from './pages/admin/Venues'
import AdminSessions from './pages/admin/Sessions'
import AdminTickets from './pages/admin/Tickets'
import AdminPdfTemplates from './pages/admin/PdfTemplates'
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

/** Scanner page: staff only (scanner, venue_admin or superadmin). */
function ScannerRoute({ children }) {
  const { isAuthenticated, isScanner } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (!isScanner) {
    return <Navigate to="/" replace />
  }
  return children
}

/** Venue administrators, plus superadmins who oversee every venue. */
function VenueAdminRoute({ children }) {
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (user?.role !== 'venue_admin' && user?.role !== 'superadmin') {
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
  // Keeps role-dependent navigation correct after an admin changes a role.
  useSyncUser()

  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />

      <main className="flex-1 pb-16">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/event/:id" element={<EventDetail />} />
          <Route path="/venues" element={<Venues />} />
          <Route path="/venues/:id" element={<VenuePage />} />

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
            path="/scanner"
            element={
              <ScannerRoute>
                <Scanner />
              </ScannerRoute>
            }
          />

          <Route
            path="/venue-admin"
            element={
              <VenueAdminRoute>
                <VenueAdminPanel />
              </VenueAdminRoute>
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
            path="/admin/events/new"
            element={
              <AdminRoute>
                <AdminEventForm />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/venues"
            element={
              <AdminRoute>
                <AdminVenues />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/sessions"
            element={
              <AdminRoute>
                <AdminSessions />
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
          <Route
            path="/admin/pdf-templates"
            element={
              <AdminRoute>
                <AdminPdfTemplates />
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
