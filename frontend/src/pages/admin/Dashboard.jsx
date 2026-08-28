import { useQuery } from '@tanstack/react-query'
import { CalendarDays, CheckCircle2, Ticket, Users, Wallet } from 'lucide-react'
import { getAdminEvents, getStats } from '../../api/admin'
import { formatShortDate } from '../../utils/dates'
import AdminLayout, { TableShell, Td, Th } from './AdminLayout'

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <Icon size={15} className="text-[var(--accent)]" />
        <span className="font-mono2 text-[10px] uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <p className="mt-3 font-display text-2xl tracking-tight">{value}</p>
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
      value: (stats?.revenue ?? 0).toFixed(2),
    },
  ]

  return (
    <AdminLayout title="Сводка" subtitle="Ключевые показатели системы.">
      <div className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((card) => (
          <StatCard
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={isLoading ? '—' : card.value}
          />
        ))}
      </div>

      <h2 className="mb-4 font-display text-base">Последние мероприятия</h2>
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
              <Td className="text-right font-mono2 text-xs">
                {event.tickets_sold} / {event.capacity || '∞'}
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
