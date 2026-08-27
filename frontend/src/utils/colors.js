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

/**
 * Pick a legible foreground for a background colour using the WCAG relative
 * luminance, so a pale accent still gets dark text on the ticket stub.
 */
export function readableOn(hex, dark = '#1f2328', light = '#ffffff') {
  const clean = String(hex || '').replace('#', '')
  if (clean.length !== 6) return light

  const channel = (value) => {
    const c = parseInt(value, 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const luminance =
    0.2126 * channel(clean.slice(0, 2)) +
    0.7152 * channel(clean.slice(2, 4)) +
    0.0722 * channel(clean.slice(4, 6))

  return luminance > 0.45 ? dark : light
}
