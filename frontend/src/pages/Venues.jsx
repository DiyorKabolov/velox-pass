import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Building2, MapPin } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { getPublicVenues, getVenueSessions } from '../api/venues'
import { formatTime } from '../utils/dates'
import { pluralize } from '../utils/plural'
import { createHoverSequence } from '../utils/hoverSequence'
import { venueTypeColor, venueTypeLabel } from '../utils/venueTypes'

const COLLAPSED = 88
// The brief said 300, but the panel below the header comes to 238px on its own
// -- artwork, two lines of title, time, hall, seats, then the footer button --
// and max-height doubles as the clip, so 300 would quietly cut the button off.
const EXPANDED = 340
// Long enough to cross the gap between two rows, or the strip flickers shut
// while the pointer travels.
const COLLAPSE_DELAY = 200
// The max-height transition, which duration-300 on the row also sets. Moving to
// another row waits this out so the two never move at once.
const TRANSITION_MS = 300
const PREVIEW_LIMIT = 5

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

/** Stands in for a photo nobody uploaded, in the venue's own colour. */
const typeGradient = (accent) =>
  `linear-gradient(135deg, ${accent}cc 0%, ${accent}59 48%, ${accent}1a 100%)`

function VenuePhoto({ venue, accent }) {
  return (
    <div
      className="relative hidden h-full w-[200px] shrink-0 overflow-hidden sm:block"
      style={venue.image_url ? undefined : { background: typeGradient(accent) }}
    >
      {venue.image_url && (
        <img
          src={venue.image_url}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
    </div>
  )
}

/** One upcoming showing, small enough that five fit across. */
function SessionMini({ session }) {
  const soldOut = (session.available_seats ?? 0) <= 0

  return (
    <Link
      to={`/event/${session.event_id}?session=${session.session_id}`}
      className="w-[160px] shrink-0 snap-start rounded-[10px] p-1.5 transition-colors duration-150 hover:bg-[var(--surface)]"
    >
      <div
        className="h-20 w-full overflow-hidden rounded-lg"
        style={
          session.event_image_url
            ? undefined
            : { background: typeGradient(session.card_accent || '#a898e0') }
        }
      >
        {session.event_image_url && (
          <img
            src={session.event_image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <p className="mt-2 line-clamp-2 text-[12px] font-semibold leading-tight text-[var(--text)]">
        {session.event_title}
      </p>
      <p className="mt-1 font-mono2 text-[13px] font-bold text-[var(--accent)]">
        {formatTime(session.datetime)}
      </p>
      {session.hall_name && (
        <p className="truncate text-[10px] text-[var(--muted2)]">{session.hall_name}</p>
      )}
      <p className="text-[10px] text-[var(--muted2)]">
        {soldOut
          ? 'мест нет'
          : pluralize(session.available_seats, 'место', 'места', 'мест')}
      </p>
    </Link>
  )
}

function SkeletonMini() {
  return (
    <div className="w-[160px] shrink-0 p-1.5">
      <div className="h-20 w-full animate-pulse rounded-lg bg-[var(--surface)]" />
      <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-[var(--surface)]" />
      <div className="mt-1.5 h-3 w-1/2 animate-pulse rounded bg-[var(--surface)]" />
    </div>
  )
}

function VenueRow({ venue, mobile, primed, open, onEnter, onLeave }) {
  const accent = venueTypeColor(venue.type)
  const navigate = useNavigate()

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

  const header = (
    <div className="flex items-center" style={{ height: COLLAPSED }}>
      <div className="min-w-0 flex-1 py-2 pl-5 pr-4">
        <span
          className="inline-block rounded-full px-2 py-0.5 font-mono2 text-[9px] uppercase tracking-[0.12em]"
          style={{ background: `${accent}26`, color: accent }}
        >
          {venueTypeLabel(venue.type)}
        </span>

        {/* On a phone the whole row is already a link, so this must not be a
            second one nested inside it. */}
        {mobile ? (
          <p className="mt-1 truncate text-[18px] font-bold leading-tight text-[var(--text)]">
            {venue.name}
          </p>
        ) : (
          <Link
            to={`/venues/${venue.id}`}
            className="mt-1 block max-w-max truncate text-[18px] font-bold leading-tight text-[var(--text)] transition-colors duration-150 hover:text-[var(--accent)]"
          >
            {venue.name}
          </Link>
        )}

        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 truncate text-xs text-[var(--muted)]">
          {venue.address && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} className="shrink-0 opacity-70" />
              {venue.address}
            </span>
          )}
          <span className="font-mono2 text-[var(--muted2)]">
            {pluralize(venue.halls_count ?? 0, 'зал', 'зала', 'залов')} ·{' '}
            {pluralize(
              venue.active_events_count ?? 0,
              'мероприятие',
              'мероприятия',
              'мероприятий',
            )}
          </span>
        </p>
      </div>

      <VenuePhoto venue={venue} accent={accent} />
    </div>
  )

  const shell =
    'relative w-full overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] text-left transition-[max-height,border-color] duration-300 ease-out'

  const stripe = (
    <span
      aria-hidden
      className="absolute inset-y-0 left-0 w-1"
      style={{ background: accent }}
    />
  )

  if (mobile) {
    return (
      <Link
        to={`/venues/${venue.id}`}
        className={`${shell} block`}
        style={{ maxHeight: COLLAPSED }}
      >
        {stripe}
        {header}
      </Link>
    )
  }

  return (
    <div
      onMouseEnter={enter}
      onMouseLeave={leave}
      className={`${shell} cursor-default ${open ? 'border-[var(--border2)]' : ''}`}
      style={{ maxHeight: open ? EXPANDED : COLLAPSED }}
    >
      {stripe}
      {header}

      <div className="border-t border-[var(--border)] bg-[var(--surface2)] px-6 pb-4 pt-3">
        {/* scrollbar-none is defined in index.css: Tailwind has no utility for
            hiding a scrollbar across engines. */}
        <div className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto">
          {isLoading &&
            [0, 1, 2].map((key) => <SkeletonMini key={key} />)}
          {!isLoading &&
            upcoming.map((session) => (
              <SessionMini key={session.session_id} session={session} />
            ))}
          {!isLoading && upcoming.length === 0 && (
            <p className="py-6 text-sm text-[var(--muted)]">Нет предстоящих сеансов</p>
          )}
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => navigate(`/venues/${venue.id}`)}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] transition-all duration-150 hover:border-[var(--accent)] hover:text-[var(--text)] active:scale-[0.96]"
          >
            Все сеансы и мероприятия
            <ArrowRight size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Venues() {
  const mobile = useMediaQuery('(max-width: 767px)')
  // Which venues have ever been hovered. A ref, not state: it must not cause a
  // render, and it has to outlive any row that unmounts.
  const primed = useRef(new Set())

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

  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <header className="mb-10 text-center">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.28em] text-[var(--muted2)]">
          Где смотреть
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">Площадки</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-[var(--muted)]">
          Кинотеатры, театры и концертные залы.
        </p>
      </header>

      {isLoading && (
        <div className="space-y-3">
          {[0, 1, 2].map((key) => (
            <div
              key={key}
              className="animate-pulse rounded-[var(--radius)] bg-[var(--surface)]"
              style={{ height: COLLAPSED }}
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="py-16 text-center text-sm text-[var(--err)]">
          Не удалось загрузить площадки. Обновите страницу.
        </p>
      )}

      {!isLoading &&
        !isError &&
        (venues?.length ? (
          <div className="space-y-3">
            {venues.map((venue) => (
              <VenueRow
                key={venue.id}
                venue={venue}
                mobile={mobile}
                primed={primed}
                open={openId === venue.id}
                onEnter={sequence.current.enter}
                onLeave={sequence.current.leave}
              />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center">
            <Building2 size={26} className="mx-auto mb-3 text-[var(--muted2)]" />
            <p className="text-sm text-[var(--muted)]">Площадок пока нет.</p>
          </div>
        ))}
    </div>
  )
}
