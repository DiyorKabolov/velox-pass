/**
 * The recurrence rule as the admin screens hold it, and the expansion that
 * turns it into actual moments.
 *
 * The expansion mirrors what the backend does when the rule is submitted, so
 * the preview promises exactly what gets created. Where the two must agree,
 * this file says so.
 */

/** Monday first, matching the rule's 0..6 and the way a week reads here. */
export const WEEKDAYS = [
  { value: 0, short: 'Пн', long: 'Понедельник' },
  { value: 1, short: 'Вт', long: 'Вторник' },
  { value: 2, short: 'Ср', long: 'Среда' },
  { value: 3, short: 'Чт', long: 'Четверг' },
  { value: 4, short: 'Пт', long: 'Пятница' },
  { value: 5, short: 'Сб', long: 'Суббота' },
  { value: 6, short: 'Вс', long: 'Воскресенье' },
]

/** Matches MAX_RECURRING_SESSIONS on the backend, which enforces it. */
export const MAX_SESSIONS = 200

/** JS counts weekdays from Sunday; the rule counts from Monday. */
const weekdayOf = (date) => (date.getDay() + 6) % 7

const pad = (value) => String(value).padStart(2, '0')

/** "2026-09-05" as a local date. new Date(string) would read it as UTC and,
 *  west of Greenwich, land on the day before. */
function parseDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? '').trim())
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? null : date
}

const addDays = (date, days) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)

/** "9:5" and " 09:05 " both mean 09:05; anything else means nothing. */
export function parseTime(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? '').trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

/** Valid times only, deduplicated and in order — the same as the API returns. */
export function normaliseTimes(times) {
  const seen = new Map()
  for (const item of times ?? []) {
    const parsed = parseTime(item)
    if (parsed) seen.set(parsed.hour * 60 + parsed.minute, parsed)
  }
  return [...seen.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, time]) => time)
}

export const formatTime = ({ hour, minute }) => `${pad(hour)}:${pad(minute)}`

export const todayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** A fresh rule: today, one evening showing, a fortnight of it. */
export function emptyRule() {
  const start = todayIso()
  const end = new Date()
  end.setDate(end.getDate() + 14)
  return {
    days: [],
    times: ['19:00'],
    startDate: start,
    endType: 'date',
    endDate: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    endCount: 10,
  }
}

/**
 * Every moment the rule describes, as local Date objects in order.
 *
 * Stops one past MAX_SESSIONS: the caller only needs to know the rule went over
 * the limit, and walking out a decade of dates to count them exactly would cost
 * the preview its responsiveness.
 */
export function expandRule(rule) {
  const days = new Set(rule?.days ?? [])
  const times = normaliseTimes(rule?.times)
  const start = parseDate(rule?.startDate)
  if (!days.size || !times.length || !start) return []

  const byDate = rule.endType !== 'count'
  const count = Number(rule.endCount)
  // Bound the walk. An end date does it by itself; a count needs its own stop,
  // or a rule whose weekdays never come round would walk forever.
  const last = byDate ? parseDate(rule.endDate) : addDays(start, 730)
  if (!last || last < start) return []
  if (!byDate && (!Number.isFinite(count) || count < 1)) return []

  const moments = []
  for (let day = start; day <= last; day = addDays(day, 1)) {
    if (!days.has(weekdayOf(day))) continue
    for (const time of times) {
      moments.push(
        new Date(day.getFullYear(), day.getMonth(), day.getDate(), time.hour, time.minute),
      )
      if (!byDate && moments.length >= count) return moments
      if (moments.length > MAX_SESSIONS) return moments
    }
  }
  return moments
}

/** Human-readable reason the rule cannot be submitted, or null. */
export function validateRule(rule) {
  if (!rule.days?.length) return 'Выберите хотя бы один день недели'
  if (!normaliseTimes(rule.times).length) return 'Добавьте хотя бы одно время'
  if ((rule.times ?? []).some((time) => !parseTime(time))) {
    return 'Время указывается как ЧЧ:ММ'
  }
  if (!parseDate(rule.startDate)) return 'Укажите дату начала'

  if (rule.endType === 'count') {
    const count = Number(rule.endCount)
    if (!Number.isFinite(count) || count < 1) return 'Укажите количество сеансов'
    if (count > MAX_SESSIONS) return `За один раз можно создать не больше ${MAX_SESSIONS}`
  } else {
    const end = parseDate(rule.endDate)
    if (!end) return 'Укажите дату окончания'
    if (end < parseDate(rule.startDate)) return 'Дата окончания раньше даты начала'
  }

  const moments = expandRule(rule)
  if (!moments.length) return 'По этим правилам не выпадает ни одного сеанса'
  if (moments.length > MAX_SESSIONS) {
    return `Получается больше ${MAX_SESSIONS} сеансов — сократите период`
  }
  return null
}

/** The rule in the shape the API takes. */
export function ruleToPayload(rule) {
  return {
    days_of_week: [...rule.days].sort((a, b) => a - b),
    times: normaliseTimes(rule.times).map(formatTime),
    start_date: rule.startDate,
    end_type: rule.endType,
    end_date: rule.endType === 'date' ? rule.endDate : null,
    end_count: rule.endType === 'count' ? Number(rule.endCount) : null,
    // The times above are wall clock. Without the offset the server would read
    // them as UTC and file every showing at the wrong hour.
    tz_offset_minutes: -new Date().getTimezoneOffset(),
  }
}
