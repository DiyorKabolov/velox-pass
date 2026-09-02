import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Armchair, CalendarDays, MapPin } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getPublicVenue, getVenueSessions } from '../api/venues'
import Select from '../components/ui/Select'
import {
  dayKey,
  formatDayLabel,
  formatTime,
  MONTHS_SHORT,
  WEEKDAYS_SHORT,
} from '../utils/dates'
import { formatPrice } from '../utils/ticketGroups'
import { pluralize } from '../utils/plural'
import { venueTypeColor, venueTypeLabel } from '../utils/venueTypes'

const ALL_EVENTS = 'all'

/**
 * The schedule, grouped the way it is read: by day, then by what is playing.
 *
 * Grouped here rather than on the server because the day a showing falls on is
 * the viewer's day, in the viewer's timezone — a boundary the API cannot know.
 */
function groupSchedule(sessions) {
  const days = new Map()

  for (const session of sessions) {
    const key = dayKey(session.datetime)
    if (!days.has(key)) {
      days.set(key, { key, at: session.datetime, groups: new Map() })
    }
    const day = days.get(key)

    // One row per film per hall: the same film in two halls is two lines of
    // times, which is how a cinema board reads.
    const rowKey = `${session.event_id}::${session.hall_name ?? ''}`
    if (!day.groups.has(rowKey)) {
      day.groups.set(rowKey, {
        key: rowKey,
        eventId: session.event_id,
        title: session.event_title,
        hallName: session.hall_name,
        sessions: [],
      })
    }
    day.groups.get(rowKey).sessions.push(session)
  }

  return [...days.values()].map((day) => ({ ...day, groups: [...day.groups.values()] }))
}

/** One tab in the day strip. */
function DayTab({ active, label, sublabel, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'shrink-0 rounded-[var(--radius-sm)] border px-3 py-2 text-center',
        'transition-all duration-150 active:scale-[0.95]',
        active
          ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--text)]'
          : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--border2)] hover:text-[var(--text)]',
      ].join(' ')}
    >
      <span className="block font-mono2 text-[10px] uppercase tracking-[0.14em] opacity-70">
        {label}
      </span>
      <span className="mt-0.5 block whitespace-nowrap text-sm">{sublabel}</span>
    </button>
  )
}

/** One showing: when, how many seats are left, what it costs. */
function SessionButton({ session }) {
  const soldOut = (session.available_seats ?? 0) <= 0

  const body = (
    <>
      <span className="block font-mono2 text-base leading-none text-[var(--text)]">
        {formatTime(session.datetime)}
      </span>
      <span className="mt-1.5 flex items-center justify-center gap-1 text-[10px] text-[var(--muted2)]">
        <Armchair size={10} className="shrink-0" />
        {soldOut ? 'мест нет' : session.available_seats}
      </span>
      {session.min_price != null && (
        <span className="mt-0.5 block font-mono2 text-[10px] text-[var(--muted2)]">
          от {formatPrice(session.min_price)}
        </span>
      )}
    </>
  )

  const shape =
    'min-w-[76px] rounded-[var(--radius-sm)] border px-3 py-2 text-center transition-all duration-150'

  if (soldOut) {
    return (
      <span
        aria-disabled
        className={`${shape} cursor-not-allowed border-[var(--border)] opacity-45`}
      >
        {body}
      </span>
    )
  }

  return (
    <Link
      to={`/event/${session.event_id}?session=${session.session_id}`}
      className={`${shape} border-[var(--border)] hover:border-[var(--accent)] hover:bg-[var(--accent-dim)] active:scale-[0.96]`}
    >
      {body}
    </Link>
  )
}

