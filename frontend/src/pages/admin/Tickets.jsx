import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ChevronRight, Clock, Ticket as TicketIcon, XCircle } from 'lucide-react'
import { getAllTickets, getUsers } from '../../api/admin'
import { formatDate } from '../../utils/dates'
import { pluralize } from '../../utils/plural'
import {
  buyersById,
  countStates,
  formatPrice,
  groupByEvent,
  matchesTicket,
  STATE_LABELS,
  ticketState,
} from '../../utils/ticketGroups'
import Badge from '../../components/ui/Badge'
import Input from '../../components/ui/Input'
import AdminLayout, { TableShell, Td, Th } from './AdminLayout'

function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <Icon size={18} style={{ color }} className="shrink-0" />
      <div className="min-w-0">
        <p className="font-mono2 text-lg leading-none text-[var(--text)]">{value}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
      </div>
    </div>
  )
}

/** Buyer name with the email beneath it, or a dash before the users load. */
function Buyer({ buyer }) {
  if (!buyer) return <span className="text-[var(--muted2)]">—</span>
  return (
    <div className="min-w-0">
      <p className="truncate text-[var(--text)]">{buyer.username}</p>
      <p className="truncate text-xs text-[var(--muted2)]">{buyer.email}</p>
    </div>
  )
}

function StateBadge({ ticket }) {
  const state = ticketState(ticket)
  return <Badge tone={state}>{STATE_LABELS[state]}</Badge>
}

/** The row shape shared by the grouped tables and the flat search results. */
function TicketRow({ ticket, buyer, showEvent = false }) {
  return (
    <tr className="hover:bg-[var(--surface)]">
      <Td className="font-mono2 text-xs">{ticket.ticket_id}</Td>
      {showEvent && <Td>{ticket.event_title ?? '—'}</Td>}
      <Td>
        <Buyer buyer={buyer} />
      </Td>
      <Td className="text-[var(--muted)]">{ticket.seat_label ?? '—'}</Td>
      <Td className="text-xs text-[var(--muted)]">{formatDate(ticket.created_at)}</Td>
      <Td className="text-right font-mono2 text-xs">{formatPrice(ticket.price_paid)}</Td>
      <Td>
        <div className="flex justify-end">
          <StateBadge ticket={ticket} />
        </div>
      </Td>
    </tr>
  )
}

function TicketTable({ tickets, buyers, showEvent = false }) {
  return (
    <TableShell>
      <thead>
        <tr>
          <Th>ID билета</Th>
          {showEvent && <Th>Мероприятие</Th>}
          <Th>Покупатель</Th>
          <Th>Место</Th>
          <Th>Получен</Th>
          <Th className="text-right">Цена</Th>
          <Th className="text-right">Статус</Th>
        </tr>
      </thead>
      <tbody>
        {tickets.map((ticket) => (
          <TicketRow
            key={ticket.id}
            ticket={ticket}
            buyer={buyers.get(ticket.user_id)}
            showEvent={showEvent}
          />
        ))}
      </tbody>
    </TableShell>
  )
}

function EventGroup({ group, buyers, open, onToggle }) {
  return (
    <section className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)]">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3 bg-[var(--surface)] px-4 py-3 text-left transition-colors duration-150 hover:bg-[var(--surface2)]"
      >
        <ChevronRight
          size={16}
          className={`shrink-0 text-[var(--muted)] transition-transform duration-200 ${
            open ? 'rotate-90' : ''
          }`}
        />
        <span
          aria-hidden
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: group.accent }}
        />

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[var(--text)]">{group.title}</span>
          <span className="block truncate text-xs text-[var(--muted2)]">
            {group.date ? formatDate(group.date) : 'Дата не указана'}
          </span>
        </span>

        <span className="hidden shrink-0 items-center gap-3 font-mono2 text-[11px] sm:flex">
          <span className="text-[var(--ok)]">✓ {group.stats.ok}</span>
          <span className="text-[var(--err)]">✗ {group.stats.used}</span>
          {group.stats.expired > 0 && (
            <span className="text-[var(--muted)]">⏱ {group.stats.expired}</span>
          )}
        </span>

        <span className="shrink-0 rounded-full border border-[var(--border2)] px-2.5 py-1 font-mono2 text-[10px] text-[var(--muted)]">
          {pluralize(group.stats.total, 'билет', 'билета', 'билетов')}
        </span>
      </button>

      {open && (
        <div className="border-t border-[var(--border)]">
          <TicketTable tickets={group.tickets} buyers={buyers} />
        </div>
      )}
    </section>
  )
}

export default function Tickets() {
  const [query, setQuery] = useState('')
  const [openIds, setOpenIds] = useState(() => new Set())

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['admin', 'tickets'],
    queryFn: getAllTickets,
  })
  // Only for the buyer column: the ticket payload carries user_id alone.
  const { data: users } = useQuery({ queryKey: ['admin', 'users'], queryFn: getUsers })

  const buyers = useMemo(() => buyersById(users), [users])
  const stats = useMemo(() => countStates(tickets), [tickets])
  const groups = useMemo(() => groupByEvent(tickets), [tickets])

  const searching = query.trim().length > 0
  const found = useMemo(() => {
    if (!searching) return []
    return (tickets ?? []).filter((ticket) =>
      matchesTicket(ticket, buyers.get(ticket.user_id), query),
    )
  }, [tickets, buyers, query, searching])

  const toggle = (eventId) =>
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(eventId)) next.delete(eventId)
      else next.add(eventId)
      return next
    })

  return (
    <AdminLayout title="Билеты" subtitle="Билеты, сгруппированные по мероприятиям.">
      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={TicketIcon}
          label="Всего билетов"
          value={stats.total}
          color="var(--accent)"
        />
        <Stat icon={CheckCircle2} label="Активных" value={stats.ok} color="var(--ok)" />
        <Stat icon={XCircle} label="Использовано" value={stats.used} color="var(--err)" />
        <Stat icon={Clock} label="Истекло" value={stats.expired} color="var(--muted)" />
      </div>

      <div className="mb-5 max-w-sm">
        <Input
          name="search"
          placeholder="Поиск по ID билета или покупателю…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="h-48 animate-pulse rounded-[var(--radius)] bg-[var(--surface)]" />
      ) : searching ? (
        // A search cuts across events, so the grouping is dropped and the event
        // is shown as a column instead.
        found.length ? (
          <TicketTable tickets={found} buyers={buyers} showEvent />
        ) : (
          <p className="py-10 text-center text-sm text-[var(--muted)]">
            Ничего не найдено.
          </p>
        )
      ) : groups.length ? (
        <div className="space-y-3">
          {groups.map((group) => (
            <EventGroup
              key={group.eventId}
              group={group}
              buyers={buyers}
              open={openIds.has(group.eventId)}
              onToggle={() => toggle(group.eventId)}
            />
          ))}
        </div>
      ) : (
        <p className="py-10 text-center text-sm text-[var(--muted)]">Билетов пока нет.</p>
      )}
    </AdminLayout>
  )
}
