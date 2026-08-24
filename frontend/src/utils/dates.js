const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function toDate(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const pad = (n) => String(n).padStart(2, '0')

/** "12 March 2026, 19:30" */
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

/** "in 3 days" / "2 hours ago" */
export function relativeTime(value) {
  const date = toDate(value)
  if (!date) return '—'
  const diff = date.getTime() - Date.now()
  const abs = Math.abs(diff)
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  let amount
  let unit
  if (abs < hour) {
    amount = Math.round(abs / minute)
    unit = 'minute'
  } else if (abs < day) {
    amount = Math.round(abs / hour)
    unit = 'hour'
  } else {
    amount = Math.round(abs / day)
    unit = 'day'
  }

  const plural = amount === 1 ? '' : 's'
  return diff >= 0 ? `in ${amount} ${unit}${plural}` : `${amount} ${unit}${plural} ago`
}
