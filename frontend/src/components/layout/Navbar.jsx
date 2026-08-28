import { CalendarDays, Camera, LayoutDashboard, LogOut, Ticket, User } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import useAuth from '../../hooks/useAuth'

const PILL_SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.7 }

/**
 * Icon always, label only where there is room. The active pill is a shared
 * layout element, so it slides between tabs instead of blinking on and off.
 */
function NavItem({ to, end, icon: Icon, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      className="relative rounded-[var(--radius-sm)] px-2.5 py-2 text-sm transition-transform duration-150 active:scale-[0.94] sm:px-3"
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active-pill"
              transition={PILL_SPRING}
              className="absolute inset-0 rounded-[var(--radius-sm)] bg-[var(--surface2)] ring-1 ring-[var(--border)]"
            />
          )}
          <span
            className={[
              'relative inline-flex items-center gap-1.5 whitespace-nowrap transition-colors duration-200',
              isActive
                ? 'text-[var(--text)]'
                : 'text-[var(--muted)] hover:text-[var(--text)]',
            ].join(' ')}
          >
            <Icon size={15} className="shrink-0" />
            <span className="hidden sm:inline">{children}</span>
          </span>
        </>
      )}
    </NavLink>
  )
}

export default function Navbar() {
  const { isAuthenticated, isScanner, isSuperadmin, user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    toast.success('Вы вышли из аккаунта')
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--bg)]/92 backdrop-blur">
      {/* mr-auto on the logo pushes tabs and actions together on the right. */}
      <nav className="mx-auto flex h-16 max-w-6xl items-center gap-1 px-4 sm:gap-2 sm:px-5">
        <Link
          to="/"
          className="mr-auto shrink-0 whitespace-nowrap font-display text-[13px] tracking-[0.14em] text-[var(--text)] transition-opacity duration-150 hover:opacity-75 sm:text-base sm:tracking-[0.18em]"
        >
          VELOX<span className="text-[var(--accent)]">·</span>PASS
        </Link>

        <div className="flex items-center gap-0.5 sm:gap-1">
          <NavItem to="/" end icon={CalendarDays}>
            Афиша
          </NavItem>

          {isAuthenticated && (
            <NavItem to="/cabinet" icon={Ticket}>
              Мои билеты
            </NavItem>
          )}

          {isScanner && (
            <NavItem to="/scanner" icon={Camera}>
              Сканер
            </NavItem>
          )}

          {isSuperadmin && (
            <NavItem to="/admin" icon={LayoutDashboard}>
              Админ
            </NavItem>
          )}
        </div>

        <div className="ml-1 flex shrink-0 items-center gap-2 border-l border-[var(--border)] pl-2 sm:ml-2 sm:pl-3">
          {isAuthenticated ? (
            <>
              <span className="hidden items-center gap-1.5 whitespace-nowrap text-sm text-[var(--muted)] md:inline-flex">
                <User size={14} />
                {user?.username}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                title="Выйти"
                aria-label="Выйти"
                className="rounded-[var(--radius-sm)] border border-[var(--border)] p-2 text-[var(--muted)] transition-all duration-150 hover:border-[var(--err)] hover:text-[var(--err)] active:scale-[0.92]"
              >
                <LogOut size={14} />
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="whitespace-nowrap rounded-[var(--radius-sm)] px-2 py-1.5 text-sm text-[var(--muted)] transition-all duration-150 hover:text-[var(--text)] active:scale-[0.94] sm:px-3"
              >
                Войти
              </Link>
              <Link
                to="/register"
                className="whitespace-nowrap rounded-[var(--radius-sm)] bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-[var(--bg)] transition-all duration-150 hover:brightness-110 active:scale-[0.94]"
              >
                Регистрация
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  )
}
