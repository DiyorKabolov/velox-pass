import { DEFAULT_CARD_COLORS } from './colors'

/**
 * The venue vocabulary, shared by the admin table and the public catalogue.
 *
 * Values are what the API stores; the maps hold what a person reads and the
 * colour each type is drawn in. Kept in one place so a venue is the same shade
 * of blue wherever it turns up.
 */
export const VENUE_TYPES = ['cinema', 'theater', 'concert', 'stadium', 'other']

export const VENUE_TYPE_LABELS = {
  cinema: 'Кинотеатр',
  theater: 'Театр',
  concert: 'Концертный зал',
  stadium: 'Стадион',
  other: 'Другое',
}

const VENUE_TYPE_COLORS = {
  cinema: '#60a5fa',
  theater: '#c084fc',
  concert: '#f59e0b',
  stadium: '#4ade80',
  // A venue whose type nobody filled in still needs a colour; a plain slate
  // reads as "unspecified" rather than as a fifth kind.
  other: '#a8b8c8',
}

/**
 * The card's ground and the ink on it -- the same pale card the poster page
 * uses for events, so the two kinds of card read as one family.
 */
export const CARD_BASE = DEFAULT_CARD_COLORS.bg
export const CARD_INK = DEFAULT_CARD_COLORS.text

/** #rrggbb pulled `amount` of the way towards black. */
function darken(hex, amount) {
  const clean = String(hex || '').replace('#', '')
  if (clean.length !== 6) return hex
  const channel = (index) =>
    Math.round(parseInt(clean.slice(index, index + 2), 16) * (1 - amount))
      .toString(16)
      .padStart(2, '0')
  return `#${channel(0)}${channel(2)}${channel(4)}`
}

/**
 * The card's ground: the pale base, washed with the type's colour in the
 * top-left corner. Derived from the colour rather than written out per type,
 * so the two can never drift apart.
 */
export const venueTypeBackground = (type) =>
  `linear-gradient(135deg, ${venueTypeColor(type)}26 0%, ${CARD_BASE} 58%)`

/**
 * The type's colour, darkened enough to be read as text on that pale ground.
 * Amber at full strength on cream is a smudge; this keeps the hue and gets the
 * contrast back.
 */
export const venueTypeInk = (type) => darken(venueTypeColor(type), 0.42)

export const venueTypeLabel = (type) => VENUE_TYPE_LABELS[type] ?? type ?? 'Другое'

export const venueTypeColor = (type) =>
  VENUE_TYPE_COLORS[type] ?? VENUE_TYPE_COLORS.other
