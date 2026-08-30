import { useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  CheckCircle2,
  Grid3x3,
  Plus,
  Ticket as TicketIcon,
  Users,
  Wallet,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { apiError } from '../api/client'
import {
  getMyEvents,
  getMyRecentTickets,
  getMySessions,
  getMyStaff,
  getMyStats,
  getMyVenues,
} from '../api/venueAdmin'
import { createSession, deleteSession } from '../api/sessions'
import { getHall, getVenueHalls } from '../api/venues'
import { formatDate, formatDateTime, isExpired } from '../utils/dates'
import { formatPrice, ticketState, STATE_LABELS } from '../utils/ticketGroups'
import { pluralize } from '../utils/plural'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import SeatMap from '../components/seats/SeatMap'
import Modal from '../components/ui/Modal'
import { RoleBadge } from '../components/admin/VenueStaff'

const TABS = [
  { key: 'events', label: 'Мероприятия' },
  { key: 'halls', label: 'Залы' },
  { key: 'sessions', label: 'Сеансы' },
  { key: 'staff', label: 'Персонал' },
  { key: 'stats', label: 'Статистика' },
]

const PRICE_CATEGORIES = [
  { key: 'standard', label: 'Стандарт' },
  { key: 'vip', label: 'VIP' },
  { key: 'balcony', label: 'Балкон' },
]

function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={[
        'rounded-[var(--radius-sm)] px-3.5 py-1.5 text-sm transition-colors duration-150',
        active
          ? 'bg-[var(--surface2)] text-[var(--text)]'
          : 'text-[var(--muted)] hover:text-[var(--text)]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function Panel({ children, className = '' }) {
  return (
    <div
      className={`rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] ${className}`}
    >
      {children}
    </div>
  )
}

function Empty({ children }) {
  return <p className="px-4 py-8 text-center text-sm text-[var(--muted)]">{children}</p>
}

function Stat({ icon: Icon, label, value, color }) {
  return (
    <Panel className="flex items-center gap-3 px-4 py-3">
      <Icon size={18} style={{ color }} className="shrink-0" />
      <div className="min-w-0">
        <p className="font-mono2 text-lg leading-none text-[var(--text)]">{value}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
      </div>
    </Panel>
  )
}

// --- tabs -----------------------------------------------------------------

function EventsTab({ events, isLoading }) {
  if (isLoading) return <Panel className="h-40 animate-pulse" />
  if (!events?.length) {
    return (
      <Panel>
        <Empty>
          На ваших площадках пока нет мероприятий. Они появляются здесь, когда для
          мероприятия назначен сеанс в одном из ваших залов.
        </Empty>
      </Panel>
    )
  }

  return (
    <div className="space-y-2">
      {events.map((event) => {
        const past = isExpired(event.date)
        const total = event.total_seats ?? event.capacity ?? 0
        const sold = Math.max(total - (event.available_seats ?? 0), 0)
        return (
          <Panel key={event.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Link
                to={`/event/${event.id}`}
                className="block truncate text-sm text-[var(--text)] transition-colors hover:text-[var(--accent)]"
              >
                {event.title}
              </Link>
              <p className="mt-0.5 text-xs text-[var(--muted2)]">{formatDate(event.date)}</p>
            </div>
            <span className="shrink-0 font-mono2 text-xs text-[var(--muted)]">
              {total ? `${sold} / ${total}` : '—'}
            </span>
            <Badge tone={past ? 'expired' : 'ok'}>{past ? 'Завершено' : 'В продаже'}</Badge>
          </Panel>
        )
      })}
    </div>
  )
}

function HallsTab({ venues }) {
  const [viewing, setViewing] = useState(null)

  // One request per venue; a venue admin holds one or two, not dozens.
  const hallQueries = useQueries({
    queries: (venues ?? []).map((venue) => ({
      queryKey: ['venues', venue.id, 'halls'],
      queryFn: () => getVenueHalls(venue.id),
    })),
  })

  const { data: hall } = useQuery({
    queryKey: ['halls', viewing],
    queryFn: () => getHall(viewing),
    enabled: Boolean(viewing),
  })

  if (hallQueries.some((q) => q.isLoading)) return <Panel className="h-40 animate-pulse" />

  const rows = (venues ?? []).flatMap((venue, index) =>
    (hallQueries[index]?.data ?? []).map((item) => ({ ...item, venueName: venue.name })),
  )

  if (!rows.length) {
    return (
      <Panel>
        <Empty>Залов пока нет. Их создаёт суперадмин.</Empty>
      </Panel>
    )
  }

  return (
    <>
      <div className="space-y-2">
        {rows.map((item) => (
          <Panel key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <Grid3x3 size={15} className="shrink-0 text-[var(--accent)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{item.name}</p>
              <p className="mt-0.5 text-xs text-[var(--muted2)]">{item.venueName}</p>
            </div>
            <span className="shrink-0 font-mono2 text-xs text-[var(--muted)]">
              {item.rows}×{item.cols} · {pluralize(item.seats_count, 'место', 'места', 'мест')}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setViewing(item.id)}>
              Схема
            </Button>
          </Panel>
        ))}
      </div>

      <Modal
        open={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title={hall?.name ?? 'Схема зала'}
        subtitle="Только просмотр — схему меняет суперадмин"
      >
        {hall ? (
          <SeatMap seats={hall.seats ?? []} mode="view" />
        ) : (
          <p className="py-8 text-center text-sm text-[var(--muted)]">Загрузка схемы…</p>
        )}
      </Modal>
    </>
  )
}

function SessionsTab({ venues, events }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(null)

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['venue-admin', 'sessions'],
    queryFn: getMySessions,
  })

  const { data: halls } = useQuery({
    queryKey: ['venues', form?.venueId, 'halls'],
    queryFn: () => getVenueHalls(form.venueId),
    enabled: Boolean(form?.venueId),
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['venue-admin'] })
    queryClient.invalidateQueries({ queryKey: ['events'] })
  }

  const add = useMutation({
    mutationFn: createSession,
    onSuccess: () => {
      refresh()
      setForm(null)
      toast.success('Сеанс создан')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось создать сеанс')),
  })

  const cancel = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      refresh()
      toast.success('Сеанс отменён')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось отменить сеанс')),
  })

  const submit = () => {
    if (!form.eventId) return toast.error('Выберите мероприятие')
    if (!form.hallId) return toast.error('Выберите зал')
    if (!form.datetime) return toast.error('Укажите дату и время')
    add.mutate({
      event_id: Number(form.eventId),
      hall_id: Number(form.hallId),
      datetime: new Date(form.datetime).toISOString(),
      prices: PRICE_CATEGORIES.map(({ key }) => ({
        category: key,
        price: Number(form.prices[key]) || 0,
      })),
    })
  }

  return (
    <div className="space-y-4">
      {form ? (
        <Panel className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Мероприятие
              </span>
              <Select
                value={form.eventId}
                onChange={(eventId) => setForm({ ...form, eventId })}
                placeholder="— выберите —"
                options={(events ?? []).map((event) => ({
                  value: String(event.id),
                  label: event.title,
                }))}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Площадка
              </span>
              <Select
                value={form.venueId}
                onChange={(venueId) => setForm({ ...form, venueId, hallId: '' })}
                placeholder="— выберите —"
                options={(venues ?? []).map((venue) => ({
                  value: String(venue.id),
                  label: venue.name,
                }))}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Зал
              </span>
              <Select
                value={form.hallId}
                disabled={!form.venueId}
                onChange={(hallId) => setForm({ ...form, hallId })}
                placeholder="— выберите —"
                options={(halls ?? []).map((hall) => ({
                  value: String(hall.id),
                  label: `${hall.name} (${hall.seats_count})`,
                }))}
              />
            </label>
            <Input
              label="Дата и время"
              name="datetime"
              type="datetime-local"
              value={form.datetime}
              onChange={(event) => setForm({ ...form, datetime: event.target.value })}
            />
          </div>

          <div>
            <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              Цены по категориям
            </span>
            <div className="grid gap-3 sm:grid-cols-3">
              {PRICE_CATEGORIES.map(({ key, label }) => (
                <Input
                  key={key}
                  label={label}
                  name={`price-${key}`}
                  type="number"
                  min={0}
                  value={form.prices[key]}
                  onChange={(event) =>
                    setForm({
                      ...form,
                      prices: { ...form.prices, [key]: event.target.value },
                    })
                  }
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setForm(null)}>
              Отмена
            </Button>
            <Button loading={add.isPending} onClick={submit}>
              Создать сеанс
            </Button>
          </div>
        </Panel>
      ) : (
        <Button
          variant="ghost"
          onClick={() =>
            setForm({
              eventId: '',
              venueId: venues?.length === 1 ? String(venues[0].id) : '',
              hallId: '',
              datetime: '',
              prices: { standard: 500, vip: 1500, balcony: 300 },
            })
          }
        >
          <Plus size={14} />
          Новый сеанс
        </Button>
      )}

      {isLoading ? (
        <Panel className="h-40 animate-pulse" />
      ) : sessions?.length ? (
        <div className="space-y-2">
          {sessions.map((session) => (
            <Panel key={session.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{session.event_title}</p>
                <p className="mt-0.5 text-xs text-[var(--muted2)]">
                  {session.hall_name ?? 'Зал не указан'} · {formatDateTime(session.datetime)}
                </p>
              </div>
              <span className="shrink-0 font-mono2 text-xs text-[var(--muted)]">
                {session.seats_free} / {session.seats_total}
              </span>
              <Button
                size="sm"
                variant="danger"
                loading={cancel.isPending}
                onClick={() => {
                  if (window.confirm(`Отменить сеанс «${session.event_title}»?`)) {
                    cancel.mutate(session.id)
                  }
                }}
              >
                Отменить
              </Button>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <Empty>Сеансов пока нет.</Empty>
        </Panel>
      )}
    </div>
  )
}

function StaffTab() {
  // Its own endpoint, not the admin one: /api/admin/* is superadmin-only, so
  // asking it for this venue's staff comes back 403. Already scanners only.
  const { data: rows, isLoading } = useQuery({
    queryKey: ['venue-admin', 'staff'],
    queryFn: getMyStaff,
  })

  if (isLoading) return <Panel className="h-32 animate-pulse" />

  return (
    <>
      <p className="mb-3 text-sm text-[var(--muted)]">
        Сканеры ваших площадок. Назначает и снимает их суперадмин.
      </p>
      {rows?.length ? (
        <div className="space-y-2">
          {rows.map((person) => (
            <Panel
              key={`${person.venue_name}-${person.user_id}`}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{person.username}</p>
                <p className="mt-0.5 truncate text-xs text-[var(--muted2)]">{person.email}</p>
              </div>
              <span className="shrink-0 text-xs text-[var(--muted2)]">
                {person.venue_name}
              </span>
              <RoleBadge role="scanner" />
            </Panel>
          ))}
        </div>
      ) : (
        <Panel>
          <Empty>Сканеры не назначены.</Empty>
        </Panel>
      )}
    </>
  )
}

function StatsTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['venue-admin', 'stats'],
    queryFn: getMyStats,
  })
  const { data: tickets } = useQuery({
    queryKey: ['venue-admin', 'tickets'],
    queryFn: () => getMyRecentTickets(20),
  })

  if (isLoading) return <Panel className="h-40 animate-pulse" />

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={TicketIcon}
          label="Билетов продано"
          value={stats?.total_tickets ?? 0}
          color="var(--accent)"
        />
        <Stat
          icon={CheckCircle2}
          label="Использовано"
          value={stats?.used_tickets ?? 0}
          color="var(--ok)"
        />
        <Stat
          icon={CalendarDays}
          label="Активных мероприятий"
          value={stats?.active_events ?? 0}
          color="var(--warn)"
        />
        <Stat
          icon={Wallet}
          label="Выручка"
          value={formatPrice(stats?.revenue ?? 0)}
          color="var(--ok)"
        />
      </div>

      <div>
        <p className="mb-3 font-mono2 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Последние билеты
        </p>
        {tickets?.length ? (
          <div className="space-y-2">
            {tickets.map((ticket) => {
              const state = ticketState(ticket)
              return (
                <Panel
                  key={ticket.id}
                  className="flex flex-wrap items-center gap-3 px-4 py-2.5"
                >
                  <span className="shrink-0 font-mono2 text-xs">{ticket.ticket_id}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">
                    {ticket.event_title}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--muted2)]">
                    {ticket.seat_label ?? '—'}
                  </span>
                  <span className="shrink-0 font-mono2 text-xs">
                    {formatPrice(ticket.price_paid)}
                  </span>
                  <Badge tone={state}>{STATE_LABELS[state]}</Badge>
                </Panel>
              )
            })}
          </div>
        ) : (
          <Panel>
            <Empty>Билетов пока нет.</Empty>
          </Panel>
        )}
      </div>
    </div>
  )
}

