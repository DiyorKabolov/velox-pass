import { Armchair } from 'lucide-react'
import { dayKey, formatDayHeading, formatTime } from '../../utils/dates'
import { withAlpha } from '../../utils/colors'
import { formatPrice } from '../../utils/ticketGroups'

/**
 * Which showing to book, grouped under the day it falls on.
 *
 * A cinema runs the same film several times a day, and a flat list of
 * timestamps makes the reader parse the date again on every line. Grouping
 * states the day once and leaves the times to be compared against each other.
 */
export default function SessionPicker({
  sessions,
  colors,
  disabled = false,
  selectedId = null,
  highlightedId = null,
  highlightRef,
  onSelect,
}) {
  const days = []
  for (const session of sessions) {
    const key = dayKey(session.datetime)
    const last = days[days.length - 1]
    if (last?.key === key) last.items.push(session)
    else days.push({ key, items: [session] })
  }

  return (
    <div className="space-y-4">
      {days.map((day) => (
        <div key={day.key}>
          <p className="mb-2 text-[11px] uppercase tracking-[0.1em] opacity-55">
            {formatDayHeading(day.items[0].datetime)}
          </p>

          <div className="flex flex-wrap gap-2">
            {day.items.map((session) => {
              const soldOut = session.seats_free <= 0
              const unavailable = disabled || soldOut
              const selected = session.id === selectedId
              const highlighted = session.id === highlightedId

              return (
                <button
                  key={session.id}
                  type="button"
                  ref={highlighted ? highlightRef : null}
                  disabled={unavailable}
                  onClick={() => onSelect(session)}
                  className="min-w-[132px] flex-1 rounded-[var(--radius-sm)] border px-3 py-2.5 text-left transition-all duration-150 enabled:hover:brightness-95 enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
                  style={{
                    // The border carries the selection and the fill only
                    // supports it: a fill strong enough to read on its own
                    // would compete with the seat map that follows.
                    borderColor:
                      selected || highlighted
                        ? colors.accent
                        : withAlpha(colors.text, 0.14),
                    background: withAlpha(colors.accent, selected ? 0.18 : 0.07),
                    boxShadow: highlighted ? `0 0 0 1px ${colors.accent}` : undefined,
                  }}
                >
                  <span
                    className="block font-mono2 text-lg font-bold leading-none"
                    style={{ color: colors.accent }}
                  >
                    {formatTime(session.datetime)}
                  </span>

                  {session.hall_name && (
                    <span className="mt-1.5 block truncate text-[11px] opacity-60">
                      {session.hall_name}
                    </span>
                  )}

                  <span
                    className="mt-1.5 flex items-center gap-1 text-[11px]"
                    style={{ color: soldOut ? 'var(--err)' : 'var(--ok)' }}
                  >
                    <Armchair size={11} className="shrink-0" />
                    {soldOut ? 'Мест нет' : `${session.seats_free} свободно`}
                  </span>

                  {session.min_price != null && (
                    <span className="mt-0.5 block font-mono2 text-[10px] opacity-55">
                      от {formatPrice(session.min_price)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
