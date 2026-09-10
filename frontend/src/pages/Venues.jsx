import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Building2, CalendarDays, Grid3x3, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getPublicVenues, getVenueSessions } from '../api/venues'
import { formatTime, formatWhenShort } from '../utils/dates'
import { pluralize } from '../utils/plural'
import { createHoverSequence } from '../utils/hoverSequence'
import {
  CARD_BASE,
  CARD_INK,
  venueTypeBackground,
  venueTypeColor,
  venueTypeInk,
  venueTypeLabel,
} from '../utils/venueTypes'

const COLLAPSED = 180
// The panel under the header measures ~205 on its own -- 16 of padding, a 90px
// still, two lines of title, the time, the seats line, 16 more -- and max-height
// doubles as the clip, so this has to be the header plus the panel with a little
// headroom, not a round number picked by eye.
const EXPANDED = COLLAPSED + 212
// Long enough to cross the gap between two cards, or the panel flickers shut
// while the pointer travels.
const COLLAPSE_DELAY = 200
// Matches the max-height transition below. Moving to another card waits this
// out, so two are never in motion together.
const TRANSITION_MS = 350
const PREVIEW_LIMIT = 5

// The card carries the poster page's pale palette, so its ink is dark and is
// stated here rather than borrowed from the app's dark surfaces. Everything
// outside the cards -- the heading, the filters -- uses the app's variables,
// so the page still reads as part of the site.
const INK = CARD_INK
const INK_DIM = 'rgba(42,42,42,0.62)'
const INK_FAINT = 'rgba(42,42,42,0.5)'
const HAIRLINE = 'rgba(0,0,0,0.10)'

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

/** #rrggbb as an rgba() at the given opacity. */
const alpha = (hex, opacity) => {
  const clean = String(hex).replace('#', '')
  const channel = (index) => parseInt(clean.slice(index, index + 2), 16)
  return `rgba(${channel(0)}, ${channel(2)}, ${channel(4)}, ${opacity})`
}

/** Stands in for a picture nobody uploaded, in the colour of whatever it is. */
const placeholder = (color) =>
  `linear-gradient(135deg, ${color}33 0%, ${color}59 100%)`

