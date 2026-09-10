import { pluralize } from './plural'

/**
 * How full an event is, in the one place every table reads it from.
 *
 * A seated event stores capacity 0 -- its seats belong to the halls its
 * showings run in -- so reading `capacity` alone printed "∞" next to a sold-out
 * cinema. The API sends `total_seats` for both kinds of event instead.
 */
export function eventCapacity(event) {
  const seated = Boolean(event?.has_seats)
  const capacity = event?.capacity ?? 0
  const sold = event?.tickets_sold ?? 0

  // `total_seats` is 0 both for an event with no showings and for a reply that
  // predates the field, so it is only believed when it is non-zero; for an
  // unseated event `capacity` says the same thing and is always there.
  const total = event?.total_seats || capacity || 0

  // An unseated event's free seats are knowable here, so they are computed
  // rather than read: an older server leaves the field at 0, and trusting it
  // showed a half-empty hall as full. For a seated one only the server can
  // know -- it deliberately reports 0 once no showing is live.
  const available = seated
    ? (event?.available_seats ?? Math.max(total - sold, 0))
    : Math.max(total - sold, 0)

  return {
    total,
    sold,
    available,
    sessions: event?.sessions_count ?? 0,
    // Genuinely unbounded: an unseated event whose capacity was left at zero
    // sells without a limit, and "0" would read as sold out.
    unlimited: !seated && !capacity,
    // A seated event whose seats live on showings the reply said nothing
    // about. Not the same as zero: printing "0" claims it is sold out, which
    // is a confident wrong answer where the honest one is "not known".
    unknown: seated && !total,
  }
}

/** "12 / 96", "12 / ∞" when there is no limit, "12 / —" when it is not known. */
export function capacityLabel(event) {
  const { total, sold, unlimited, unknown } = eventCapacity(event)
  if (unknown) return `${sold} / —`
  return `${sold} / ${unlimited ? '∞' : total}`
}

/** What goes in a "free seats" cell, including the two cases that are not numbers. */
export function availableLabel(event) {
  const { available, unlimited, unknown } = eventCapacity(event)
  if (unknown) return '—'
  if (unlimited) return '∞'
  return String(available)
}

/** "3 сеанса", or an empty string for an event that has none. */
export function sessionsLabel(event) {
  const { sessions } = eventCapacity(event)
  return sessions ? pluralize(sessions, 'сеанс', 'сеанса', 'сеансов') : ''
}
