import client from './client'

export async function getSession(sessionId) {
  const { data } = await client.get(`/sessions/${sessionId}`)
  return data
}

export async function getSessionSeats(sessionId) {
  const { data } = await client.get(`/sessions/${sessionId}/seats`)
  return data
}

export async function createSession(payload) {
  const { data } = await client.post('/sessions', payload)
  return data
}

export async function deleteSession(sessionId) {
  const { data } = await client.delete(`/sessions/${sessionId}`)
  return data
}
