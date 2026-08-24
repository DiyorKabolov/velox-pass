import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border)] bg-[var(--bg)]/92 backdrop-blur">
      <div className="mx-auto flex h-11 max-w-6xl items-center justify-between px-5 text-xs text-[var(--muted2)]">
        <span>© Velox Pass 2026</span>
        <div className="flex items-center gap-4">
          <Link to="/" className="transition-colors hover:text-[var(--muted)]">
            Events
          </Link>
          <Link to="/cabinet" className="transition-colors hover:text-[var(--muted)]">
            My tickets
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
