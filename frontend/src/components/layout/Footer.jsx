import { Link } from 'react-router-dom'
import Logo from './Logo'

const LINKS = [
  { to: '/', label: 'Афиша' },
  { to: '/venues', label: 'Площадки' },
  { to: '/cabinet', label: 'Мои билеты' },
]

/**
 * The page's foot, in the flow rather than pinned to the window: a bar fixed
 * to the bottom of the screen took 44px of every phone screen for a copyright
 * line, and every page had to pad itself to keep clear of it.
 */
export default function Footer() {
  return (
    <footer className="mt-24 border-t border-[var(--border)]">
      <div className="mx-auto grid max-w-[1240px] gap-8 px-4 py-10 sm:grid-cols-[1fr_auto] sm:items-end sm:px-6 lg:px-10">
        <div>
          <Logo className="text-[28px]" />
          <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-[var(--muted)]">
            Билеты в кино, театр и на концерты — с выбором места и QR-кодом на входе.
          </p>
        </div>

        <div className="flex flex-col gap-4 sm:items-end">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-[var(--muted)]">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="transition-colors duration-200 hover:text-[var(--text)]"
              >
                {link.label}
              </Link>
            ))}
            <a
              href="/docs"
              target="_blank"
              rel="noreferrer"
              className="transition-colors duration-200 hover:text-[var(--text)]"
            >
              API
            </a>
          </nav>
          <p className="text-[12px] text-[var(--muted2)]">© Velox Pass, 2026</p>
        </div>
      </div>
    </footer>
  )
}
