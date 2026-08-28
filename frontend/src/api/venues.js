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
