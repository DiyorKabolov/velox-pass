import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    // See .footer-surface in index.css. main carries pb-16 (64px) to keep
    // content clear of this bar, which is h-11 (44px) tall.
    <footer className="footer-surface fixed inset-x-0 bottom-0 z-30">
      <div className="mx-auto flex h-11 max-w-6xl items-center justify-between px-5 text-xs text-[var(--muted2)]">
        <span>© Velox Pass 2026</span>
        <div className="flex items-center gap-4">
          <Link to="/" className="transition-colors hover:text-[var(--muted)]">
            Афиша
          </Link>
          <Link to="/cabinet" className="transition-colors hover:text-[var(--muted)]">
            Мои билеты
          </Link>
          <a
            href="/docs"
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-[var(--muted)]"
          >
            API
          </a>
        </div>
      </div>
    </footer>
  )
}
