/**
 * Whether an event or a ticket is over -- the one rule every screen uses.
 *
 * An event's `date` is when it starts. For a series that is its first
 * showing, so asking "has the date passed?" ended a whole run after its first
 * night: the page said "Завершено", greyed out every later showing, and a
 * ticket for next Friday read "Истёк" by Sunday evening. The server now says
 * when an event ends and when each ticket is for; this file reads that.
 */

const timeOf = (value) => {
  if (!value) return null
  const at = new Date(value).getTime()
  return Number.isNaN(at) ? null : at
}

/** True once nothing about the event can still happen. */
export function isEventOver(event, now = Date.now()) {
  if (!event) return false
  if (typeof event.is_over === 'boolean') return event.is_over
  // A reply from before the server said so: a seated event with a live
  // showing is not over, whatever its start date.
  if (event.has_seats && event.has_active_session) return false
  const at = timeOf(event.ends_at ?? event.date)
  return at !== null && at < now
}

/** When the event stops running: its last showing, or its own date. */
export const eventEndsAt = (event) => event?.ends_at ?? event?.date ?? null

/** When a ticket is for: its showing, or its event when it has none. */
export const ticketStartsAt = (ticket) => ticket?.starts_at ?? ticket?.event_date ?? null

export function isTicketExpired(ticket, now = Date.now()) {
  const at = timeOf(ticketStartsAt(ticket))
  return at !== null && at < now
}

/**
 * Showings that can still be booked. A showing whose time has passed stays in
 * the API's list -- the admin tables need it -- but offering it to a buyer
 * only invites a refusal.
 */
export const bookableSessions = (sessions) =>
  (sessions ?? []).filter((session) => (session.state ?? 'active') === 'active')
