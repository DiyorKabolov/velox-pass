import client from './client'

/**
 * Give a ticket to a friend. The ticket leaves the caller's cabinet at once and
 * waits in the friend's until they accept or decline it.
 */
export async function giftTicket(ticketId, friendUsername, message) {
  const { data } = await client.post(`/tickets/${encodeURIComponent(ticketId)}/gift`, {
    friend_username: friendUsername,
    message: message?.trim() || null,
  })
  return data
}

/** Tickets given to the caller, waiting or accepted. */
export async function getReceivedGifts() {
  const { data } = await client.get('/gifts/received')
  return data
}

export async function acceptGift(ticketId) {
  const { data } = await client.post(`/gifts/${encodeURIComponent(ticketId)}/accept`)
  return data
}

export async function declineGift(ticketId) {
  const { data } = await client.post(`/gifts/${encodeURIComponent(ticketId)}/decline`)
  return data
}

/** What a gift is, for the page an e-mailed link opens. No sign-in needed. */
export async function getGiftInvite(token) {
  const { data } = await client.get(`/gifts/invite/${encodeURIComponent(token)}`)
  return data
}

/** Answers a gift from its e-mailed link. The token is the proof, not a session. */
export async function respondToGift(token, action) {
  const { data } = await client.post('/gifts/respond', { token, action })
  return data
}
