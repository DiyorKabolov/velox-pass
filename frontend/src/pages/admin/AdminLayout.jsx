import { NavLink } from 'react-router-dom'

const TABS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/events', label: 'Events' },
  { to: '/admin/users', label: 'Users' },
  { to: '/admin/tickets', label: 'Tickets' },
]

function tabClass({ isActive }) {
  return [
    'rounded-[var(--radius-sm)] px-3.5 py-1.5 text-sm transition-colors duration-150',
    isActive
      ? 'bg-[var(--surface2)] text-[var(--text)]'
      : 'text-[var(--muted)] hover:text-[var(--text)]',
  ].join(' ')
}

/** Shared shell for the admin screens: title, tab strip and content slot. */
export default function AdminLayout({ title, subtitle, children }) {
  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <header className="mb-8">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.24em] text-[var(--muted2)]">
          Administration
        </p>
        <h1 className="mt-2 font-display text-2xl tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>}
      </header>

      <nav className="mb-8 flex flex-wrap gap-1 border-b border-[var(--border)] pb-3">
        {TABS.map((tab) => (
          <NavLink key={tab.to} to={tab.to} end={tab.end} className={tabClass}>
            {tab.label}
          </NavLink>
        ))}
      </nav>

      {children}
    </div>
  )
}

/** Bordered wrapper that lets wide tables scroll on their own. */
export function TableShell({ children }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
      <table className="w-full min-w-[640px] text-left text-sm">{children}</table>
    </div>
  )
}

export function Th({ children, className = '' }) {
  return (
    <th
      className={`border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 font-mono2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] ${className}`}
    >
      {children}
    </th>
  )
}

export function Td({ children, className = '' }) {
  return (
    <td className={`border-b border-[var(--border)] px-4 py-3 ${className}`}>
      {children}
    </td>
  )
}
