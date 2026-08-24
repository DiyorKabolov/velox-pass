import { LayoutDashboard, LogOut, Ticket, User } from 'lucide-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import useAuth from '../../hooks/useAuth'

function navClass({ isActive }) {
  return [
    'rounded-[var(--radius-sm)] px-3 py-1.5 text-sm transition-colors duration-150',
    isActive
      ? 'bg-[var(--accent-dim)] text-[var(--text)]'
      : 'text-[var(--muted)] hover:text-[var(--text)]',
  ].join(' ')
}

export default function Navbar() {
  const { isAuthenticated, isSuperadmin, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    toast.success('Signed out')
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/92 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5">
        <Link
          to="/"
          className="font-display text-base tracking-[0.18em] text-[var(--text)]"
        >
          VELOX<span className="text-[var(--accent)]">·</span>PASS
        </Link>

        <div className="flex items-center gap-1">
          <NavLink to="/" end className={navClass}>
            Events
          </NavLink>

          {isAuthenticated && (
            <NavLink to="/cabinet" className={navClass}>
              <span className="inline-flex items-center gap-1.5">
                <Ticket size={14} /> My tickets
              </span>
            </NavLink>
          )}

          {isSuperadmin && (
            <NavLink to="/admin" className={navClass}>
              <span className="inline-flex items-center gap-1.5">
                <LayoutDashboard size={14} /> Admin
              </span>
            </NavLink>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <>
              <span className="hidden items-center gap-1.5 text-sm text-[var(--muted)] sm:inline-flex">
                <User size={14} />
                {user?.username}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                title="Sign out"
                className="rounded-[var(--radius-sm)] border border-[var(--border)] p-2 text-[var(--muted)] transition-colors hover:border-[var(--border2)] hover:text-[var(--text)]"
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={navClass}>
                Sign in
              </NavLink>
              <Link
                to="/register"
                className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-3.5 py-1.5 text-sm font-medium text-[var(--bg)] transition-all hover:brightness-110"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
