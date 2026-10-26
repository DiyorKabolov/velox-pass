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
import { AnimatedNumber } from '../../components/motion/Motion'
import AdminLayout, { TableShell, Td, Th } from './AdminLayout'

/** A figure under a rule; `color` marks only the icon beside its label. */
function Stat({ icon: Icon, label, value, color }) {
  return (
    <div className="border-t border-[var(--border)] pt-4">
      <p className="t-label flex items-center gap-2">
        <Icon size={14} strokeWidth={1.75} style={{ color }} className="shrink-0" />
        {label}
      </p>
      <p className="t-poster mt-3 text-[clamp(36px,4vw,52px)] text-[var(--text)]">
        <AnimatedNumber value={value} />
      </p>
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
          <span className="block truncate font-display text-[17px] font-bold uppercase leading-tight text-[var(--text)]">
            {group.title}
          </span>
          <span className="block truncate text-xs text-[var(--muted2)]">
            {group.date ? formatDate(group.date) : 'Дата не указана'}
          </span>
        </span>

        <span className="t-num hidden shrink-0 items-center gap-4 text-[12px] text-[var(--muted)] sm:flex">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />
            активных {group.stats.ok}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--muted2)]" />
            погашено {group.stats.used}
          </span>
          {group.stats.expired > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full border border-[var(--muted2)]" />
              истекло {group.stats.expired}
            </span>
          )}
        </span>

        <span className="shrink-0 rounded-[3px] border border-[var(--border2)] px-2.5 py-1 font-mono2 text-[10px] text-[var(--muted)]">
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
      <div className="mb-10 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="h-48 skeleton rounded-[var(--radius)]" />
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