/** One upcoming showing, small enough that several fit across. */
function SessionMini({ session, color, ink }) {
  const soldOut = (session.available_seats ?? 0) <= 0

  return (
    <Link
      to={`/event/${session.event_id}?session=${session.session_id}`}
      className="w-[150px] shrink-0 snap-start rounded-[10px] p-1.5 transition-colors duration-150 hover:bg-black/[0.05]"
    >
      <div
        className="h-[90px] w-full overflow-hidden rounded-lg"
        style={
          session.event_image_url
            ? undefined
            : { background: placeholder(session.card_accent || color) }
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

      <p
        className="mt-2 line-clamp-2 text-[11px] font-bold leading-[1.35]"
        style={{ color: INK }}
      >
        {session.event_title}
      </p>
      <p className="mt-1 font-mono2 text-[13px] font-bold" style={{ color: ink }}>
        {formatTime(session.datetime)}
      </p>
      <p className="text-[10px]" style={{ color: INK_FAINT }}>
        {soldOut
          ? 'мест нет'
          : pluralize(session.available_seats, 'место', 'места', 'мест')}
      </p>
    </Link>
  )
}

function SkeletonMini() {
  return (
    <div className="w-[150px] shrink-0 p-1.5">
      <div className="h-[90px] w-full animate-pulse rounded-lg bg-black/[0.07]" />
      <div className="mt-2 h-2.5 w-4/5 animate-pulse rounded bg-black/[0.07]" />
      <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-black/[0.07]" />
    </div>
  )
}

function VenueCard({ venue, mobile, primed, open, onEnter, onLeave }) {
  // The pure hue draws the glow bar and the washes; the darkened one is what
  // any text in that colour uses, because the card underneath is pale.
  const color = venueTypeColor(venue.type)
  const ink = venueTypeInk(venue.type)

  // Latched on the first hover and never unlatched, so leaving and coming back
  // does not refetch. The set lives in the parent so it also survives a card
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
    // request then runs while the previous card is still collapsing, and the
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

  // Every colour the card's classes reach for. Kept as custom properties so
  // the hover rules can stay plain literal classes -- built out of a template
  // string they would be invisible to Tailwind's scan of the source.
  const palette = {
    '--ring': `${color}30`,
    '--glow-near': `${color}60`,
    '--glow-far': `${color}30`,
    '--glow-near-hot': `${color}85`,
    '--glow-far-hot': `${color}4d`,
  }

  const head = (
    <div className="relative" style={{ height: COLLAPSED }}>
      {/* The photo, dissolved into the card by a fade running back across it.
          Held to the header's height rather than the card's: stretched to the
          full expanded card it would sit on top of the sessions below. */}
      <div
        className="absolute right-0 top-0 h-full w-[30%] overflow-hidden"
        style={{ backgroundColor: CARD_BASE }}
      >
        {venue.image_url ? (
          <img
            src={venue.image_url}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-[filter] duration-200 group-hover:brightness-110"
          />
        ) : (
          <div className="h-full w-full" style={{ background: placeholder(color) }} />
        )}
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background: [
              'linear-gradient(to right',
              `${CARD_BASE} 0%`,
              `${CARD_BASE} 10%`,
              `${alpha(CARD_BASE, 0.8)} 30%`,
              `${alpha(CARD_BASE, 0.3)} 60%`,
              'transparent 100%)',
            ].join(', '),
          }}
        />
      </div>

      {/* Centred as one block, with the spacing between the rows written out.
          Spread apart instead, the leftover height of a short card opened a
          hole between the address and the counts. */}
      <div className="relative z-10 flex h-full w-[72%] flex-col justify-center pb-5 pl-7 pr-8 pt-5">
        <div>
          <span
            className="mb-1 inline-block rounded-full border px-2.5 py-[3px] text-[11px] font-bold uppercase tracking-[0.08em]"
            style={{
              background: `${color}2e`,
              color: ink,
              borderColor: `${color}66`,
            }}
          >
            {venueTypeLabel(venue.type)}
          </span>

          {/* leading-tight clipped the descenders: Unbounded sits tall in its
              line box, and the clamp's overflow:hidden cuts whatever pokes out
              below it. The looser line gives them room. */}
          <h2
            className="mb-1.5 line-clamp-2 font-display text-[20px] font-semibold leading-[1.4]"
            style={{ color: INK }}
          >
            {venue.name}
          </h2>

          {venue.address && (
            <p
              className="flex items-center gap-1.5 text-[13px]"
              style={{ color: INK_DIM }}
            >
              <MapPin size={13} className="shrink-0" />
              <span className="min-w-0 truncate">{venue.address}</span>
            </p>
          )}
        </div>

        {/* The counts and the nearest showing share one row. Stacked, they need
            30px the card has not got once the name takes its second line. */}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <p
            className="flex flex-wrap items-center gap-x-2 text-[12px]"
            style={{ color: INK_FAINT }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Grid3x3 size={12} className="shrink-0" />
              {pluralize(venue.halls_count ?? 0, 'зал', 'зала', 'залов')}
            </span>
            <span aria-hidden>·</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={12} className="shrink-0" />
              {pluralize(
                venue.active_events_count ?? 0,
                'мероприятие',
                'мероприятия',
                'мероприятий',
              )}
            </span>
          </p>

          {venue.next_session_at && (
            <span
              className="rounded-full px-2.5 py-[3px] text-[11px]"
              style={{ background: `${color}26`, color: ink }}
            >
              Ближайший: {formatWhenShort(venue.next_session_at)}
            </span>
          )}
        </div>
      </div>
    </div>
  )

  const glow = (
    <span
      aria-hidden
      className="absolute inset-y-0 left-0 w-1 rounded-l-2xl shadow-[0_0_20px_var(--glow-near),0_0_40px_var(--glow-far)] transition-[box-shadow] duration-200 group-hover:shadow-[0_0_28px_var(--glow-near-hot),0_0_56px_var(--glow-far-hot)]"
      style={{ background: color }}
    />
  )

  const shell =
    'group relative w-full cursor-pointer overflow-hidden rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.3)] hover:-translate-y-0.5 hover:shadow-[0_16px_48px_rgba(0,0,0,0.4),0_0_0_1px_var(--ring)]'

  const frame = {
    ...palette,
    background: venueTypeBackground(venue.type),
    // The shorthand above clears background-color; restating it keeps a solid
    // card colour under the gradient, so nothing translucent on top of it can
    // fall through to the page.
    backgroundColor: CARD_BASE,
    maxHeight: mobile ? COLLAPSED : open ? EXPANDED : COLLAPSED,
    // Written out rather than composed from Tailwind classes: the panel and the
    // hover treatment want different durations, and one `transition-*` utility
    // can only carry one.
    transition:
      'max-height .35s ease, transform .2s ease, box-shadow .2s ease',
  }

  if (mobile) {
    return (
      <Link to={`/venues/${venue.id}`} className={`${shell} block`} style={frame}>
        {glow}
        {head}
      </Link>
    )
  }

  return (
    <article onMouseEnter={enter} onMouseLeave={leave} className={shell} style={frame}>
      {glow}

      {/* The name is the link; the rest of the card is a hover surface, so the
          whole thing must not be one. */}
      <Link
        to={`/venues/${venue.id}`}
        aria-label={venue.name}
        className="absolute left-0 top-0 z-20 w-[72%]"
        style={{ height: COLLAPSED }}
      />

      {head}

      <div
        className="scrollbar-none flex snap-x snap-mandatory items-start gap-3 overflow-x-auto border-t px-8 py-4"
        style={{ borderColor: HAIRLINE }}
      >
        {isLoading && [0, 1, 2].map((key) => <SkeletonMini key={key} />)}

        {!isLoading &&
          upcoming.map((session) => (
            <SessionMini
              key={session.session_id}
              session={session}
              color={color}
              ink={ink}
            />
          ))}

        {!isLoading && upcoming.length === 0 && (
          <p className="py-8 text-sm" style={{ color: INK_DIM }}>
            Нет предстоящих сеансов
          </p>
        )}

        <Link
          to={`/venues/${venue.id}`}
          className="ml-auto inline-flex shrink-0 items-center gap-1.5 self-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-xs transition-colors duration-150"
          style={{ borderColor: `${color}66`, color: ink }}
        >
          Все сеансы
          <ArrowRight size={13} />
        </Link>
      </div>
    </article>
  )
}

