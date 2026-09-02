import { plural } from './plural'

// Genitive case: the format reads "12 марта 2026", where the month follows the
// day number and has to agree with it. Nominative ("март") would be wrong there.
const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
]

// Nominative: these stand on their own in a day heading rather than following
// a number, so "сентябрь" would be wrong only where MONTHS above is right.
const WEEKDAYS = [
  'Воскресенье', 'Понедельник', 'Вторник', 'Среда',
  'Четверг', 'Пятница', 'Суббота',
]

export const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

export const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'мая', 'июн',
  'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
]

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const pad = (n) => String(n).padStart(2, '0')

/** "12 марта 2026, 19:30" */
export function formatDate(value) {
  const date = toDate(value)
  if (!date) return '—'
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "12.03.2026" */
export function formatShortDate(value) {
  const date = toDate(value)
  if (!date) return '—'
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

/** "19:30" */
export function formatTime(value) {
  const date = toDate(value)
  if (!date) return '—'
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** True when the moment has already passed. */
export function isExpired(value) {
  const date = toDate(value)
  if (!date) return false
  return date.getTime() < Date.now()
}

/** "через 3 дня" / "2 часа назад" */
export function relativeTime(value) {
  const date = toDate(value)
  if (!date) return '—'
  const diff = date.getTime() - Date.now()
  const abs = Math.abs(diff)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  let amount
  let word
  if (abs < hour) {
    amount = Math.round(abs / minute)
    // The accusative singular happens to serve both directions here:
    // "через минуту" and "минуту назад".
    word = plural(amount, 'минуту', 'минуты', 'минут')
  } else if (abs < day) {
    amount = Math.round(abs / hour)
    word = plural(amount, 'час', 'часа', 'часов')
  } else {
    amount = Math.round(abs / day)
    word = plural(amount, 'день', 'дня', 'дней')
  }

  return diff >= 0 ? `через ${amount} ${word}` : `${amount} ${word} назад`
}

/** "2026-05-15" — local calendar date, not UTC. */
export function formatIsoDate(value) {
  const date = toDate(value)
  if (!date) return '—'
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** "01.12.2026 20:00" — the format used on the ticket card. */
export function formatDateTime(value) {
  const date = toDate(value)
  if (!date) return '—'
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** "2026-09-06T14:49" — the shape <input type="datetime-local"> expects. */
export function toDatetimeLocal(value) {
  const date = toDate(value)
  if (!date) return ''
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  )
}

/** datetime-local (local time, no zone) back to an ISO string for the API. */
export function fromDatetimeLocal(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

/** "Пятница, 5 сентября" — the heading over one day of a schedule.
 *
 *  Today and tomorrow are named instead: on a timetable that is what the reader
 *  is actually looking for, and the date alone makes them work it out.
 */
export function formatDayLabel(value) {
  const date = toDate(value)
  if (!date) return '—'

  const midnight = new Date()
  midnight.setHours(0, 0, 0, 0)
  const days = Math.round((startOfDay(date) - midnight) / 86_400_000)
  const day = `${date.getDate()} ${MONTHS[date.getMonth()]}`

  if (days === 0) return `Сегодня, ${day}`
  if (days === 1) return `Завтра, ${day}`
  return `${WEEKDAYS[date.getDay()]}, ${day}`
}

/** Midnight of the day a moment falls on, in local time. */
export function startOfDay(value) {
  const date = toDate(value)
  if (!date) return null
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** "2026-09-05" for the local day a moment falls on — a stable grouping key. */
export function dayKey(value) {
  const date = toDate(value)
  if (!date) return ''
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
