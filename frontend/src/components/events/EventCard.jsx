import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { formatDate, isExpired } from '../../utils/dates'
import { getCardColors } from '../../utils/colors'

// Used by the parent list to stagger cards in.
export const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
}

export default function EventCard({ event }) {
  const colors = getCardColors(event)
  const past = isExpired(event.date)
  const sold = event.tickets_sold ?? 0
  const capacity = event.capacity ?? 0
  const fillPercent = capacity ? Math.min(Math.round((sold / capacity) * 100), 100) : 0
  const soldOut = capacity > 0 && sold >= capacity

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className="w-full max-w-[320px]"
    >
      <Link
        to={`/event/${event.id}`}
        className="group block overflow-hidden rounded-[var(--radius)] shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-shadow duration-300 hover:shadow-[0_14px_36px_rgba(0,0,0,0.45)]"
        style={{ background: colors.bg, color: colors.text }}
      >
        <div className="h-1.5 w-full" style={{ background: colors.accent }} />

        <div className="flex h-[210px] flex-col p-5">
          <span
            className="mb-2 font-mono2 text-[10px] uppercase tracking-[0.14em]"
            style={{ color: colors.accent }}
          >
            {past ? 'Finished' : soldOut ? 'Sold out' : 'On sale'}
          </span>

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
                  {/* Fills from empty so the number and the bar read together. */}
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: colors.accent }}
                    initial={{ width: 0 }}
                    animate={{ width: `${fillPercent}%` }}
                    transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm font-medium opacity-80 transition-opacity duration-200 group-hover:opacity-100">
                Details
              </span>
              <ArrowRight
                size={18}
                className="transition-transform duration-300 group-hover:translate-x-1.5"
                style={{ color: colors.accent }}
              />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
