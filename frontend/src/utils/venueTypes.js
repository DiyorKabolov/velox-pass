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
  // A venue whose type nobody filled in still needs a stripe; the app accent
  // reads as "unspecified" rather than as one of the four kinds.
  other: '#a898e0',
}

export const venueTypeLabel = (type) => VENUE_TYPE_LABELS[type] ?? type ?? 'Другое'

export const venueTypeColor = (type) =>
  VENUE_TYPE_COLORS[type] ?? VENUE_TYPE_COLORS.other
