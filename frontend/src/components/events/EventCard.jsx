import { ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { formatDate, isExpired } from '../../utils/dates'
import { getCardColors } from '../../utils/colors'
import { orderTags, tagColor } from '../../utils/eventTags'
import { pluralize } from '../../utils/plural'

// Used by the parent list to stagger cards in.
export const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] } },
}

export default function EventCard({ event }) {
  const colors = getCardColors(event)
  const past = isExpired(event.date)
  const sold = event.tickets_sold ?? 0
  const tags = orderTags(event.tags)

  // total_seats / available_seats are the fields to read for both kinds of
  // event: for a seated one they come from the hall map of its live sessions,
  // where event.capacity is 0 and would draw an empty bar; for an ordinary one
  // the API mirrors capacity into them.
  const total = event.total_seats ?? event.capacity ?? 0
  // available_seats falls back to a figure derived from what the payload does
  // carry, never to 0: a server that predates these fields would otherwise make
  // every event read "0 мест свободно, 100%" -- a confident wrong number rather
  // than a visibly missing one.
  const available = event.available_seats ?? Math.max(total - sold, 0)
  const taken = Math.max(total - available, 0)
  const fillPercent = total ? Math.min(Math.round((taken / total) * 100), 100) : 0
  // A seated event with no live session has nothing on sale, whatever its halls
  // hold; an unseated one is sold out once the counter reaches capacity.
  const soldOut = event.has_seats
    ? event.has_active_session === false || (total > 0 && available <= 0)
    : total > 0 && sold >= total

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

        {/* Fixed so every card in the row is the same height, and sized for the
            tallest combination -- a two-line title plus a row of tags, 244.5px
            of content in 20px padding. At the old 210px a two-line title alone
            already overflowed by 7.5px; the flex children then shrank below
            their own line height and the text ran over itself. */}
        <div className="flex h-[252px] flex-col p-5">
          <span
            className="mb-2 shrink-0 font-mono2 text-[10px] uppercase tracking-[0.14em]"
            style={{ color: colors.accent }}
          >
            {past ? 'Завершено' : soldOut ? 'Мест нет' : 'В продаже'}
          </span>

          <h3 className="shrink-0 font-display text-lg leading-snug line-clamp-2">
            {event.title}
          </h3>

          {tags.length > 0 && (
            // One row, never two: the card's height is fixed, so a wrapping
            // second row of tags would push the rest of the content out of it.
            // Anything past the first two is counted instead, and the full set
            // is on the event page.
            <div className="mt-2 flex shrink-0 flex-nowrap gap-1">
              {tags.slice(0, 2).map((tag) => (
                <span
                  key={tag}
                  className="truncate rounded-full px-2 py-0.5 text-[10px] font-medium"
                  style={{ background: `${tagColor(tag)}33`, color: colors.text }}
                >
                  {tag}
                </span>
              ))}
              {tags.length > 2 && (
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium opacity-60"
                  style={{ background: `${colors.accent}22` }}
                >
                  +{tags.length - 2}
                </span>
              )}
            </div>
          )}

          <p className="mt-2 shrink-0 text-sm opacity-70">{formatDate(event.date)}</p>
          {event.location && (
            <p className="mt-0.5 shrink-0 truncate text-sm opacity-55">{event.location}</p>
          )}

          <div className="mt-auto">
            {total > 0 && (
              <div className="mb-3">
                <div className="mb-1 flex justify-between font-mono2 text-[10px] opacity-60">
                  <span>
                    {pluralize(available, 'место', 'места', 'мест')} свободно
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
                Подробнее
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
