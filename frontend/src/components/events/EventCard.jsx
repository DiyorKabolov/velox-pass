import { ArrowRight, CalendarDays, MapPin } from 'lucide-react'
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

/** #rrggbb plus two hex digits of alpha, for the gradients over the artwork. */
const alpha = (hex, hexAlpha) => `${hex}${hexAlpha}`

/**
 * Veils that dissolve the artwork into the card.
 *
 * Two of them, because the copy runs down the left and along the bottom: the
 * first keeps the left side solid card colour and lets the picture surface
 * towards the right, the second does the same upwards from the foot so the
 * seat counter and the progress bar stay legible. Both fade to the card's own
 * background rather than to black -- the card is light, and a dark scrim would
 * fight the dark text sitting on it.
 */
const veils = (bg) => [
  `linear-gradient(100deg, ${bg} 0%, ${bg} 38%, ${alpha(bg, 'd9')} 54%, ${alpha(bg, '00')} 92%)`,
  `linear-gradient(to top, ${bg} 6%, ${alpha(bg, 'b3')} 26%, ${alpha(bg, '00')} 52%)`,
]

/**
 * The veils above leave only the card's top-right corner clear, so that corner
 * is the whole of what anyone actually sees of the artwork -- and centred, the
 * picture offers it nothing but its right edge. Pushing the picture up and to
 * the right puts the middle of the photo in the one place the photo shows.
 *
 * The zoom is what makes the shift safe rather than a hole in the corner:
 * enlarged, the artwork overhangs the card by (ART_ZOOM - 1) / 2 on every side,
 * so any offset below that still covers the card edge to edge. Both offsets
 * here sit under that limit (35%), with the tighter margin on x.
 */
const ART_ZOOM = 1.7
const ART_TRANSFORM = `translate(30%, -22%) scale(${ART_ZOOM})`

/**
 * The backdrop for an event that has no artwork yet.
 *
 * Flat colour would make such a card read as a different, poorer object than
 * its neighbours, so the event's own accent is bloomed into the very corner the
 * photo would have filled, then allowed to fade into the card. Same shape, same
 * weight, no picture -- and each event keeps its own colour, because the bloom
 * is mixed from the accent the card already carries.
 */
const plainBackdrop = (accent) =>
  [
    `radial-gradient(115% 85% at 82% 18%, ${alpha(accent, '59')} 0%, ${alpha(accent, '26')} 38%, ${alpha(accent, '00')} 72%)`,
    `linear-gradient(155deg, ${alpha(accent, '1f')} 0%, ${alpha(accent, '00')} 58%)`,
  ].join(', ')

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

  const status = past ? 'Завершено' : soldOut ? 'Мест нет' : 'В продаже'

  return (
    <motion.div
      variants={cardVariants}
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className="group flex w-full max-w-[340px]"
    >
      <Link
        to={`/event/${event.id}`}
        className="relative flex w-full flex-col overflow-hidden rounded-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-shadow duration-200 hover:shadow-[0_16px_48px_rgba(0,0,0,0.4)]"
        style={{ background: colors.bg, color: colors.text, minHeight: 190 }}
      >
        {event.image_url ? (
          <>
            {/* The shift lives on a wrapper so the hover zoom, which is the
                image's own transform, does not overwrite it. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ transform: ART_TRANSFORM }}
            >
              <img
                src={event.image_url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </span>
            {veils(colors.bg).map((veil) => (
              <span
                key={veil}
                aria-hidden
                className="pointer-events-none absolute inset-0"
                style={{ background: veil }}
              />
            ))}
          </>
        ) : (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ background: plainBackdrop(colors.accent) }}
          />
        )}

        {/* Above the artwork, and drawn last so nothing veils it. */}
        <div
          className="absolute left-0 right-0 top-0 h-[3px]"
          style={{ background: colors.accent, zIndex: 2 }}
        />

        <div className="relative z-[1] flex min-w-0 flex-1 flex-col p-5 pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="rounded-full px-2 py-0.5 font-mono2 text-[9px] uppercase tracking-[0.12em]"
              style={{ background: alpha(colors.accent, '2e'), color: colors.text }}
            >
              {status}
            </span>
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: alpha(tagColor(tag), '33'), color: colors.text }}
              >
                {tag}
              </span>
            ))}
          </div>

          <h3 className="mt-2 line-clamp-2 font-display text-[16px] font-semibold leading-snug">
            {event.title}
          </h3>

          <p className="mt-2 flex items-center gap-1.5 text-xs opacity-70">
            <CalendarDays size={13} className="shrink-0" />
            <span className="truncate">{formatDate(event.date)}</span>
          </p>
          {event.location && (
            <p className="mt-1 flex items-center gap-1.5 text-xs opacity-70">
              <MapPin size={13} className="shrink-0" />
              <span className="truncate">{event.location}</span>
            </p>
          )}

          <div className="mt-auto pt-3">
            {total > 0 && (
              <div className="mb-2.5">
                <div className="mb-1 flex justify-between font-mono2 text-[10px] opacity-60">
                  <span className="truncate">
                    {pluralize(available, 'место', 'места', 'мест')} свободно
                  </span>
                  <span className="shrink-0">{fillPercent}%</span>
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

            <span
              className="inline-flex items-center gap-1 text-xs font-medium"
              style={{ color: colors.accent }}
            >
              Подробнее
              <ArrowRight
                size={13}
                className="transition-transform duration-300 group-hover:translate-x-1"
              />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}
