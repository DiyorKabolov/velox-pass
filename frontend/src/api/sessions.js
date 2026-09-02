import client from './client'

export async function getSession(sessionId) {
  const { data } = await client.get(`/sessions/${sessionId}`)
  return data
}

export async function getSessionSeats(sessionId) {
  const { data } = await client.get(`/sessions/${sessionId}/seats`)
  return data
}

/**
 * Create one showing, or a whole series.
 *
 * The endpoint takes both: pass `datetime` for a single session, or
 * `is_recurring` with a `recurring` rule for a series. The reply differs to
 * match -- a session for one, `{ group_id, created, skipped, sessions }` for
 * the other.
 */
export async function createSessions(payload) {
  const { data } = await client.post('/sessions', payload)
  return data
}

export async function deleteSession(sessionId) {
  const { data } = await client.delete(`/sessions/${sessionId}`)
  return data
}

/** Cancel every remaining showing of one series. */
export async function cancelSessionGroup(groupId) {
  const { data } = await client.delete(`/sessions/group/${groupId}`)
  return data
}
