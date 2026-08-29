import client from './client'

export async function getStats() {
  const { data } = await client.get('/admin/stats')
  return data
}

export async function getAdminEvents() {
  const { data } = await client.get('/admin/events')
  return data
}

export async function getUsers() {
  const { data } = await client.get('/admin/users')
  return data
}

export async function updateUserRole(id, role) {
  const { data } = await client.patch(`/admin/users/${id}/role`, { role })
  return data
}

export async function deleteUser(id) {
  await client.delete(`/admin/users/${id}`)
}

export async function getAllTickets() {
  const { data } = await client.get('/admin/tickets')
  return data
}

// --- venue staff ---------------------------------------------------------

export async function getVenueStaff(venueId) {
  const { data } = await client.get(`/admin/venues/${venueId}/staff`)
  return data
}

export async function assignVenueStaff(venueId, { user_id, role }) {
  const { data } = await client.post(`/admin/venues/${venueId}/assign`, {
    user_id,
    role,
  })
  return data
}

export async function removeVenueStaff(venueId, userId) {
  await client.delete(`/admin/venues/${venueId}/staff/${userId}`)
}
