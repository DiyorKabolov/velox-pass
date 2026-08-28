import client from './client'

export async function getEvents({ upcomingOnly = false } = {}) {
  const { data } = await client.get('/events', {
    params: { upcoming_only: upcomingOnly },
  })
  return data
}

export async function getEvent(id) {
  const { data } = await client.get(`/events/${id}`)
  return data
}

/**
 * Write operations live under /admin and require a superadmin token; they are
 * kept next to the read endpoints so every event call has one home.
 */
export async function createEvent(payload) {
  const { data } = await client.post('/admin/events', payload)
  return data
}

export async function updateEvent(id, payload) {
  const { data } = await client.patch(`/admin/events/${id}`, payload)
  return data
}

export async function deleteEvent(id) {
  await client.delete(`/admin/events/${id}`)
}

/** Showings of one event, soonest first. Cancelled ones are excluded. */
export async function getEventSessions(eventId) {
  const { data } = await client.get(`/events/${eventId}/sessions`)
  return data
}
