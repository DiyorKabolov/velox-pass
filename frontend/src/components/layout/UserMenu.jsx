import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Ticket, User, Users } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import Avatar from '../ui/Avatar'

const ITEMS = [
  { to: '/profile', label: 'Профиль', icon: User },
  { to: '/cabinet', label: 'Мои билеты', icon: Ticket },
  { to: '/friends', label: 'Друзья', icon: Users },
]

/** The signed-in user's name, opening onto their own pages and sign-out. */
export default function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const location = useLocation()

  // Moving to another page closes it; so does a click outside or Escape.
  useEffect(() => setOpen(false), [location.pathname])
  useEffect(() => {
    if (!open) return undefined
    const onPointer = (event) => {
      if (!root.current?.contains(event.target)) setOpen(false)
    }
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-[var(--radius-sm)] px-1.5 py-1 text-sm text-[var(--muted)] transition-colors duration-150 hover:text-[var(--text)]"
      >
        <Avatar username={user?.username} src={user?.avatar_url} size={28} />
        <span className="hidden max-w-[140px] truncate md:inline">{user?.username}</span>
        <ChevronDown size={14} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-52 overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] py-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
        >
          {ITEMS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-[var(--text)] transition-colors hover:bg-[var(--surface2)]"
            >
              <item.icon size={15} className="text-[var(--muted)]" />
              {item.label}
            </Link>
          ))}
          <div className="my-1 border-t border-[var(--border)]" />
          <button
            type="button"
            role="menuitem"
            onClick={onLogout}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-[var(--err)] transition-colors hover:bg-[var(--surface2)]"
          >
            <LogOut size={15} />
            Выйти
          </button>
        </div>
      )}
    </div>
  )
}
