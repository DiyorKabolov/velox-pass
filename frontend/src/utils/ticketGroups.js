/**
 * Grouping, counting and searching for the admin ticket list. Kept out of the
 * page so the rules can be tested on their own.
 */

/** 'ok' | 'used' | 'expired' — the same three states the ticket card shows. */
export function ticketState(ticket, now = Date.now()) {
  if (ticket.used) return 'used'
  const at = ticket.event_date ? new Date(ticket.event_date).getTime() : null
  if (at !== null && !Number.isNaN(at) && at < now) return 'expired'
  return 'ok'
}

export const STATE_LABELS = {
  ok: 'Активен',
  used: 'Погашен',
  expired: 'Истёк',
}

export function countStates(tickets, now = Date.now()) {
  const stats = { total: 0, ok: 0, used: 0, expired: 0 }
  for (const ticket of tickets ?? []) {
    stats.total += 1
    stats[ticketState(ticket, now)] += 1
  }
  return stats
}

/**
 * Buyers keyed by id.
 *
 * The ticket payload carries only user_id — no username or email — so the
 * buyer column is filled by joining the admin user list in the browser. That
 * keeps this a frontend-only change, at the cost of the column reading "—"
 * until the second request lands.
 */
export function buyersById(users) {
  const map = new Map()
  for (const user of users ?? []) map.set(user.id, user)
  return map
}

/**
 * One entry per event that actually has tickets.
 *
 * Events without any never appear: the groups are built from the tickets, so
 * an empty one cannot be formed in the first place.
 *
 * Order is upcoming first, soonest at the top, then the finished ones with the
 * most recent first — what an admin wants to act on is what is still ahead.
 */
export function groupByEvent(tickets, now = Date.now()) {
  const groups = (tickets ?? []).reduce((acc, ticket) => {
    const id = ticket.event_id
    if (!acc.has(id)) {
      acc.set(id, {
        eventId: id,
        title: ticket.event_title ?? 'Без названия',
        date: ticket.event_date ?? null,
        accent: ticket.card_accent || 'var(--accent)',
        tickets: [],
      })
    }
    acc.get(id).tickets.push(ticket)
    return acc
  }, new Map())

  const list = [...groups.values()].map((group) => ({
    ...group,
    // Newest issue first inside a group, so the latest sale is at the top.
    tickets: [...group.tickets].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    ),
    stats: countStates(group.tickets, now),
  }))

  const time = (value) => {
    if (!value) return null
    const at = new Date(value).getTime()
    return Number.isNaN(at) ? null : at
  }

  return list.sort((a, b) => {
    const left = time(a.date)
    const right = time(b.date)
    // Undated groups sink, whichever side they are on.
    if (left === null && right === null) return 0
    if (left === null) return 1
    if (right === null) return -1

    const leftPast = left < now
    const rightPast = right < now
    if (leftPast !== rightPast) return leftPast ? 1 : -1
    return leftPast ? right - left : left - right
  })
}

/** Matches a ticket by its public id, or by the buyer's name or email. */
export function matchesTicket(ticket, buyer, query) {
  const needle = String(query ?? '').trim().toLowerCase()
  if (!needle) return true
  return [ticket.ticket_id, buyer?.username, buyer?.email]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(needle))
}

/** "1 200 ₽", or a dash for a ticket that was issued without a price. */
export function formatPrice(value) {
  const amount = Number(value) || 0
  if (!amount) return '—'
  return `${amount.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`
}
