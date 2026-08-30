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
