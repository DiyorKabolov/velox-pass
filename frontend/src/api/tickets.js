import client, { TOKEN_KEY } from './client'

export async function getMyTickets() {
  const { data } = await client.get('/tickets/my')
  return data
}

/**
 * Place one order. `seatIds` for a seated event -- a ticket per seat -- or
 * `quantity` for one without seats. Resolves to the list of tickets issued,
 * all of them or, if anything was refused, none.
 */
export async function buyTicket({ eventId, sessionId = null, seatIds = [], quantity = null }) {
  const { data } = await client.post('/tickets', {
    event_id: eventId,
    session_id: sessionId,
    seats: seatIds,
    quantity,
  })
  return data
}

/** URL of the ticket QR image, usable straight from an <img src>. */
export function qrUrl(ticketId) {
  const token = localStorage.getItem(TOKEN_KEY)
  return `/api/tickets/${ticketId}/qr${token ? `?token=${encodeURIComponent(token)}` : ''}`
}

export async function fetchQrBlobUrl(ticketId) {
  const { data } = await client.get(`/tickets/${ticketId}/qr`, {
    responseType: 'blob',
  })
  return URL.createObjectURL(data)
}

/** Download the ticket PDF through the authenticated client. */
export async function downloadPdf(ticketId) {
  const { data } = await client.get(`/tickets/${ticketId}/pdf`, {
    responseType: 'blob',
  })
  const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `velox-pass-${ticketId}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