export default function VenueAdminPanel() {
  const [tab, setTab] = useState('events')

  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: getMyVenues })
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['venue-admin', 'events'],
    queryFn: getMyEvents,
  })

  const subtitle = useMemo(() => {
    if (!venues?.length) return 'Площадка вам ещё не назначена.'
    if (venues.length === 1) return venues[0].name
    return venues.map((venue) => venue.name).join(' · ')
  }, [venues])

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <header className="mb-8">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.24em] text-[var(--muted2)]">
          Площадка
        </p>
        <h1 className="mt-2 font-display text-2xl tracking-tight">Моя площадка</h1>
        <p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]">
          <Users size={14} className="shrink-0 opacity-70" />
          {subtitle}
        </p>
      </header>

      <nav
        role="tablist"
        className="mb-8 flex flex-wrap gap-1 border-b border-[var(--border)] pb-3"
      >
        {TABS.map((item) => (
          <Tab key={item.key} active={tab === item.key} onClick={() => setTab(item.key)}>
            {item.label}
          </Tab>
        ))}
      </nav>

      {tab === 'events' && <EventsTab events={events} isLoading={eventsLoading} />}
      {tab === 'halls' && <HallsTab venues={venues} />}
      {tab === 'sessions' && <SessionsTab venues={venues} events={events} />}
      {tab === 'staff' && <StaffTab />}
      {tab === 'stats' && <StatsTab />}
    </div>
  )
}
