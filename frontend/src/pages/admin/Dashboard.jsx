import { useQuery } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, Ticket, Users, Wallet } from 'lucide-react'
import { getAdminEvents, getStats } from '../../api/admin'
import { formatShortDate } from '../../utils/dates'
import { capacityLabel, sessionsLabel } from '../../utils/capacity'
import { SectionHead } from '../../components/ui/Page'
import { AnimatedNumber } from '../../components/motion/Motion'
import AdminLayout, { TableShell, Td, Th } from './AdminLayout'

// Money keeps its kopecks (дирамы) when it has them, and drops ",00" when not.
const money = (n) => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })

/**
 * A figure under a rule, the way a report prints its key numbers. A unit, if
 * any, is set small after the figure, so the figure itself stays as large as
 * its neighbours.
 */
function StatCard({ icon: Icon, label, value, unit, format }) {
  return (
    <div className="border-t border-[var(--border)] pt-4">
      <p className="t-label flex items-center gap-2">
        <Icon size={14} strokeWidth={1.75} className="text-[var(--muted2)]" />
        {label}
      </p>
      <p className="t-poster mt-3 text-[clamp(40px,4.6vw,60px)] text-[var(--text)]">
        <AnimatedNumber value={value} format={format} />
        {unit && (
          <span className="ml-[0.18em] text-[0.36em] text-[var(--muted)]">{unit}</span>
        )}
      </p>
    </div>
  )
}

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: getStats,
  })
  const { data: events } = useQuery({
    queryKey: ['admin', 'events'],
    queryFn: getAdminEvents,
  })

  const cards = [
    { icon: Users, label: 'Пользователи', value: stats?.users ?? 0 },
    { icon: CalendarDays, label: 'Мероприятия', value: stats?.events ?? 0 },
    { icon: Ticket, label: 'Билеты', value: stats?.tickets ?? 0 },
    { icon: CheckCircle2, label: 'Проверено', value: stats?.tickets_used ?? 0 },
    {
      icon: Wallet,
      label: 'Выручка',
      // A number, not a string from toFixed: a string was printed as it came,
      // without a currency, and never counted up like the rest.
      value: Number(stats?.revenue ?? 0),
      format: money,
      unit: 'сомони',
    },
  ]

  return (
    <AdminLayout title="Сводка" subtitle="Ключевые показатели системы.">
      <div className="mb-14 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <StatCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={isLoading ? '—' : card.value}
            format={card.format}
            unit={isLoading ? null : card.unit}
          />
        ))}
      </div>

      <SectionHead title="Последние мероприятия" className="mb-6" />
      <TableShell>
        <thead>
          <tr>
            <Th>Название</Th>
            <Th>Дата</Th>
            <Th>Место</Th>
            <Th className="text-right">Продано</Th>
          </tr>
        </thead>
        <tbody>
          {events?.slice(0, 10).map((event) => (
            <tr key={event.id} className="hover:bg-[var(--surface)]">
              <Td>{event.title}</Td>
              <Td className="font-mono2 text-xs text-[var(--muted)]">
                {formatShortDate(event.date)}
              </Td>
              <Td className="text-[var(--muted)]">{event.location || '—'}</Td>
              <Td className="text-right font-mono2 text-xs whitespace-nowrap">
                {/* Left of the pair, so "продано / всего" stays one figure. */}
                {event.has_seats && sessionsLabel(event) && (
                  <span className="mr-2 text-[10px] text-[var(--muted2)]">
                    {sessionsLabel(event)}
                  </span>
                )}
                {capacityLabel(event)}
              </Td>
            </tr>
          ))}
          {events?.length === 0 && (
            <tr>
              <Td className="text-center text-[var(--muted)]" colSpan={4}>
                Мероприятий пока нет.
              </Td>
            </tr>
          )}
        </tbody>
      </TableShell>
    </AdminLayout>
  )
}
