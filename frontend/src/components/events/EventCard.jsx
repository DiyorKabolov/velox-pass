import { Link } from 'react-router-dom'
import { dayKey, formatTime, MONTHS_SHORT, WEEKDAYS_SHORT } from '../../utils/dates'
import { eventEndsAt, isEventOver, isEventSoldOut, seatCounts } from '../../utils/eventState'
import { pluralize } from '../../utils/plural'
import Poster from './Poster'

/**
 * When, for the line under a poster: "Сб 18 сен" and the time beside it for
 * one night, "18–30 сен" for a run. The year is given only when it is not this
 * one -- which, in a listing, mostly means something long past.
 */
function whenOf(event, now = new Date()) {
  const start = event?.date ? new Date(event.date) : null
  if (!start || Number.isNaN(start.getTime())) return { day: 'Дата уточняется', time: null }

  const year = (date) => (date.getFullYear() === now.getFullYear() ? '' : ` ${date.getFullYear()}`)
  const day = (date) => `${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}${year(date)}`

  const endsRaw = eventEndsAt(event)
  const ends = endsRaw ? new Date(endsRaw) : null
  if (ends && !Number.isNaN(ends.getTime()) && dayKey(ends) !== dayKey(start)) {
    const sameMonth =
      ends.getMonth() === start.getMonth() && ends.getFullYear() === start.getFullYear()
    return {
      day: sameMonth ? `${start.getDate()}–${day(ends)}` : `${day(start)} — ${day(ends)}`,
      time: null,
    }
  }
  return { day: `${WEEKDAYS_SHORT[start.getDay()]} ${day(start)}`, time: formatTime(start) }
}

/** How much is left, for an event still on sale; null when there is nothing to say. */
function seatsLine(event) {
  const { total, available } = seatCounts(event)
  if (total > 0) {
    const seats = pluralize(available, 'место свободно', 'места свободно', 'мест свободно')
    // A seated event spreads its seats over showings, so the number is a total
    // and means little without them.
    return event.has_seats && event.sessions_count > 0
      ? `${seats} · ${pluralize(event.sessions_count, 'сеанс', 'сеанса', 'сеансов')}`
      : seats
  }
  return event.has_seats ? null : 'Без ограничения мест'
}

/**
 * One event in the listing: the poster, and under it -- in the page's own
 * type, not printed on the poster -- the facts a buyer scans for next: when,
 * where, and how much is left.
 */
export default function EventCard({ event }) {
  const past = isEventOver(event)
  const soldOut = !past && isEventSoldOut(event)
  const stamp = past ? 'Завершено' : soldOut ? 'Мест нет' : null
  const { day, time } = whenOf(event)
  const seats = past || soldOut ? null : seatsLine(event)

  return (
    <Link
      to={`/event/${event.id}`}
      className={[
        'group block rounded-[4px] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent)]',
        // A finished event stays in the listing but half sunk into the page,
        // and comes back up when pointed at.
        past
          ? 'opacity-[0.55] transition-opacity duration-500 hover:opacity-90 focus-visible:opacity-90'
          : '',
      ].join(' ')}
    >
      {/* Pointing at the card lifts the poster a little off the wall. */}
      <div className="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1">
        <Poster event={event} stamp={stamp} past={past} interactive />
      </div>

      <div className="mt-4">
        <p className="flex items-baseline justify-between gap-4 font-display text-[21px] font-bold uppercase leading-none text-[var(--text)] transition-colors duration-200 group-hover:text-[var(--accent)]">
          <span className="t-num truncate">{day}</span>
          {time && <span className="t-num shrink-0 text-[var(--muted)]">{time}</span>}
        </p>
        {event.location && (
          <p className="mt-2 truncate text-[14px] leading-snug text-[var(--muted)]">{event.location}</p>
        )}
        {seats && (
          <p className="mt-3 flex items-center gap-2 text-[13px] text-[var(--muted2)]">
            <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ok)]" />
            {seats}
          </p>
        )}
      </div>
    </Link>
  )
}
