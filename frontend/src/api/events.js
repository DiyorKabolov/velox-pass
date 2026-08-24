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
