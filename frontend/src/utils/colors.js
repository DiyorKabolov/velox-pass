export const DEFAULT_CARD_COLORS = {
  bg: '#fdfdf5',
  accent: '#a898e0',
  text: '#2a2a2a',
}

/**
 * Resolve the ticket-card palette for an event, falling back to the defaults
 * whenever the backend has no override stored.
 */
export function getCardColors(event) {
  if (!event) return { ...DEFAULT_CARD_COLORS }
  return {
    bg: event.card_bg || DEFAULT_CARD_COLORS.bg,
    accent: event.card_accent || DEFAULT_CARD_COLORS.accent,
    text: event.card_text || DEFAULT_CARD_COLORS.text,
  }
}

/** Same palette, read off a serialized ticket instead of an event. */
export function getTicketColors(ticket) {
  return getCardColors({
    card_bg: ticket?.card_bg,
    card_accent: ticket?.card_accent,
    card_text: ticket?.card_text,
  })
}

/** Mix a hex colour with transparency, e.g. withAlpha('#a898e0', 0.2). */
export function withAlpha(hex, alpha) {
  const clean = String(hex || '').replace('#', '')
  if (clean.length !== 6) return hex
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
