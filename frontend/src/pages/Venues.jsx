import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowRight, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getPublicVenues, getVenueSessions } from '../api/venues'
import { formatTime, formatWhenShort } from '../utils/dates'
import { pluralize } from '../utils/plural'
import { inkFor } from '../utils/colors'
import { createHoverSequence } from '../utils/hoverSequence'
import { venueTypeColor, venueTypeLabel } from '../utils/venueTypes'
import { CONTAINER, EmptyState, PageHeader } from '../components/ui/Page'
import { Reveal } from '../components/motion/Motion'

// Height of a row with its showings folded away. max-height doubles as the
// clip, so this has to hold the whole header at desktop widths: a 56px name on
// one line, the type and address line, the counts line, and the padding.
const COLLAPSED = 168
// The panel of showings beneath: padding, a 132px-wide poster at 4:5, the time
// and the seats line. Measured, not picked by eye -- too little cuts the last
// line off, too much leaves the hover target hanging below the content.
const PANEL = 282
const EXPANDED = COLLAPSED + PANEL
// With nothing on, the panel holds one line and a button, and opening the full
// height for them would leave a hole under the row.
const EMPTY_PANEL = 92
// Long enough to cross the gap between two rows, or the panel flickers shut
// while the pointer travels.
const COLLAPSE_DELAY = 200
// Matches the max-height transition below. Moving to another row waits this
// out, so two are never in motion together.
const TRANSITION_MS = 450
const PREVIEW_LIMIT = 6

const FILTERS = [
  { value: 'all', label: 'Все' },
  { value: 'cinema', label: 'Кинотеатры' },
  { value: 'theater', label: 'Театры' },
  { value: 'concert', label: 'Концертные залы' },
  { value: 'stadium', label: 'Стадионы' },
]