export default function VenuePage() {
  const { id } = useParams()

  const { data: venue, isError: venueError } = useQuery({
    queryKey: ['venues', 'public', id],
    queryFn: () => getPublicVenue(id),
  })
  const { data: sessions, isLoading } = useQuery({
    // Every upcoming showing in one request: the day strip has to know which
    // days have something on before any day is picked.
    queryKey: ['venues', id, 'schedule'],
    queryFn: () => getVenueSessions(id),
  })

  const [day, setDay] = useState(null)
  const [eventId, setEventId] = useState(ALL_EVENTS)

  // What is playing here at all, for the filter. Built from the schedule, so
  // it can never offer a film with no showings left.
  const eventOptions = useMemo(() => {
    const titles = new Map()
    for (const session of sessions ?? []) {
      titles.set(String(session.event_id), session.event_title)
    }
    return [
      { value: ALL_EVENTS, label: 'Все мероприятия' },
      ...[...titles.entries()].map(([value, label]) => ({ value, label })),
    ]
  }, [sessions])

  const filtered = useMemo(
    () =>
      (sessions ?? []).filter(
        (session) => eventId === ALL_EVENTS || String(session.event_id) === eventId,
      ),
    [sessions, eventId],
  )

  const schedule = useMemo(() => groupSchedule(filtered), [filtered])
  // The strip follows the filter: a day left empty by it is no longer a day
  // with anything on.
  const visible = day ? schedule.filter((entry) => entry.key === day) : schedule

  const accent = venueTypeColor(venue?.type)

  if (venueError) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-20 text-center">
        <p className="text-sm text-[var(--err)]">Площадка не найдена.</p>
        <Link to="/venues" className="mt-4 inline-block text-sm text-[var(--accent)]">
          Все площадки
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <Link
        to="/venues"
        className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeft size={15} /> Все площадки
      </Link>

      <header className="mb-10">
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">
          {venue?.name ?? '…'}
        </h1>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[var(--muted)]">
          {venue && (
            <span
              className="rounded-full px-2.5 py-1 font-mono2 text-[10px] uppercase tracking-[0.14em]"
              style={{ background: `${accent}26`, color: accent }}
            >
              {venueTypeLabel(venue.type)}
            </span>
          )}
          {venue?.address && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={14} className="shrink-0 opacity-70" />
              {venue.address}
            </span>
          )}
          {venue?.halls_count > 0 && (
            <span className="font-mono2 text-xs text-[var(--muted2)]">
              {pluralize(venue.halls_count, 'зал', 'зала', 'залов')}
            </span>
          )}
        </div>

        {venue?.description && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
            {venue.description}
          </p>
        )}
      </header>

      <section>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-mono2 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Расписание
          </h2>
          {eventOptions.length > 2 && (
            <div className="w-full sm:w-64">
              <Select
                value={eventId}
                onChange={setEventId}
                aria-label="Фильтр по мероприятию"
                options={eventOptions}
              />
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="h-56 animate-pulse rounded-[var(--radius)] bg-[var(--surface)]" />
        ) : schedule.length ? (
          <>
            {/* Days with something on. Nothing else is offered: a tab that can
                only ever show "нет сеансов" is a dead end. */}
            <div className="mb-7 flex gap-2 overflow-x-auto pb-2">
              <DayTab
                active={day === null}
                label="Все"
                sublabel={pluralize(filtered.length, 'сеанс', 'сеанса', 'сеансов')}
                onClick={() => setDay(null)}
              />
              {schedule.map((entry) => {
                const date = new Date(entry.at)
                return (
                  <DayTab
                    key={entry.key}
                    active={day === entry.key}
                    label={WEEKDAYS_SHORT[date.getDay()]}
                    sublabel={`${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`}
                    onClick={() => setDay(entry.key)}
                  />
                )
              })}
            </div>

            <div className="space-y-8">
              {visible.map((entry) => (
                <div key={entry.key}>
                  <h3 className="mb-3 text-sm font-medium text-[var(--text)]">
                    {formatDayLabel(entry.at)}
                  </h3>
                  <div className="space-y-3">
                    {entry.groups.map((group) => (
                      <div
                        key={group.key}
                        className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <Link
                            to={`/event/${group.eventId}`}
                            className="text-sm font-medium text-[var(--text)] transition-colors hover:text-[var(--accent)]"
                          >
                            {group.title}
                          </Link>
                          {group.hallName && (
                            <span className="text-xs text-[var(--muted2)]">
                              — {group.hallName}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.sessions.map((session) => (
                            <SessionButton key={session.session_id} session={session} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] py-16 text-center">
            <CalendarDays size={24} className="mx-auto mb-3 text-[var(--muted2)]" />
            <p className="text-sm text-[var(--muted)]">
              {eventId === ALL_EVENTS
                ? 'Нет сеансов.'
                : 'Нет сеансов для выбранного мероприятия.'}
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
