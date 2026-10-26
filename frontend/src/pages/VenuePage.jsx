import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { getPublicVenue, getVenueSessions } from '../api/venues'
import Select from '../components/ui/Select'
import { CONTAINER, EmptyState, PageHeader, SectionHead } from '../components/ui/Page'
import { Reveal } from '../components/motion/Motion'
import {
  dayKey,
  formatDayLabel,
  formatTime,
  MONTHS_SHORT,
  WEEKDAYS_SHORT,
} from '../utils/dates'
import { formatFrom } from '../utils/ticketGroups'
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

/** One cell of the day strip. The chosen one is a block of paper that slides. */
function DayTab({ active, label, sublabel, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'relative min-w-[76px] shrink-0 border-l border-[var(--border)] px-3 py-3 text-center first:border-l-0',
        'transition-colors duration-200',
        active ? 'text-[var(--bg)]' : 'text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]',
      ].join(' ')}
    >
      {active && (
        <motion.span
          layoutId="venue-day"
          transition={{ type: 'spring', stiffness: 480, damping: 40 }}
          className="absolute inset-0 bg-[var(--text)]"
        />
      )}
      <span className="relative block text-[11px] font-semibold uppercase tracking-[0.06em] opacity-75">
        {label}
      </span>
      <span className="t-poster t-num relative mt-1 block whitespace-nowrap text-[22px] leading-none">
        {sublabel}
      </span>
    </button>
  )
}

/** One showing, as a tear-off coupon: the time large, what is left beneath. */
function SessionButton({ session }) {
  const soldOut = (session.available_seats ?? 0) <= 0

  const body = (
    <>
      <span className="t-poster t-num block text-[28px] leading-none text-[var(--text)]">
        {formatTime(session.datetime)}
      </span>
      <span className="mt-2 block border-t border-dashed border-[var(--border2)] pt-1.5 text-[11px] text-[var(--muted)]">
        {soldOut ? 'мест нет' : pluralize(session.available_seats, 'место', 'места', 'мест')}
      </span>
      {session.min_price != null && (
        <span className="t-num block text-[11px] text-[var(--muted2)]">
          {formatFrom(session.min_price)}
        </span>
      )}
    </>
  )

  const shape =
    'min-w-[92px] rounded-[var(--radius-sm)] border px-3 pb-2 pt-2.5 text-left transition-[border-color,background-color,transform] duration-200'

  if (soldOut) {
    return (
      <span aria-disabled className={`${shape} cursor-not-allowed border-[var(--border)] opacity-40`}>
        {body}
      </span>
    )
  }

  return (
    <Link
      to={`/event/${session.event_id}?session=${session.session_id}`}
      className={`${shape} border-[var(--border2)] hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--surface)] active:translate-y-0`}
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
  // with anything on -- and if it was the day picked, the pick falls back to
  // "Все" rather than leaving an empty schedule with no tab lit.
  const activeDay = day && schedule.some((entry) => entry.key === day) ? day : null
  const visible = activeDay ? schedule.filter((entry) => entry.key === activeDay) : schedule

  const accent = venueTypeColor(venue?.type)

  if (venueError) {
    return (
      <div className={`${CONTAINER} pt-12 sm:pt-16`}>
        <EmptyState
          title="Площадка не найдена"
          action={
            <Link to="/venues" className="t-link text-[14px] text-[var(--text)]">
              Все площадки
            </Link>
          }
        />
      </div>
    )
  }

  return (
    <div className={`${CONTAINER} pt-8 sm:pt-12`}>
      <Reveal distance={6}>
        <Link
          to="/venues"
          className="inline-flex items-center gap-2 text-[14px] text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
        >
          <ArrowLeft size={15} strokeWidth={1.75} />
          Все площадки
        </Link>
      </Reveal>

      <PageHeader
        className="mt-8"
        rule={false}
        size="lg"
        kicker={
          venue && (
            <>
              <span aria-hidden className="h-2 w-2 rounded-[1px]" style={{ background: accent }} />
              {venueTypeLabel(venue.type)}
            </>
          )
        }
        title={venue?.name ?? '…'}
        meta={
          <>
            {venue?.address && <span>{venue.address}</span>}
            {venue?.halls_count > 0 && (
              <span className="t-num text-[var(--muted2)]">
                {pluralize(venue.halls_count, 'зал', 'зала', 'залов')}
              </span>
            )}
          </>
        }
        lead={venue?.description}
      />

      <section className="mt-14">
        <SectionHead
          title="Расписание"
          aside={
            eventOptions.length > 2 && (
              <div className="w-[260px]">
                <Select
                  value={eventId}
                  onChange={setEventId}
                  aria-label="Фильтр по мероприятию"
                  options={eventOptions}
                  className="!py-2 !text-[14px]"
                />
              </div>
            )
          }
        />

        {isLoading ? (
          <div className="skeleton mt-6 h-56 rounded-[var(--radius)]" />
        ) : schedule.length ? (
          <>
            {/* Days with something on. Nothing else is offered: a tab that can
                only ever show "нет сеансов" is a dead end. */}
            <div className="scrollbar-none mt-6 flex overflow-x-auto border-y border-[var(--border)]">
              <DayTab
                active={activeDay === null}
                label="Все"
                sublabel={pluralize(filtered.length, 'сеанс', 'сеанса', 'сеансов')}
                onClick={() => setDay(null)}
              />
              {schedule.map((entry) => {
                const date = new Date(entry.at)
                return (
                  <DayTab
                    key={entry.key}
                    active={activeDay === entry.key}
                    label={WEEKDAYS_SHORT[date.getDay()]}
                    sublabel={`${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`}
                    onClick={() => setDay(entry.key)}
                  />
                )
              })}
            </div>

            <div
              key={`${activeDay ?? 'all'}::${eventId}`}
              className="anim-rise space-y-12 pt-10"
              style={{ '--rise': '10px' }}
            >
              {visible.map((entry) => (
                <div key={entry.key}>
                  <h3 className="font-display text-[20px] font-bold uppercase leading-none text-[var(--text)]">
                    {formatDayLabel(entry.at)}
                  </h3>
                  <div className="mt-4 border-t border-[var(--border)]">
                    {entry.groups.map((group) => (
                      <div
                        key={group.key}
                        className="grid gap-x-8 gap-y-4 border-b border-[var(--border)] py-5 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)]"
                      >
                        <div className="min-w-0">
                          <Link
                            to={`/event/${group.eventId}`}
                            className="font-display text-[19px] font-bold uppercase leading-tight text-[var(--text)] transition-colors duration-200 hover:text-[var(--accent)]"
                          >
                            {group.title}
                          </Link>
                          {group.hallName && (
                            <p className="mt-1.5 text-[13px] text-[var(--muted)]">{group.hallName}</p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2.5">
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
          <EmptyState
            className="mt-6"
            title={eventId === ALL_EVENTS ? 'Нет сеансов' : 'Нет сеансов для выбранного мероприятия'}
          />
        )}
      </section>
    </div>
  )
}
