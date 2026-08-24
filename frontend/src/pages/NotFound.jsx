import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 text-center">
      <p className="font-display text-6xl tracking-tight text-[var(--accent)]">404</p>
      <h1 className="mt-4 font-display text-xl">This page does not exist</h1>
      <p className="mt-2 max-w-sm text-sm text-[var(--muted)]">
        The link may be outdated, or the event has been taken off the афиша.
      </p>
      <Link
        to="/"
        className="mt-7 rounded-[var(--radius-sm)] bg-[var(--accent)] px-5 py-2.5 text-sm font-medium text-[var(--bg)] transition-all hover:brightness-110"
      >
        Back to events
      </Link>
    </div>
  )
}
