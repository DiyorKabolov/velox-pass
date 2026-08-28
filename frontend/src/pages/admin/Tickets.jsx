import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAllTickets } from '../../api/admin'
import { formatDate, isExpired } from '../../utils/dates'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import AdminLayout, { TableShell, Td, Th } from './AdminLayout'

function ticketState(ticket) {
  if (ticket.used) return 'used'
  if (isExpired(ticket.event_date)) return 'expired'
  return 'ok'
}

export default function Tickets() {
  const [query, setQuery] = useState('')
  const { data: tickets, isLoading } = useQuery({
    queryKey: ['admin', 'tickets'],
    queryFn: getAllTickets,
  })

  const filtered = useMemo(() => {
    if (!tickets) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return tickets
    return tickets.filter(
      (ticket) =>
        ticket.ticket_id.toLowerCase().includes(needle) ||
        (ticket.event_title ?? '').toLowerCase().includes(needle),
    )
  }, [tickets, query])

  return (
    <AdminLayout
      title="Билеты"
      subtitle={`Всего выдано: ${tickets?.length ?? 0}.`}
    >
      <div className="mb-5 max-w-xs">
        <Input
          name="search"
          placeholder="Поиск по ID билета или мероприятию…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-[var(--radius)] bg-[var(--surface)]" />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>ID билета</Th>
              <Th>Мероприятие</Th>
              <Th>Место</Th>
              <Th>Выдан</Th>
              <Th className="text-right">Цена</Th>
              <Th className="text-right">Статус</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-[var(--surface)]">
                <Td className="font-mono2 text-xs">{ticket.ticket_id}</Td>
                <Td>{ticket.event_title ?? '—'}</Td>
                <Td className="text-[var(--muted)]">{ticket.seat_label ?? '—'}</Td>
                <Td className="text-xs text-[var(--muted)]">
                  {formatDate(ticket.created_at)}
                </Td>
                <Td className="text-right font-mono2 text-xs">
                  {Number(ticket.price_paid).toFixed(2)}
                </Td>
                <Td>
                  <div className="flex justify-end">
                    <Badge tone={ticketState(ticket)}>{ticketState(ticket)}</Badge>
                  </div>
                </Td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <Td className="text-center text-[var(--muted)]" colSpan={6}>
                  {query ? 'Ничего не найдено.' : 'Билетов пока нет.'}
                </Td>
              </tr>
            )}
          </tbody>
        </TableShell>
      )}
    </AdminLayout>
  )
}
