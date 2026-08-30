import client from './client'

/** Venues the signed-in administrator holds; the backend does the narrowing. */
export async function getMyVenues() {
  const { data } = await client.get('/venues')
  return data
}

/**
 * Events of the caller's venues.
 *
 * `my_venues` is opt-in on purpose: the same endpoint serves the public
 * listing, which must keep showing every venue's events to everyone.
 */
export async function getMyEvents() {
  const { data } = await client.get('/events', { params: { my_venues: true } })
  return data
}

export async function getMySessions() {
  const { data } = await client.get('/sessions', { params: { my_venues: true } })
  return data
}

/** Scanners on the caller's venues. Read-only: assigning is the superadmin's. */
export async function getMyStaff() {
  const { data } = await client.get('/venue-admin/staff')
  return data
}

export async function getMyStats() {
  const { data } = await client.get('/venue-admin/stats')
  return data
}

export async function getMyRecentTickets(limit = 20) {
  const { data } = await client.get('/venue-admin/tickets', { params: { limit } })
  return data
}
