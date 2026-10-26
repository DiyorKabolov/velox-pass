import { eventEndsAt, isEventOver, isEventSoldOut, seatCounts } from './eventState'

/**
 * Filtering and sorting for the listing page. Kept apart from the page so the
 * rules are testable on their own and the component stays about layout.
 */

export const DEFAULTS = {
  query: '',
  date: 'all',
  status: 'all',
  sort: 'date-asc',
  // Empty means "any tag". Filtering happens in the browser alongside the other
  // filters rather than through the API's ?tags= parameter, so switching a tag
  // does not refetch the listing or clear the other filters mid-typing.
  tags: [],
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
  return day
}

/**
 * How full an event is, 0..1, or null when it cannot be known.
 *
 * Read from the same seat counts the card shows. Events that seat by hall
 * plan carry capacity 0 -- their seats live on the halls of their showings --
 * and ranking by capacity alone sent every one of them to the bottom as
 * "unknown". An event with no seats on record at all (no capacity, no live
 * showing) still is unknown, not empty, and sinks.
 */
export function fillRatio(event) {
  const { total, available } = seatCounts(event)
  if (!total) return null
  return Math.min(Math.max((total - available) / total, 0), 1)
}

/** An event matches when it carries at least one of the chosen tags. */
export function matchesTags(event, tags) {
  if (!tags || !tags.length) return true
  const own = event.tags
  if (!Array.isArray(own) || !own.length) return false
  return tags.some((tag) => own.includes(tag))
}

export function matchesSearch(event, query) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return [event.title, event.location]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(needle))
}

/**
 * Calendar windows, as the words say: "this week" runs to the end of Sunday
 * and "this month" to the end of the month -- not seven and thirty days from
 * now, which on a Sunday made "this week" reach to next Saturday. Each starts
 * at the beginning of today, so an event earlier the same day still counts as
 * "today" instead of falling out of every bucket.
 */
export function windowEnd(filter, now = Date.now()) {
  const end = startOfToday(now)
  if (filter === 'today') end.setDate(end.getDate() + 1)
  // To the coming Monday, 00:00 -- the week starts on Monday here.
  else if (filter === 'week') end.setDate(end.getDate() + 7 - ((end.getDay() + 6) % 7))
  else if (filter === 'month') end.setMonth(end.getMonth() + 1, 1)
  else return null
  return end.getTime()
}

export function matchesDate(event, filter, now = Date.now()) {
  if (filter === 'all') return true
  const at = time(event.date)
  if (at === null) return false
  // A series runs from its first showing to its last; it belongs to any
  // window it overlaps, not only to the one its first night falls in.
  const until = time(eventEndsAt(event)) ?? at

  const end = windowEnd(filter, now)
  if (end === null) return true
  return at < end && until >= startOfToday(now).getTime()
}

/**
 * The very rule behind the stamp on the card (isEventSoldOut), so the filter
 * always agrees with what the reader can see. Note this is NOT
 * `seats_left > 0`: seats_left is 0 for every hall-seated event, which would
 * hide exactly the events that have the most seats free.
 */
export function matchesStatus(event, filter, now = Date.now()) {
  if (filter === 'all') return true
  const past = isEventOver(event, now)
  if (filter === 'finished') return past
  if (filter === 'available') return !past && !isEventSoldOut(event)
  return true
}

export function compareEvents(a, b, sort, now = Date.now()) {
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
  if (sort === 'date-desc') return right - left

  // "Nearest first": what is still ahead, soonest first, and only then what
  // has passed -- most recent first. Plain ascending order put an event from
  // last year above everything still on sale.
  const aOver = isEventOver(a, now)
  const bOver = isEventOver(b, now)
  if (aOver !== bOver) return aOver ? 1 : -1
  return aOver ? right - left : left - right
}

export function applyFilters(events, filters, now = Date.now()) {
  if (!Array.isArray(events)) return []
  return events
    .filter((event) => matchesTags(event, filters.tags))
    .filter((event) => matchesSearch(event, filters.query))
    .filter((event) => matchesDate(event, filters.date, now))
    .filter((event) => matchesStatus(event, filters.status, now))
    .sort((a, b) => compareEvents(a, b, filters.sort, now))
}

/** True when anything is set away from its default, i.e. a reset would do something. */
export function isFiltered(filters) {
  return (
    filters.query.trim() !== DEFAULTS.query ||
    filters.date !== DEFAULTS.date ||
    filters.status !== DEFAULTS.status ||
    filters.sort !== DEFAULTS.sort ||
    (filters.tags?.length ?? 0) > 0
  )
}
