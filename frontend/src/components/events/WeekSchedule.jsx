import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { WEEKDAYS_SHORT, dayKey, formatTime } from '../../utils/dates'
import { pluralize } from '../../utils/plural'
import { formatFrom } from '../../utils/ticketGroups'

const DAY = 24 * 60 * 60 * 1000

const MONTHS_NOMINATIVE = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
]

/** "2026-09-15" back into a local date. */
const fromKey = (key) => {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day)
}

const mondayOf = (date) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  return start
}

/** "Сентябрь 2026", or "Сентябрь — Октябрь 2026" for a week across the turn. */
function monthsOf(week) {
  const first = week[0]
  const last = week[week.length - 1]
  if (first.getMonth() === last.getMonth()) {
    return `${MONTHS_NOMINATIVE[first.getMonth()]} ${first.getFullYear()}`
  }
  const tail = `${MONTHS_NOMINATIVE[last.getMonth()]} ${last.getFullYear()}`
  return first.getFullYear() === last.getFullYear()
    ? `${MONTHS_NOMINATIVE[first.getMonth()]} — ${tail}`
    : `${MONTHS_NOMINATIVE[first.getMonth()]} ${first.getFullYear()} — ${tail}`
}

/** Free seats are what a buyer acts on, so they only take a colour once they run short. */
function seatsColor(free) {
  if (free <= 0) return 'var(--err)'
  if (free < 20) return 'var(--warn)'
  return 'var(--text)'
}

/** The rows of a day rise one after another. */
const row = (index) => ({ '--rise': '10px', '--delay': `${Math.min(index, 8) * 50}ms` })

/**
 * The timetable a week at a time: seven days with a mark where something is
 * on, and the showings of the chosen day as rows beneath -- each with what it
 * costs, how much of it is left, and the button that buys it.
 *
 * `renderAction` decides what that button is: the page knows whether the reader
 * is signed in and whether the event is over, and this does not.
 */
export default function WeekSchedule({ sessions, selectedDay, onSelectDay, renderAction }) {
  const byDay = useMemo(() => {
    const groups = new Map()
    for (const session of sessions) {
      const key = dayKey(session.datetime)
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(session)
    }
    for (const list of groups.values()) list.sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
    return groups
  }, [sessions])

  const [weekStart, setWeekStart] = useState(() =>
    mondayOf(selectedDay ? fromKey(selectedDay) : new Date(sessions[0]?.datetime ?? Date.now())),
  )

  // A day chosen elsewhere -- a link to one showing -- brings its week into view.
  useEffect(() => {
    if (!selectedDay) return
    const day = fromKey(selectedDay)
    if (day < weekStart || day >= new Date(weekStart.getTime() + 7 * DAY)) {
      setWeekStart(mondayOf(day))
    }
    // Only the selected day moves the week; the arrows below must not bounce back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay])

  const week = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date(weekStart)
    date.setDate(date.getDate() + offset)
    return date
  })
  const shift = (weeks) => {
    const next = new Date(weekStart)
    next.setDate(next.getDate() + weeks * 7)
    setWeekStart(next)
  }

  const daySessions = selectedDay ? byDay.get(selectedDay) ?? [] : []
  const arrow =
    'grid h-9 w-9 place-items-center rounded-[var(--radius-sm)] border border-[var(--border2)] text-[var(--muted)] transition-[color,background-color,transform] duration-200 hover:bg-[var(--surface2)] hover:text-[var(--text)] active:scale-[0.94]'

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="font-display text-[19px] font-bold uppercase leading-none text-[var(--text)]">
          {monthsOf(week)}
        </p>
        <div className="flex gap-1.5">
          <button type="button" onClick={() => shift(-1)} aria-label="Предыдущая неделя" className={arrow}>
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <button type="button" onClick={() => shift(1)} aria-label="Следующая неделя" className={arrow}>
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 border-y border-[var(--border)]">
        {week.map((date, index) => {
          const key = dayKey(date)
          const has = byDay.has(key)
          const active = key === selectedDay
          return (
            <button
              key={key}
              type="button"
              disabled={!has}
              aria-pressed={active}
              aria-label={`${date.getDate()} число${has ? ', есть сеансы' : ''}`}
              onClick={() => onSelectDay(key)}
              className={[
                'relative flex flex-col items-center gap-1.5 py-3.5 transition-colors duration-200 disabled:cursor-default',
                index > 0 ? 'border-l border-[var(--border)]' : '',
                active
                  ? 'text-[var(--bg)]'
                  : has
                    ? 'text-[var(--text)] hover:bg-[var(--surface)]'
                    : 'text-[var(--muted2)]',
              ].join(' ')}
            >
              {active && (
                <motion.span
                  layoutId="week-day"
                  transition={{ type: 'spring', stiffness: 480, damping: 40 }}
                  className="absolute inset-0 bg-[var(--text)]"
                />
              )}
              <span className="relative text-[11px] font-semibold uppercase tracking-[0.06em] opacity-70">
                {WEEKDAYS_SHORT[date.getDay()]}
              </span>
              <span className="t-poster t-num relative text-[30px] leading-none sm:text-[34px]">
                {date.getDate()}
              </span>
              <span
                className="relative h-1 w-1 rounded-full"
                style={{ background: has && !active ? 'var(--accent)' : 'transparent' }}
              />
            </button>
          )
        })}
      </div>

      {/* Keyed by the day, so a newly picked day's rows arrive afresh. */}
      <ul key={selectedDay ?? 'none'}>
        {!selectedDay || !daySessions.length ? (
          <li className="anim-rise py-8 text-[15px] text-[var(--muted)]" style={row(0)}>
            В этот день сеансов нет.
          </li>
        ) : (
          daySessions.map((session, index) => {
            const soldOut = session.seats_free <= 0
            return (
              <li
                key={session.id}
                className="anim-rise group/session grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-3 border-b border-[var(--border)] py-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-8"
                style={{ ...row(index), opacity: soldOut ? 0.5 : 1 }}
              >
                <span className="t-poster t-num text-[40px] leading-none text-[var(--text)]">
                  {formatTime(session.datetime)}
                </span>
                <div className="min-w-0">
                  {session.hall_name && (
                    <p className="truncate text-[15px] text-[var(--text)]">{session.hall_name}</p>
                  )}
                  <p className="mt-1 text-[13px] text-[var(--muted)]">
                    <span style={{ color: seatsColor(session.seats_free) }}>
                      {soldOut
                        ? 'Мест нет'
                        : pluralize(session.seats_free, 'место', 'места', 'мест')}
                    </span>
                    {session.min_price != null && (
                      <>
                        <span aria-hidden className="mx-2 text-[var(--muted2)]">
                          /
                        </span>
                        {formatFrom(session.min_price)}
                      </>
                    )}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1 sm:justify-self-end">
                  {renderAction(session, soldOut)}
                </div>
              </li>
            )
          })
        )}
      </ul>
    </div>
  )
}
