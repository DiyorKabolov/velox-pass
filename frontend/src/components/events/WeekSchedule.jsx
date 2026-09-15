import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { WEEKDAYS_SHORT, dayKey, formatTime } from '../../utils/dates'
import { pluralize } from '../../utils/plural'
import { formatPrice } from '../../utils/ticketGroups'

const DAY = 24 * 60 * 60 * 1000

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

/** Free seats are what a buyer acts on, so they carry the warning. */
function seatsColor(free) {
  if (free <= 0) return 'var(--err)'
  if (free < 20) return 'var(--warn)'
  return 'var(--ok)'
}

function Dot() {
  return (
    <span aria-hidden className="text-[var(--muted2)]">
      ·
    </span>
  )
}

/**
 * The timetable a week at a time: seven days with a dot where something is on,
 * and the showings of the chosen day as rows beneath -- each with what it costs,
 * how much of it is left, and the button that buys it.
 *
 * `renderAction` decides what that button is: the page knows whether the reader
 * is signed in and whether the event is over, and this does not.
 */
export default function WeekSchedule({ sessions, selectedDay, onSelectDay, accent, renderAction }) {
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

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => shift(-1)}
          aria-label="Предыдущая неделя"
          className="shrink-0 rounded-full border border-[var(--border)] p-2 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
        >
          <ChevronLeft size={16} />
        </button>

        <div className="grid flex-1 grid-cols-7 gap-1.5">
          {week.map((date) => {
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
                className="flex flex-col items-center rounded-[var(--radius-sm)] border py-2 text-xs transition-colors disabled:cursor-default"
                style={{
                  borderColor: active ? accent : 'var(--border)',
                  background: active ? accent : 'transparent',
                  color: active ? 'var(--bg)' : has ? 'var(--text)' : 'var(--muted2)',
                }}
              >
                <span className="opacity-70">{WEEKDAYS_SHORT[date.getDay()]}</span>
                <span className="mt-0.5 text-sm font-semibold">{date.getDate()}</span>
                <span
                  className="mt-1 h-1 w-1 rounded-full"
                  style={{ background: has && !active ? accent : 'transparent' }}
                />
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={() => shift(1)}
          aria-label="Следующая неделя"
          className="shrink-0 rounded-full border border-[var(--border)] p-2 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="mt-5 space-y-2.5">
        {!selectedDay || !daySessions.length ? (
          <p className="py-4 text-center text-sm text-[var(--muted)]">В этот день сеансов нет.</p>
        ) : (
          daySessions.map((session) => {
            const soldOut = session.seats_free <= 0
            return (
              <div
                key={session.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5"
                style={{ opacity: soldOut ? 0.6 : 1 }}
              >
                <span className="font-mono2 text-lg font-bold" style={{ color: accent }}>
                  {formatTime(session.datetime)}
                </span>
                {session.hall_name && (
                  <>
                    <Dot />
                    <span className="text-sm text-[var(--muted)]">{session.hall_name}</span>
                  </>
                )}
                <Dot />
                <span className="text-sm" style={{ color: seatsColor(session.seats_free) }}>
                  {soldOut ? 'Мест нет' : pluralize(session.seats_free, 'место', 'места', 'мест')}
                </span>
                {session.min_price != null && (
                  <>
                    <Dot />
                    <span className="text-sm text-[var(--muted)]">
                      от {formatPrice(session.min_price)}
                    </span>
                  </>
                )}
                <div className="ml-auto">{renderAction(session, soldOut)}</div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