/** Reads a media query, and keeps reading it as the window changes. */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = (event) => setMatches(event.matches)
    // Re-read on mount as well: the first paint may predate a resize.
    setMatches(media.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

/** One upcoming showing as a small poster, several to a row. */
function SessionMini({ session }) {
  const soldOut = (session.available_seats ?? 0) <= 0
  const accent = session.card_accent || '#3b3732'

  return (
    <Link
      to={`/event/${session.event_id}?session=${session.session_id}`}
      title={session.event_title}
      className="group/mini block w-[132px] shrink-0 snap-start"
    >
      <div
        className="relative flex aspect-[4/5] flex-col justify-end overflow-hidden rounded-[3px] p-2.5 transition-transform duration-500 ease-out group-hover/mini:-translate-y-1"
        style={{ background: accent, color: inkFor(accent) }}
      >
        {session.event_image_url ? (
          <img
            src={session.event_image_url}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <p className="t-poster line-clamp-5 text-[19px]" style={{ overflowWrap: 'anywhere' }}>
            {session.event_title}
          </p>
        )}
      </div>
      <p className="t-poster t-num mt-2.5 text-[24px] leading-none text-[var(--text)]">
        {formatTime(session.datetime)}
      </p>
      <p className="mt-1 truncate text-[12px] text-[var(--muted)]">
        {soldOut
          ? 'мест нет'
          : pluralize(session.available_seats, 'место', 'места', 'мест')}
      </p>
    </Link>
  )
}

function SkeletonMini() {
  return (
    <div className="w-[132px] shrink-0">
      <div className="skeleton aspect-[4/5] rounded-[3px]" />
      <div className="skeleton mt-2.5 h-5 w-14 rounded-[2px]" />
      <div className="skeleton mt-1.5 h-3 w-20 rounded-[2px]" />
    </div>
  )
}

function VenueRow({ venue, index, mobile, primed, open, onEnter, onLeave }) {
  const color = venueTypeColor(venue.type)

  // Latched on the first hover and never unlatched, so leaving and coming back
  // does not refetch. The set lives in the parent so it also survives a row
  // being remounted.
  const [armed, setArmed] = useState(() => primed.current.has(venue.id))

  const { data: sessions, isLoading } = useQuery({
    queryKey: ['venues', venue.id, 'preview'],
    queryFn: () => getVenueSessions(venue.id),
    // The whole point of the lazy load: nothing is requested until the pointer
    // arrives, and never on a phone, where the panel does not open at all.
    enabled: armed && !mobile,
    staleTime: 60_000,
  })

  const enter = () => {
    if (mobile) return
    // Arming happens on the way in, not when the panel finally opens: the
    // request then runs while the previous row is still collapsing, and the
    // sessions are usually there by the time this one shows them.
    primed.current.add(venue.id)
    setArmed(true)
    onEnter(venue.id)
  }

  const leave = () => {
    if (mobile) return
    onLeave(venue.id)
  }

  const upcoming = (sessions ?? []).slice(0, PREVIEW_LIMIT)
  const empty = !isLoading && upcoming.length === 0
  const panel = empty ? EMPTY_PANEL : PANEL

  const head = (
    <div
      className="relative grid grid-cols-[40px_minmax(0,1fr)] gap-x-4 py-6 sm:grid-cols-[64px_minmax(0,1fr)_auto] sm:gap-x-6"
      style={{ minHeight: mobile ? undefined : COLLAPSED }}
    >
      <span className="t-poster t-num pt-1 text-[22px] text-[var(--muted2)] sm:text-[28px]">
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="min-w-0">
        <h2 className="t-poster truncate text-[clamp(34px,4.4vw,56px)] text-[var(--text)] transition-colors duration-300">
          {venue.name}
        </h2>
        {/* One line, never two: the row's height is fixed by COLLAPSED. */}
        <p className="mt-3 flex min-w-0 items-center gap-x-3 text-[14px] text-[var(--muted)]">
          <span className="inline-flex shrink-0 items-center gap-2 text-[var(--text)]">
            <span aria-hidden className="h-2 w-2 rounded-[1px]" style={{ background: color }} />
            {venueTypeLabel(venue.type)}
          </span>
          {venue.address && <span className="min-w-0 truncate">{venue.address}</span>}
        </p>
        <p className="t-num mt-1.5 flex flex-wrap items-center gap-x-3 text-[13px] text-[var(--muted2)]">
          <span>{pluralize(venue.halls_count ?? 0, 'зал', 'зала', 'залов')}</span>
          <span aria-hidden>/</span>
          <span>
            {pluralize(
              venue.active_events_count ?? 0,
              'мероприятие',
              'мероприятия',
              'мероприятий',
            )}
          </span>
          {venue.next_session_at && (
            <>
              <span aria-hidden>/</span>
              <span className="text-[var(--muted)]">
                Ближайший: {formatWhenShort(venue.next_session_at)}
              </span>
            </>
          )}
        </p>
      </div>

      {venue.image_url && (
        <div className="hidden h-[116px] overflow-hidden rounded-[3px] sm:block sm:w-[200px] lg:w-[240px]">
          <img
            src={venue.image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover opacity-90 transition-[opacity,transform] duration-700 ease-out group-hover:scale-[1.03] group-hover:opacity-100"
          />
        </div>
      )}
    </div>
  )

  const shell =
    'group relative block w-full overflow-hidden border-b border-[var(--border)] px-1 transition-colors duration-300 sm:px-3'

  if (mobile) {
    return (
      <Link to={`/venues/${venue.id}`} className={shell}>
        {head}
      </Link>
    )
  }

  return (
    <article
      onMouseEnter={enter}
      onMouseLeave={leave}
      className={`${shell} ${open ? 'bg-[var(--surface)]' : 'hover:bg-[var(--surface)]'}`}
      style={{
        maxHeight: open ? COLLAPSED + panel : COLLAPSED,
        // Written out rather than composed from Tailwind classes: the panel and
        // the colour change want different durations.
        transition: `max-height ${TRANSITION_MS}ms cubic-bezier(0.16, 1, 0.3, 1), background-color .3s ease`,
      }}
    >
      {/* The name is the link; the rest of the row is a hover surface, so the
          whole thing must not be one. */}
      <Link
        to={`/venues/${venue.id}`}
        aria-label={venue.name}
        className="absolute inset-x-0 top-0 z-20"
        style={{ height: COLLAPSED }}
      />

      {head}

      <div
        className={`scrollbar-none flex snap-x snap-mandatory gap-4 overflow-x-auto pl-[64px] pr-1 sm:pl-[88px] ${
          empty ? 'items-center pb-6' : 'items-start pb-7 pt-1'
        }`}
        style={{ height: panel }}
      >
        {isLoading && [0, 1, 2, 3].map((key) => <SkeletonMini key={key} />)}

        {!isLoading &&
          upcoming.map((session, position) => (
            // In one after another as the row opens; all at once, and at
            // once, as it closes.
            <div
              key={session.session_id}
              className="transition-[opacity,transform] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
              style={{
                opacity: open ? 1 : 0,
                transform: open ? 'none' : 'translate3d(0, 12px, 0)',
                transitionDelay: open ? `${120 + position * 50}ms` : '0ms',
              }}
            >
              <SessionMini session={session} />
            </div>
          ))}

        {empty && <p className="text-[14px] text-[var(--muted)]">Нет предстоящих сеансов</p>}

        <Link
          to={`/venues/${venue.id}`}
          className="ml-auto inline-flex shrink-0 items-center gap-2 self-center whitespace-nowrap rounded-[var(--radius-sm)] border border-[var(--border2)] px-4 py-2.5 text-[14px] text-[var(--text)] transition-colors duration-200 hover:border-[var(--muted2)] hover:bg-[var(--surface2)]"
        >
          Все сеансы
          <ArrowRight size={14} strokeWidth={1.75} />
        </Link>
      </div>
    </article>
  )
}

export default function Venues() {
  const mobile = useMediaQuery('(max-width: 767px)')
  // Which venues have ever been hovered. A ref, not state: it must not cause a
  // render, and it has to outlive any row that unmounts.
  const primed = useRef(new Set())
  const [filter, setFilter] = useState('all')

  // One row open at a time, and never two in motion at once. The sequencing
  // lives in hoverSequence.js, where it can be run against a fake clock.
  const [openId, setOpenId] = useState(null)
  const sequence = useRef(null)
  if (!sequence.current) {
    sequence.current = createHoverSequence({
      onChange: setOpenId,
      collapseDelay: COLLAPSE_DELAY,
      transitionMs: TRANSITION_MS,
    })
  }

  useEffect(() => {
    const current = sequence.current
    return () => current.dispose()
  }, [])

  const { data: venues, isLoading, isError } = useQuery({
    queryKey: ['venues', 'public'],
    queryFn: getPublicVenues,
  })

  const shown = useMemo(
    () =>
      (venues ?? []).filter((venue) => filter === 'all' || venue.type === filter),
    [venues, filter],
  )

  return (
    <div className={`${CONTAINER} pt-10 sm:pt-14`}>
      <PageHeader
        title="Площадки"
        meta={
          venues?.length ? (
            <span className="t-num">
              {pluralize(venues.length, 'площадка', 'площадки', 'площадок')}
            </span>
          ) : null
        }
        lead="Кинотеатры, театры и концертные залы. Откройте площадку, чтобы увидеть её расписание."
      />

      <Reveal
        delay={0.2}
        distance={10}
        role="group"
        aria-label="Тип площадки"
        className="mt-8 flex flex-wrap gap-x-6 gap-y-2"
      >
        {FILTERS.map((option) => {
          const active = filter === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.value)}
              className={[
                'relative inline-flex items-center gap-2 pb-1.5 text-[14px] transition-colors duration-200',
                active ? 'text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]',
              ].join(' ')}
            >
              {option.value !== 'all' && (
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-[1px]"
                  style={{ background: venueTypeColor(option.value) }}
                />
              )}
              {option.label}
              {active && (
                <motion.span
                  layoutId="venue-filter"
                  transition={{ type: 'spring', stiffness: 520, damping: 42 }}
                  className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--accent)]"
                />
              )}
            </button>
          )
        })}
      </Reveal>

      <div className="mt-8 border-t border-[var(--border)]">
        {isLoading &&
          [0, 1, 2].map((key) => (
            <div key={key} className="border-b border-[var(--border)] py-6" style={{ height: COLLAPSED }}>
              <div className="skeleton h-12 w-2/3 rounded-[2px]" />
              <div className="skeleton mt-4 h-3 w-1/3 rounded-[2px]" />
            </div>
          ))}

        {isError && (
          <EmptyState className="mt-8" title="Не загрузилось">
            Не удалось загрузить площадки. Обновите страницу.
          </EmptyState>
        )}

        {!isLoading &&
          !isError &&
          (shown.length ? (
            shown.map((venue, index) => (
              <div
                key={venue.id}
                className="anim-rise"
                style={{ '--rise': '16px', '--delay': `${150 + Math.min(index, 8) * 60}ms` }}
              >
                <VenueRow
                  venue={venue}
                  index={index}
                  mobile={mobile}
                  primed={primed}
                  open={openId === venue.id}
                  onEnter={sequence.current.enter}
                  onLeave={sequence.current.leave}
                />
              </div>
            ))
          ) : (
            <EmptyState className="mt-8" title="Пусто">
              {filter === 'all'
                ? 'Площадок пока нет.'
                : 'Площадок этого типа пока нет.'}
            </EmptyState>
          ))}
      </div>

      <p className="mt-6 hidden items-center gap-2 text-[13px] text-[var(--muted2)] md:flex">
        <ArrowUpRight size={14} strokeWidth={1.75} />
        Наведите на площадку — откроются ближайшие сеансы.
      </p>
    </div>
  )
}
