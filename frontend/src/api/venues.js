import client from './client'

export async function getVenues() {
  const { data } = await client.get('/venues')
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
