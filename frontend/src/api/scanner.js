import client from './client'

/**
 * Validate a scanned QR payload. The backend burns the ticket on the first
 * valid scan and answers with { ok, status, message, used_at, ticket }.
 */
export async function checkTicket(ticketId) {
  const { data } = await client.post('/scanner/check', { ticket_id: ticketId })
  return data
}
