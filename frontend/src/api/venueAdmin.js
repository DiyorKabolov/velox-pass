import client from './client'

/** Venues the signed-in administrator holds; the backend does the narrowing. */
export async function getMyVenues() {
  const { data } = await client.get('/venues')
  return data
}

/**
 * Events this administrator may manage. The backend narrows the list -- their
 * venues, the halls their showings use, and anything they created themselves --
 * so a superadmin calling it gets everything.
 */
export async function getMyEvents() {
  const { data } = await client.get('/admin/events')
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
