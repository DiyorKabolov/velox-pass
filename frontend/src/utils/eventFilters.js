/**
 * Filtering and sorting for the listing page. Kept apart from the page so the
 * rules are testable on their own and the component stays about layout.
 */

export const DEFAULTS = {
  query: '',
  date: 'all',
  status: 'all',
  sort: 'date-asc',
}

export const DATE_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'На этой неделе' },
  { value: 'month', label: 'В этом месяце' },
]

export const STATUS_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'available', label: 'В продаже' },
  { value: 'finished', label: 'Завершённые' },
]

export const SORT_OPTIONS = [
  { value: 'date-asc', label: 'По дате (ближайшие)' },
  { value: 'date-desc', label: 'По дате (поздние)' },
  { value: 'fill', label: 'По заполненности' },
  { value: 'title', label: 'По алфавиту' },
]

const time = (value) => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.getTime() : null
}

const startOfToday = (now) => {
  const day = new Date(now)
  day.setHours(0, 0, 0, 0)
  return day.getTime()
}

const DAY = 24 * 60 * 60 * 1000

/**
 * How full an event is, 0..1, or null when it cannot be known.
 *
 * Events that seat by hall plan carry capacity 0 -- their real capacity lives on
 * the hall, not the event -- so their fill is unknown rather than empty, and
 * they must not be ranked as if nothing had sold.
 */
export function fillRatio(event) {
  const capacity = event?.capacity ?? 0
  if (!capacity) return null
  return Math.min((event.tickets_sold ?? 0) / capacity, 1)
}

/** Sold out only makes sense where a capacity is actually recorded. */
export function isSoldOut(event) {
  const capacity = event?.capacity ?? 0
  return capacity > 0 && (event.tickets_sold ?? 0) >= capacity
}

export function matchesSearch(event, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [event.title, event.location]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(needle))
}

/**
 * Rolling windows measured from the start of today, so an event earlier the
 * same day still counts as "today" instead of falling out of every bucket.
 */
export function matchesDate(event, filter, now = Date.now()) {
  if (filter === 'all') return true
  const at = time(event.date)
  if (at === null) return false

  const from = startOfToday(now)
  const spans = { today: DAY, week: 7 * DAY, month: 30 * DAY }
  const span = spans[filter]
  if (!span) return true
  return at >= from && at < from + span
}

/**
 * Deliberately the same rule the card's own badge uses, so the filter always
 * agrees with the label the reader can see on the card. Note this is NOT
 * `seats_left > 0`: seats_left is 0 for every hall-seated event, which would
 * hide exactly the events that have the most seats free.
 */
export function matchesStatus(event, filter, now = Date.now()) {
  if (filter === 'all') return true
  const at = time(event.date)
  const past = at !== null && at < now
  if (filter === 'finished') return past
  if (filter === 'available') return !past && !isSoldOut(event)
  return true
}

export function compareEvents(a, b, sort) {
  if (sort === 'title') {
    return String(a.title ?? '').localeCompare(String(b.title ?? ''), 'ru')
  }

  if (sort === 'fill') {
    const left = fillRatio(a)
    const right = fillRatio(b)
    // Unknown fill sinks to the bottom rather than tying with an empty event.
    if (left === null && right === null) return 0
    if (left === null) return 1
    if (right === null) return -1
    return right - left
  }

  const left = time(a.date)
  const right = time(b.date)
  // Undated events go last whichever way the dates are pointing.
  if (left === null && right === null) return 0
  if (left === null) return 1
  if (right === null) return -1
  return sort === 'date-desc' ? right - left : left - right
}

export function applyFilters(events, filters, now = Date.now()) {
  if (!Array.isArray(events)) return []
  return events
    .filter((event) => matchesSearch(event, filters.query))
    .filter((event) => matchesDate(event, filters.date, now))
    .filter((event) => matchesStatus(event, filters.status, now))
    .sort((a, b) => compareEvents(a, b, filters.sort))
}

/** True when anything is set away from its default, i.e. a reset would do something. */
export function isFiltered(filters) {
  return (
    filters.query.trim() !== DEFAULTS.query ||
    filters.date !== DEFAULTS.date ||
    filters.status !== DEFAULTS.status ||
    filters.sort !== DEFAULTS.sort
  )
}
