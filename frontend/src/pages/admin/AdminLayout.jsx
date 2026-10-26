import { useLocation } from 'react-router-dom'
import { CONTAINER, PageHeader } from '../../components/ui/Page'
import { RouteTabs } from '../../components/ui/Tabs'

const TABS = [
  { to: '/admin', label: 'Сводка', end: true },
  // Sessions used to be a tab of their own. They live inside this one now:
  // scheduling a showing always starts from the event it belongs to.
  { to: '/admin/events', label: 'Афиша' },
  { to: '/admin/venues', label: 'Площадки' },
  { to: '/admin/users', label: 'Пользователи' },
  { to: '/admin/tickets', label: 'Билеты' },
  { to: '/admin/pdf-templates', label: 'Шаблоны PDF' },
]

/**
 * Shared shell for the admin screens: title, tab strip and content slot.
 *
 * The tabs are separate routes, but the route transition treats them as one
 * screen (see RouteTransition), so the strip stays put and only what is under
 * it changes -- with the underline travelling to the new tab.
 */
export default function AdminLayout({ title, subtitle, action, children }) {
  const { pathname } = useLocation()

  return (
    <div className={`${CONTAINER} pt-10 sm:pt-14`}>
      <PageHeader
        kicker="Администрирование"
        title={title}
        size="md"
        lead={subtitle}
        actions={action}
        rule={false}
      />

      <RouteTabs className="mt-8" layoutId="admin-tab" items={TABS} />

      {/* Keyed by the address, so each tab's content arrives afresh. */}
      <div key={pathname} className="anim-rise pt-8" style={{ '--rise': '10px', '--delay': '50ms' }}>
        {children}
      </div>
    </div>
  )
}

/** Bordered wrapper that lets wide tables scroll on their own. */
export function TableShell({ children }) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
      <table className="w-full min-w-[640px] text-left text-[14px]">{children}</table>
    </div>
  )
}

export function Th({ children, className = '', ...props }) {
  return (
    <th
      className={`t-label border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 !font-semibold ${className}`}
      {...props}
    >
      {children}
    </th>
  )
}

export function Td({ children, className = '', ...props }) {
  return (
    <td className={`border-b border-[var(--border)] px-4 py-3.5 ${className}`} {...props}>
      {children}
    </td>
  )
}
