import { useEffect, useRef, useState } from 'react'
import { ChevronDown, LogOut, Ticket, User, Users } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Link, useLocation } from 'react-router-dom'
import Avatar from '../ui/Avatar'
import { EASE_OUT } from '../motion/Motion'

const ITEMS = [
  { to: '/profile', label: 'Профиль', icon: User },
  { to: '/cabinet', label: 'Мои билеты', icon: Ticket },
  { to: '/cabinet?tab=friends', label: 'Друзья', icon: Users },
]

/** The signed-in user's name, opening onto their own pages and sign-out. */
export default function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  const location = useLocation()

  // Any navigation closes it -- by the history entry, not the path: going
  // from /cabinet to /cabinet?tab=friends keeps the path and would have left
  // it open over the page. So does a click outside or Escape.
  useEffect(() => setOpen(false), [location.key])
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
        className="flex items-center gap-2 rounded-[var(--radius-sm)] py-1 pl-1 pr-1.5 text-[14px] text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
      >
        <Avatar username={user?.username} src={user?.avatar_url} size={28} />
        <span className="hidden max-w-[140px] truncate md:inline">{user?.username}</span>
        <ChevronDown
          size={14}
          className={`transition-transform duration-300 ease-out ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: -4, transition: { duration: 0.12 } }}
            className="absolute right-0 top-[calc(100%+12px)] z-50 w-56 overflow-hidden rounded-[var(--radius)] border border-[var(--border2)] bg-[var(--surface2)] py-1.5 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.75)]"
          >
            <div className="border-b border-[var(--border)] px-4 pb-2.5 pt-1.5">
              <p className="truncate text-[14px] text-[var(--text)]">{user?.username}</p>
              <p className="truncate text-[12px] text-[var(--muted2)]">{user?.email}</p>
            </div>
            <div className="py-1">
              {ITEMS.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2 text-[14px] text-[var(--text)] transition-colors duration-150 hover:bg-[var(--surface3)]"
                >
                  <item.icon size={15} strokeWidth={1.75} className="text-[var(--muted)]" />
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="border-t border-[var(--border)] pt-1">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onLogout()
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left text-[14px] text-[var(--muted)] transition-colors duration-150 hover:bg-[var(--surface3)] hover:text-[var(--text)]"
              >
                <LogOut size={15} strokeWidth={1.75} />
                Выйти
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
