import { useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  Grid3x3,
  Pencil,
  Plus,
  Ticket as TicketIcon,
  Trash2,
  Users,
  Wallet,
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { apiError } from '../api/client'
import { deleteEvent, deleteEventImage, updateEvent, uploadEventImage } from '../api/events'
import {
  getMyEvents,
  getMyRecentTickets,
  getMySessions,
  getMyStaff,
  getMyStats,
  getMyVenues,
} from '../api/venueAdmin'
import { getHall, getVenueHalls } from '../api/venues'
import { formatDate, formatDateTime, formatSessionStamp, isExpired } from '../utils/dates'
import { isEventOver } from '../utils/eventState'
import { formatPrice, ticketState, STATE_LABELS } from '../utils/ticketGroups'
import { pluralize } from '../utils/plural'
import { capacityLabel, sessionsLabel } from '../utils/capacity'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import SeatMap from '../components/seats/SeatMap'
import Modal from '../components/ui/Modal'
import { RoleBadge } from '../components/admin/VenueStaff'
import EventEditor from '../components/admin/EventEditor'
import SessionDialog from '../components/admin/SessionDialog'
import SessionsByDate from '../components/admin/SessionsByDate'
import { emptySessionForm } from '../components/admin/sessionForm'
import { toFormValue, toPayload, validate } from '../components/admin/eventForm'

const TABS = [
  { key: 'overview', label: 'Сводка' },
  { key: 'events', label: 'Мероприятия' },
  { key: 'sessions', label: 'Сеансы' },
  { key: 'halls', label: 'Залы' },
  { key: 'staff', label: 'Персонал' },
]

const NEW_EVENT_PATH = '/venue-admin/events/new'

/** Everything a change to an event or its showings can make stale. */
function useRefresh() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['venue-admin'] })
    queryClient.invalidateQueries({ queryKey: ['events'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
  }
}

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
  const navigate = useNavigate()
  const refresh = useRefresh()
  // null = closed; otherwise the event being edited and its form.
  const [editing, setEditing] = useState(null)

  const save = useMutation({
    mutationFn: async ({ id, payload, imageFile, imageCleared }) => {
      await updateEvent(id, payload)
      if (imageFile) await uploadEventImage(id, imageFile)
      else if (imageCleared) await deleteEventImage(id)
    },
    onSuccess: () => {
      refresh()
      setEditing(null)
      toast.success('Мероприятие обновлено')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось обновить мероприятие')),
  })

  const remove = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      refresh()
      toast.success('Мероприятие удалено')
    },
    // The server says why when it refuses -- most often that the event also
    // runs at a venue this administrator does not hold -- so that is shown.
    onError: (error) => toast.error(apiError(error, 'Не удалось удалить мероприятие')),
  })

  const handleSave = () => {
    const problem = validate(editing.form)
    if (problem) {
      toast.error(problem)
      return
    }
    save.mutate({
      id: editing.id,
      payload: toPayload(editing.form),
      imageFile: editing.form.image_file,
      imageCleared: Boolean(editing.original?.image_url) && !editing.form.image_url,
    })
  }

  const header = (
    <div className="mb-4 flex justify-end">
      <Button onClick={() => navigate(NEW_EVENT_PATH)}>
        <Plus size={15} />
        Новое мероприятие
      </Button>
    </div>
  )

  if (isLoading) return <Panel className="h-40 animate-pulse" />
  if (!events?.length) {
    return (
      <>
        {header}
        <Panel>
          <Empty>На ваших площадках пока нет мероприятий.</Empty>
        </Panel>
      </>
    )
  }

  return (
    <>
      {header}
      <div className="space-y-2">
        {events.map((event) => {
          const past = isEventOver(event)
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
              <span className="shrink-0 whitespace-nowrap font-mono2 text-xs text-[var(--muted)]">
                {event.has_seats && sessionsLabel(event) && (
                  <span className="mr-2 text-[10px] text-[var(--muted2)]">
                    {sessionsLabel(event)}
                  </span>
                )}
                {capacityLabel(event)}
              </span>
              <Badge tone={past ? 'expired' : 'ok'}>{past ? 'Завершено' : 'В продаже'}</Badge>
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={`Редактировать ${event.title}`}
                  onClick={() =>
                    setEditing({ id: event.id, original: event, form: toFormValue(event) })
                  }
                >
                  <Pencil size={13} />
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  aria-label={`Удалить ${event.title}`}
                  loading={remove.isPending && remove.variables === event.id}
                  onClick={() => {
                    if (window.confirm(`Удалить «${event.title}»? Это действие нельзя отменить.`)) {
                      remove.mutate(event.id)
                    }
                  }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </Panel>
          )
        })}
      </div>

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Редактировать мероприятие"
        subtitle={editing?.form.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Отмена
            </Button>
            <Button onClick={handleSave} loading={save.isPending}>
              Сохранить
            </Button>
          </>
        }
      >
        {editing && (
          <EventEditor
            form={editing.form}
            onChange={(form) => setEditing((current) => ({ ...current, form }))}
          />
        )}
      </Modal>
    </>
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

function SessionsTab({ events, isLoading }) {
  // null = closed; otherwise the session form. The event list is the
  // administrator's own, so the dialog cannot offer anyone else's.
  const [form, setForm] = useState(null)

  if (isLoading) return <Panel className="h-40 animate-pulse" />

  return (
    <>
      <div className="mb-4 flex justify-end">
        <Button
          variant="ghost"
          disabled={!events?.length}
          onClick={() => setForm(emptySessionForm())}
        >
          <CalendarPlus size={15} />
          Новый сеанс
        </Button>
      </div>

      {events?.length ? (
        <SessionsByDate events={events} />
      ) : (
        <Panel>
          <Empty>Сначала создайте мероприятие — сеансы назначаются ему.</Empty>
        </Panel>
      )}

      {form && (
        <SessionDialog
          form={form}
          events={events}
          onChange={setForm}
          onClose={() => setForm(null)}
        />
      )}
    </>
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

/**
 * The dashboard. With more than one venue a switcher narrows every figure on
 * it to one of them; "Все мои площадки" puts them back together.
 */
function OverviewTab({ venues, events }) {
  const [selected, setSelected] = useState('all')

  const { data: stats, isLoading } = useQuery({
    queryKey: ['venue-admin', 'stats'],
    queryFn: getMyStats,
  })
  const { data: sessions } = useQuery({
    queryKey: ['venue-admin', 'sessions'],
    queryFn: getMySessions,
  })
  const { data: tickets } = useQuery({
    queryKey: ['venue-admin', 'tickets'],
    queryFn: () => getMyRecentTickets(10),
  })

  if (isLoading) return <Panel className="h-40 animate-pulse" />

  const breakdown = stats?.venues ?? []
  const several = breakdown.length > 1
  const current = several && selected !== 'all' ? selected : 'all'
  const figures =
    current === 'all' ? stats?.totals : breakdown.find((row) => row.venue_id === current)
  const currentName = venues?.find((venue) => venue.id === current)?.name

  // Sessions carry their venue's name; events reach a venue through their own
  // venue_id or through a showing there, so both routes are followed.
  const atVenue = (session) => current === 'all' || session.venue_name === currentName
  const now = Date.now()
  const upcoming = (sessions ?? [])
    .filter((session) => new Date(session.datetime).getTime() >= now)
    .filter((session) => session.status !== 'cancelled' && atVenue(session))
    .sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
    .slice(0, 6)

  const eventsHere = new Set((sessions ?? []).filter(atVenue).map((session) => session.event_id))
  const nextEvents = (events ?? [])
    .filter((event) => !isEventOver(event))
    .filter((event) => current === 'all' || event.venue_id === current || eventsHere.has(event.id))
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5)

  const switcher = [
    ...breakdown.map((row) => ({ key: row.venue_id, label: row.venue_name })),
    { key: 'all', label: 'Все мои площадки' },
  ]

  return (
    <div className="space-y-8">
      {several && (
        <div role="tablist" aria-label="Площадка" className="flex flex-wrap gap-2">
          {switcher.map((option) => {
            const active = current === option.key
            return (
              <button
                key={option.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelected(option.key)}
                className={[
                  'rounded-full border px-4 py-1.5 text-xs transition-colors duration-150',
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--text)]'
                    : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={CalendarDays}
          label="Мероприятий"
          value={figures?.events_count ?? 0}
          color="var(--accent)"
        />
        <Stat
          icon={TicketIcon}
          label="Билетов продано"
          value={figures?.tickets_sold ?? 0}
          color="var(--warn)"
        />
        <Stat
          icon={Wallet}
          label="Выручка"
          value={formatPrice(figures?.revenue ?? 0)}
          color="var(--ok)"
        />
        <Stat
          icon={CalendarClock}
          label="Предстоящих сеансов"
          value={figures?.upcoming_sessions ?? 0}
          color="var(--accent)"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <p className="mb-3 font-mono2 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Ближайшие мероприятия
          </p>
          {nextEvents.length ? (
            <div className="space-y-2">
              {nextEvents.map((event) => (
                <Panel key={event.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Link
                    to={`/event/${event.id}`}
                    className="min-w-0 flex-1 truncate text-sm transition-colors hover:text-[var(--accent)]"
                  >
                    {event.title}
                  </Link>
                  <span className="shrink-0 font-mono2 text-xs text-[var(--muted)]">
                    {capacityLabel(event)}
                  </span>
                </Panel>
              ))}
            </div>
          ) : (
            <Panel>
              <Empty>Ближайших мероприятий нет.</Empty>
            </Panel>
          )}
        </section>

        <section>
          <p className="mb-3 font-mono2 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Предстоящие сеансы
          </p>
          {upcoming.length ? (
            <div className="space-y-2">
              {upcoming.map((session) => (
                <Panel key={session.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="shrink-0 font-mono2 text-xs">
                    {formatSessionStamp(session.datetime)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">
                    {session.event_title}
                  </span>
                  <span className="shrink-0 text-xs text-[var(--muted2)]">
                    {session.hall_name ?? '—'}
                  </span>
                </Panel>
              ))}
            </div>
          ) : (
            <Panel>
              <Empty>Предстоящих сеансов нет.</Empty>
            </Panel>
          )}
        </section>
      </div>

      <section>
        <p className="mb-3 font-mono2 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Последние билеты
        </p>
        {tickets?.length ? (
          <div className="space-y-2">
            {tickets.map((ticket) => {
              const state = ticketState(ticket)
              return (
                <Panel key={ticket.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="shrink-0 font-mono2 text-xs">{ticket.ticket_id}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--muted)]">
                    {ticket.event_title}
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
      </section>
    </div>
  )
}

export default function VenueAdminPanel() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')

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
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-mono2 text-[11px] uppercase tracking-[0.24em] text-[var(--muted2)]">
            Площадка
          </p>
          <h1 className="mt-2 font-display text-2xl tracking-tight">Моя площадка</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-[var(--muted)]">
            <Users size={14} className="shrink-0 opacity-70" />
            {subtitle}
          </p>
        </div>
        <Button onClick={() => navigate(NEW_EVENT_PATH)} className="shrink-0">
          <Plus size={15} />
          Новое мероприятие
        </Button>
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

      {tab === 'overview' && <OverviewTab venues={venues} events={events} />}
      {tab === 'events' && <EventsTab events={events} isLoading={eventsLoading} />}
      {tab === 'sessions' && <SessionsTab events={events} isLoading={eventsLoading} />}
      {tab === 'halls' && <HallsTab venues={venues} />}
      {tab === 'staff' && <StaffTab />}
    </div>
  )
}
