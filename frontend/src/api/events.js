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

/**
 * Replace an event's artwork. The event has to exist first, so on the create
 * page this runs after the event is saved, not with it.
 */
export async function uploadEventImage(eventId, file) {
  const form = new FormData()
  form.append('file', file)
  // No explicit Content-Type: the browser must add the multipart boundary, and
  // setting the header by hand strips it.
  const { data } = await client.post(`/admin/events/${eventId}/image`, form)
  return data
}

export async function deleteEventImage(eventId) {
  const { data } = await client.delete(`/admin/events/${eventId}/image`)
  return data
}

/**
 * Showings of one event, soonest first, each with its own seat counts and
 * cheapest price.
 *
 * By default only what can still be sold. `includeInactive` adds the cancelled
 * and finished ones, which the admin breakdown needs; tell them apart by
 * `state` ("active" | "finished" | "cancelled") rather than by the raw
 * `status`, which says nothing about the clock.
 */
export async function getEventSessions(eventId, { includeInactive = false } = {}) {
  const { data } = await client.get(`/events/${eventId}/sessions`, {
    params: includeInactive ? { include_inactive: true } : undefined,
  })
  return data
}