export default function Venues() {
  const mobile = useMediaQuery('(max-width: 767px)')
  // Which venues have ever been hovered. A ref, not state: it must not cause a
  // render, and it has to outlive any card that unmounts.
  const primed = useRef(new Set())
  const [filter, setFilter] = useState('all')

  // One card open at a time, and never two in motion at once. The sequencing
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
    <div className="mx-auto max-w-[1100px] px-5 py-14">
      <header className="mb-9 text-center">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.28em] text-[var(--muted2)]">
          Где смотреть
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
          Площадки
        </h1>
      </header>

      <div
        role="group"
        aria-label="Тип площадки"
        className="mb-8 flex flex-wrap justify-center gap-2"
      >
        {FILTERS.map((option) => {
          const active = filter === option.value
          const tint =
            option.value === 'all' ? 'var(--accent)' : venueTypeColor(option.value)
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.value)}
              className="rounded-full border px-4 py-1.5 text-xs transition-colors duration-150 hover:text-[var(--text)]"
              style={{
                background: active ? `${tint}1f` : 'transparent',
                borderColor: active ? `${tint}59` : 'var(--border)',
                color: active ? tint : 'var(--muted)',
              }}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-4">
        {isLoading &&
          [0, 1, 2].map((key) => (
            // The placeholder is the app's surface, not the card's cream:
            // a card that has not arrived should read as an empty slot, the
            // way the poster page does, rather than as a blank white card.
            <div
              key={key}
              className="animate-pulse rounded-2xl bg-[var(--surface)]"
              style={{ height: COLLAPSED }}
            />
          ))}

        {isError && (
          <p className="py-16 text-center text-sm text-[var(--err)]">
            Не удалось загрузить площадки. Обновите страницу.
          </p>
        )}

        {!isLoading &&
          !isError &&
          (shown.length ? (
            shown.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                mobile={mobile}
                primed={primed}
                open={openId === venue.id}
                onEnter={sequence.current.enter}
                onLeave={sequence.current.leave}
              />
            ))
          ) : (
            <div className="py-16 text-center">
              <Building2 size={26} className="mx-auto mb-3 text-[var(--muted2)]" />
              <p className="text-sm text-[var(--muted)]">
                {filter === 'all'
                  ? 'Площадок пока нет.'
                  : 'Площадок этого типа пока нет.'}
              </p>
            </div>
          ))}
      </div>
    </div>
  )
}
