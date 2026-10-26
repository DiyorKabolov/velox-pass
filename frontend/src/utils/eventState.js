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

/**
 * The event's seats: how many in all, sold, still free.
 *
 * total_seats / available_seats are the fields to read for both kinds of
 * event: for a seated one they come from the hall maps of its live showings,
 * where event.capacity is 0; for an ordinary one the API mirrors capacity into
 * them. `available` falls back to a figure derived from what the payload does
 * carry, never to 0: a server that predates these fields would otherwise make
 * every event read "0 мест свободно" -- a confident wrong number rather than a
 * visibly missing one.
 */
export function seatCounts(event) {
  const sold = event?.tickets_sold ?? 0
  const total = event?.total_seats ?? event?.capacity ?? 0
  const available = event?.available_seats ?? Math.max(total - sold, 0)
  return { sold, total, available }
}

/**
 * Nothing left to buy. One rule for the "Мест нет" stamp on a poster, the
 * status on the event page and the "В продаже" filter, which used to disagree.
 */
export function isEventSoldOut(event) {
  if (!event) return false
  const { total, available } = seatCounts(event)
  // A seated event with no live showing has nothing on sale, whatever its
  // halls hold.
  if (event.has_seats) return event.has_active_session === false || (total > 0 && available <= 0)
  return total > 0 && available <= 0
}

/** When a ticket is for: its showing, or its event when it has none. */
export const ticketStartsAt = (ticket) => ticket?.starts_at ?? ticket?.event_date ?? null

export function isTicketExpired(ticket, now = Date.now()) {
  const at = timeOf(ticketStartsAt(ticket))
  return at !== null && at < now
}

/**
 * A ticket that will still get its holder in: not scanned yet, not for a
 * showing that has passed, and not a gift still waiting for an answer.
 */
export const isTicketLive = (ticket, now = Date.now()) =>
  Boolean(ticket) && !ticket.used && ticket.gift_status !== 'pending' && !isTicketExpired(ticket, now)

/**
 * Showings that can still be booked. A showing whose time has passed stays in
 * the API's list -- the admin tables need it -- but offering it to a buyer
 * only invites a refusal.
 */
export const bookableSessions = (sessions) =>
  (sessions ?? []).filter((session) => (session.state ?? 'active') === 'active')
