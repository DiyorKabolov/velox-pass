import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDate, isExpired } from '../../utils/dates'
import { getCardColors } from '../../utils/colors'

export default function EventCard({ event }) {
  const colors = getCardColors(event)
  const past = isExpired(event.date)
  const sold = event.tickets_sold ?? 0
  const capacity = event.capacity ?? 0
  const fillPercent = capacity ? Math.min(Math.round((sold / capacity) * 100), 100) : 0
  const soldOut = capacity > 0 && sold >= capacity

  return (
    <Link
      to={`/event/${event.id}`}
      className="group block w-[290px] overflow-hidden rounded-[var(--radius)] transition-transform duration-200 hover:-translate-y-1"
      style={{ background: colors.bg, color: colors.text }}
    >
      <div className="h-1.5 w-full" style={{ background: colors.accent }} />

      <div className="flex h-[210px] flex-col p-5">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="font-mono2 text-[10px] uppercase tracking-[0.14em]"
            style={{ color: colors.accent }}
          >
            {past ? 'Finished' : soldOut ? 'Sold out' : 'On sale'}
          </span>
        </div>

        <h3 className="font-display text-lg leading-snug line-clamp-2">{event.title}</h3>

        <p className="mt-2 text-sm opacity-70">{formatDate(event.date)}</p>
        {event.location && (
          <p className="mt-0.5 truncate text-sm opacity-55">{event.location}</p>
        )}

        <div className="mt-auto">
          {capacity > 0 && (
            <div className="mb-3">
              <div className="mb-1 flex justify-between font-mono2 text-[10px] opacity-60">
                <span>
                  {sold} / {capacity}
                </span>
                <span>{fillPercent}%</span>
              </div>
              <div
                className="h-1 w-full overflow-hidden rounded-full"
                style={{ background: 'rgba(0,0,0,0.10)' }}
              >
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{ width: `${fillPercent}%`, background: colors.accent }}
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-medium opacity-80">Details</span>
            <ArrowRight
              size={18}
              className="transition-transform duration-200 group-hover:translate-x-1"
              style={{ color: colors.accent }}
            />
          </div>
        </div>
      </div>
    </Link>
  )
}
