import client from './client'

/**
 * Ask someone to be friends by their username. The reply's `status` is
 * "pending" normally, or "accepted" when they had already asked the caller.
 */
export async function sendFriendRequest(username) {
  const { data } = await client.post('/friends/request', { username })
  return data
}

/** Accepted friends: [{ user_id, username, avatar_url, since }]. */
export async function getFriends() {
  const { data } = await client.get('/friends')
  return data
}

/** Requests waiting for the caller's answer. */
export async function getPendingRequests() {
  const { data } = await client.get('/friends/pending')
  return data
}

/** Ends a friendship, or withdraws a request, with this user. */
export async function removeFriend(userId) {
  await client.delete(`/friends/${userId}`)
}

export async function acceptRequest(friendshipId) {
  const { data } = await client.post(`/friends/requests/${friendshipId}/accept`)
  return data
}

export async function declineRequest(friendshipId) {
  const { data } = await client.post(`/friends/requests/${friendshipId}/decline`)
  return data
}

/** Who sent the invitation behind an e-mailed link. No sign-in needed. */
export async function getInvite(token) {
  const { data } = await client.get(`/friends/invite/${encodeURIComponent(token)}`)
  return data
}

/** Answers an e-mailed invitation. The token is the proof, not a session. */
export async function respondToInvite(token, action) {
  const { data } = await client.post('/friends/respond', { token, action })
  return data
}
