import {
  Building2,
  CalendarDays,
  Camera,
  LayoutDashboard,
  Store,
  Ticket,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import useAuth from '../../hooks/useAuth'
import Logo from './Logo'
import UserMenu from './UserMenu'

const UNDERLINE_SPRING = { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 }

/**
 * A text tab with a signal-coloured rule under it when it is the page you are
 * on. The rule is one shared layout element, so it slides from the old tab to
 * the new one instead of blinking. On a phone there is no room for the words,
 * so the icon stands in for them -- and only there.
 */
function NavItem({ to, end, icon: Icon, children }) {
  return (
    <NavLink
      to={to}
      end={end}
      aria-label={typeof children === 'string' ? children : undefined}
      className="group relative flex h-full items-center px-2.5 text-[14px] outline-none sm:px-3"
    >
      {({ isActive }) => (
        <>
          <span
            className={[
              'relative inline-flex items-center whitespace-nowrap rounded-[3px] transition-colors duration-200',
              'group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-[var(--accent)]',
              isActive
                ? 'text-[var(--text)]'
                : 'text-[var(--muted)] group-hover:text-[var(--text)]',
            ].join(' ')}
          >
            <Icon size={18} strokeWidth={1.75} className="shrink-0 sm:hidden" />
            <span className="hidden sm:inline">{children}</span>
          </span>
          {isActive && (
            <motion.span
              layoutId="nav-underline"
              transition={UNDERLINE_SPRING}
              className="absolute inset-x-2.5 -bottom-px h-[2px] bg-[var(--accent)] sm:inset-x-3"
            />
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Navbar() {
  const { isAuthenticated, isScanner, isSuperadmin, isVenueAdmin, user, logout } =
    useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    toast.success('Вы вышли из аккаунта')
    navigate('/')
  }

  return (
    // Solid ink and a hairline, from .navbar-surface in index.css. z-40 keeps
    // the bar above page content but below the scanner overlay (z-50) and
    // modals (z-60).
    <header className="navbar-surface sticky top-0 z-40">
      <nav className="mx-auto flex h-16 max-w-[1240px] items-stretch gap-1 px-4 sm:px-6 lg:px-10">
        {/* mr-auto on the logo pushes tabs and actions together on the right. */}
        <Link
          to="/"
          aria-label="Velox Pass — афиша"
          className="mr-auto flex shrink-0 items-center rounded-[3px] transition-opacity duration-200 hover:opacity-80"
        >
          <Logo />
        </Link>

        <div className="flex items-stretch">
          <NavItem to="/" end icon={CalendarDays}>
            Афиша
          </NavItem>

          <NavItem to="/venues" icon={Building2}>
            Площадки
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

          {/* Building2 is taken by the public catalogue above, so the
              administrator's own venue gets its own icon. */}
          {isVenueAdmin && (
            <NavItem to="/venue-admin" icon={Store}>
              Моя площадка
            </NavItem>
          )}

          {isSuperadmin && (
            <NavItem to="/admin" icon={LayoutDashboard}>
              Админ
            </NavItem>
          )}
        </div>

        <div className="my-auto ml-1 flex shrink-0 items-center gap-1 border-l border-[var(--border)] pl-2 sm:ml-3 sm:gap-2 sm:pl-4">
          {isAuthenticated ? (
            <UserMenu user={user} onLogout={handleLogout} />
          ) : (
            <>
              <Link
                to="/login"
                className="whitespace-nowrap rounded-[var(--radius-sm)] px-2 py-1.5 text-[14px] text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)] sm:px-3"
              >
                Войти
              </Link>
              <Link
                to="/register"
                className="whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--border2)] px-3 py-1.5 text-[14px] font-medium text-[var(--text)] transition-[background-color,border-color,transform] duration-200 hover:border-[var(--muted2)] hover:bg-[var(--surface2)] active:scale-[0.97]"
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
