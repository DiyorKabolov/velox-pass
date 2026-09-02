import client from './client'

/** Venues the caller administers. Scoped, and needs a token. */
export async function getVenues() {
  const { data } = await client.get('/venues')
  return data
}

/**
 * Every venue, for the public catalogue.
 *
 * Its own endpoint rather than the one above: that listing narrows to the
 * venues the caller administers, which is exactly wrong for a page anyone can
 * open, and widening it would let a venue admin see the rest through the back
 * door of their own panel.
 */
export async function getPublicVenues() {
  const { data } = await client.get('/venues/public')
  return data
}

export async function getPublicVenue(venueId) {
  const { data } = await client.get(`/venues/public/${venueId}`)
  return data
}

/** Upcoming showings at a venue. `date` is optional and means one day only. */
export async function getVenueSessions(venueId, date) {
  const { data } = await client.get(`/venues/${venueId}/sessions`, {
    params: date
      ? { date, tz_offset_minutes: -new Date().getTimezoneOffset() }
      : undefined,
  })
  return data
}

export async function createVenue(payload) {
  const { data } = await client.post('/venues', payload)
  return data
}

export async function updateVenue(id, payload) {
  const { data } = await client.patch(`/venues/${id}`, payload)
  return data
}

export async function deleteVenue(id) {
  await client.delete(`/venues/${id}`)
}

/**
 * Replace a venue's photo.
 *
 * Served by the admin router: uploading is the superadmin's, while the photo
 * itself is public. Content-Type is deliberately left alone -- the client
 * strips its JSON default for FormData so axios can set the multipart boundary.
 */
export async function uploadVenueImage(venueId, file) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await client.post(`/admin/venues/${venueId}/image`, form)
  return data
}

export async function deleteVenueImage(venueId) {
  const { data } = await client.delete(`/admin/venues/${venueId}/image`)
  return data
}

export async function getVenueHalls(venueId) {
  const { data } = await client.get(`/venues/${venueId}/halls`)
  return data
}

export async function createHall(payload) {
  const { data } = await client.post('/venues/halls', payload)
  return data
}

export async function getHall(hallId) {
  const { data } = await client.get(`/venues/halls/${hallId}`)
  return data
}

export async function deleteHall(hallId) {
  await client.delete(`/venues/halls/${hallId}`)
}

/** Seats of a hall; pass a session to learn which are already sold. */
export async function getHallSeats(hallId, sessionId) {
  const { data } = await client.get(`/venues/halls/${hallId}/seats`, {
    params: sessionId ? { session_id: sessionId } : undefined,
  })
  return data
}

// --- venue staff ---------------------------------------------------------
// Served by the admin router, but they belong to a venue, so they live here
// beside the rest of the venue calls.

export async function getVenueStaff(venueId) {
  const { data } = await client.get(`/admin/venues/${venueId}/staff`)
  return data
}

export async function addVenueStaff(venueId, userId, role) {
  const { data } = await client.post(`/admin/venues/${venueId}/staff`, {
    user_id: userId,
    role,
  })
  return data
}

export async function removeVenueStaff(venueId, userId) {
  await client.delete(`/admin/venues/${venueId}/staff/${userId}`)
}
