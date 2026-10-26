import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Minus, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getEventSessions } from '../api/events'
import { getPublicVenue } from '../api/venues'
import { useEvent } from '../hooks/useEvents'
import useTickets, { useBuyTicket } from '../hooks/useTickets'
import useAuth from '../hooks/useAuth'
import { dayKey, formatDate, formatDateTime } from '../utils/dates'
import {
  bookableSessions,
  eventEndsAt,
  isEventOver,
  isEventSoldOut,
  isTicketLive,
  seatCounts,
} from '../utils/eventState'
import { orderTags } from '../utils/eventTags'
import { pluralize } from '../utils/plural'
import { formatPrice } from '../utils/ticketGroups'
import Button, { ButtonLink } from '../components/ui/Button'
import { CONTAINER, EmptyState, SectionHead } from '../components/ui/Page'
import { Reveal, Stagger, WordsReveal } from '../components/motion/Motion'
import Poster from '../components/events/Poster'
import WeekSchedule from '../components/events/WeekSchedule'
import SeatPickerOverlay from '../components/seats/SeatPickerOverlay'

// Matches MAX_TICKETS_PER_ORDER on the server, which refuses anything larger.
const MAX_PER_ORDER = 100

/** Google Maps search, which opens in the maps app on a phone as well. */
const mapLink = (query) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`

/** One line of the event's particulars: a label in the margin, the fact beside it. */
function Fact({ label, children }) {
  return (
    <Reveal className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 border-t border-[var(--border)] py-4 sm:grid-cols-[120px_minmax(0,1fr)]">
      <dt className="t-label pt-1">{label}</dt>
      <dd className="min-w-0 text-[16px] leading-snug text-[var(--text)]">{children}</dd>
    </Reveal>
  )
}

function Stepper({ value, onChange, max }) {
  const button =
    'grid h-11 w-11 place-items-center rounded-[var(--radius-sm)] border border-[var(--border2)] text-[var(--text)] transition-[background-color,transform] duration-200 hover:bg-[var(--surface2)] active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-30'
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Меньше"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className={button}
      >
        <Minus size={16} strokeWidth={1.75} />
      </button>
      <span aria-live="polite" className="t-poster t-num w-14 text-center text-[40px] leading-none">
        {/* Keyed by the number, so each new one rises into place. */}
        <span key={value} className="anim-tick inline-block">
          {value}
        </span>
      </span>
      <button
        type="button"
        aria-label="Больше"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={button}
      >
        <Plus size={16} strokeWidth={1.75} />
      </button>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className={`${CONTAINER} pt-8 sm:pt-12`}>
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
        <div className="skeleton aspect-[4/5.9] rounded-[4px]" />
        <div className="space-y-5 pt-2">
          <div className="skeleton h-3 w-40 rounded-[2px]" />
          <div className="skeleton h-24 w-4/5 rounded-[2px]" />
          <div className="skeleton h-24 w-3/5 rounded-[2px]" />
          <div className="skeleton mt-10 h-40 w-full rounded-[2px]" />
        </div>
      </div>
    </div>
  )
}

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { data: event, isLoading, isError } = useEvent(id)
  const { data: myTickets } = useTickets()
  const buy = useBuyTicket()

  // A venue's schedule links straight to one showing.
  const [searchParams] = useSearchParams()
  const linkedSession = Number(searchParams.get('session')) || null

  const [selectedDay, setSelectedDay] = useState(null)
  const [pickerSession, setPickerSession] = useState(null)
  const [quantity, setQuantity] = useState(1)
  const schedule = useRef(null)

  const { data: sessions } = useQuery({
    queryKey: ['events', id, 'sessions'],
    queryFn: () => getEventSessions(id),
    enabled: Boolean(event?.has_seats),
  })
  const { data: venue } = useQuery({
    queryKey: ['venues', 'public', String(event?.venue_id)],
    queryFn: () => getPublicVenue(event.venue_id),
    enabled: Boolean(event?.venue_id),
  })

  // Showings still ahead, in order. A passed one would only be refused.
  const bookable = useMemo(
    () => [...bookableSessions(sessions)].sort((a, b) => new Date(a.datetime) - new Date(b.datetime)),
    [sessions],
  )

  const openSeats = useCallback(
    (session) => {
      if (!isAuthenticated) {
        navigate('/login', { state: { from: `/event/${id}` } })
        return
      }
      setPickerSession(session)
    },
    [isAuthenticated, navigate, id],
  )

  // Once the timetable arrives, open on the day a link named, or on the first
  // day something is on.
  useEffect(() => {
    if (!bookable.length || selectedDay) return
    const linked = bookable.find((session) => session.id === linkedSession)
    setSelectedDay(dayKey((linked ?? bookable[0]).datetime))
    if (linked) schedule.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [bookable, linkedSession, selectedDay])

  if (isLoading) {
    return <DetailSkeleton />
  }

  if (isError || !event) {
    return (
      <div className={`${CONTAINER} pt-12 sm:pt-16`}>
        <EmptyState
          title="Мероприятие не найдено"
          action={
            <ButtonLink to="/" variant="ghost">
              <ArrowLeft size={15} strokeWidth={1.75} />
              Вернуться в афишу
            </ButtonLink>
          }
        >
          Возможно, его сняли с афиши или ссылка устарела.
        </EmptyState>
      </div>
    )
  }

  const past = isEventOver(event)
  const tags = orderTags(event.tags)
  const { available } = seatCounts(event)
  const soldOut = isEventSoldOut(event)
  const status = past ? 'Завершено' : soldOut ? 'Мест нет' : 'В продаже'

  // Without seats, as many as are left -- or, with no capacity set, as many as
  // one order may hold.
  const maxQuantity = Math.max(event.capacity ? Math.min(available, MAX_PER_ORDER) : MAX_PER_ORDER, 1)
  const price = Number(event.price) || 0
  // Only tickets that will still get their holder in: a scanned one, one for
  // a showing that has passed or a gift not yet accepted is not "a ticket for
  // this event" in any sense the reader cares about here.
  const owned = (myTickets ?? []).filter(
    (ticket) => ticket.event_id === event.id && isTicketLive(ticket),
  ).length

  const venueName = venue?.name ?? bookable[0]?.venue_name ?? null
  const venueAddress = venue?.address ?? null

  const ends = eventEndsAt(event)
  const range =
    ends && dayKey(ends) !== dayKey(event.date)
      ? `${formatDate(event.date)} — ${formatDate(ends)}`
      : formatDate(event.date)

  // The cheapest seat across what is still on sale, for the facts line.
  const sessionPrices = bookable.map((session) => session.min_price).filter((value) => value != null)
  const cheapest = sessionPrices.length ? Math.min(...sessionPrices.map(Number)) : null
  const priceFact = event.has_seats
    ? cheapest == null
      ? null
      : cheapest > 0
        ? `от ${formatPrice(cheapest)}`
        : 'Бесплатно'
    : price
      ? formatPrice(price)
      : 'Бесплатно'

  const signIn = (
    <ButtonLink to="/login" state={{ from: `/event/${event.id}` }} size="lg" className="w-full">
      Войдите, чтобы получить билет
    </ButtonLink>
  )

  return (
    <div className="pb-6">
      <div className={`${CONTAINER} pt-8 sm:pt-12`}>
        <Reveal distance={6}>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-[14px] text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
          >
            <ArrowLeft size={15} strokeWidth={1.75} />
            Афиша
          </Link>
        </Reveal>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)] lg:gap-16 xl:grid-cols-[minmax(0,440px)_minmax(0,1fr)]">
          {/* The poster stays in view while the facts and the timetable scroll
              past it -- it is what the reader came from. */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            {/* On a phone the poster is a thumbnail beside the story, not a
                full screen in front of it: the title should be in reach. */}
            <div className="anim-hang w-[64%] max-w-[300px] sm:w-auto sm:max-w-[440px] lg:mx-auto">
              <Poster event={event} past={past} stamp={past ? 'Завершено' : soldOut ? 'Мест нет' : null} />
            </div>
          </aside>

          <div className="min-w-0">
            <Reveal distance={8} delay={0.05} className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span
                className={`inline-flex items-center gap-2 text-[13px] ${
                  past || soldOut ? 'text-[var(--muted)]' : 'text-[var(--ok)]'
                }`}
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: past || soldOut ? 'var(--muted2)' : 'var(--ok)' }}
                />
                {status}
              </span>
              {tags.length > 0 && (
                <span className="t-label">{tags.join(' / ')}</span>
              )}
            </Reveal>

            <h1 className="t-poster mt-5 text-[clamp(52px,7.2vw,112px)] text-[var(--text)]">
              <WordsReveal text={event.title} delay={0.08} />
            </h1>

            <Stagger as="dl" delay={0.25} className="mt-10 border-b border-[var(--border)]">
              <Fact label="Когда">
                <span className="t-num">{range}</span>
              </Fact>
              {(venueName || event.location) && (
                <Fact label="Где">
                  <span className="block">{venueName ?? event.location}</span>
                  {venueAddress && (
                    <span className="mt-1 block text-[14px] text-[var(--muted)]">{venueAddress}</span>
                  )}
                  {venueName && (
                    <a
                      href={mapLink([venueName, venueAddress].filter(Boolean).join(', '))}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="t-link mt-2 inline-flex items-center gap-1 text-[14px] text-[var(--muted)] hover:text-[var(--text)]"
                    >
                      Открыть на карте
                      <ArrowUpRight size={14} strokeWidth={1.75} />
                    </a>
                  )}
                </Fact>
              )}
              {priceFact && <Fact label="Билеты">{priceFact}</Fact>}
            </Stagger>

            {owned > 0 && (
              <Reveal
                delay={0.3}
                className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-[var(--ok-bg)] px-4 py-3 text-[14px]"
              >
                <span className="flex items-center gap-2.5 text-[var(--ok)]">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--ok)]" />
                  У вас есть {pluralize(owned, 'билет', 'билета', 'билетов')} на это мероприятие
                </span>
                <Link
                  to="/cabinet"
                  className="t-link shrink-0 text-[var(--text)]"
                >
                  Мои билеты
                </Link>
              </Reveal>
            )}

            <Reveal delay={0.35} className="mt-10">
              {event.description ? (
                <p className="max-w-[64ch] whitespace-pre-line text-[17px] leading-[1.7] text-[var(--muted)]">
                  {event.description}
                </p>
              ) : (
                <p className="text-[15px] text-[var(--muted2)]">Описание пока не добавлено.</p>
              )}
            </Reveal>

            <section ref={schedule} className="mt-16 scroll-mt-24">
              {event.has_seats ? (
                <>
                  <SectionHead title="Расписание" />
                  <div className="mt-6">
                    {past || !bookable.length ? (
                      <p className="border-b border-[var(--border)] pb-6 text-[15px] text-[var(--muted)]">
                        {past
                          ? 'Мероприятие завершено.'
                          : sessions?.length
                            ? 'Все сеансы уже прошли.'
                            : 'Сеансы пока не назначены.'}
                      </p>
                    ) : (
                      <WeekSchedule
                        sessions={bookable}
                        selectedDay={selectedDay}
                        onSelectDay={setSelectedDay}
                        renderAction={(session, full) =>
                          full ? (
                            <span className="text-[14px] text-[var(--muted2)]">Мест нет</span>
                          ) : isAuthenticated ? (
                            // Outlined at rest so a column of showings is not a
                            // column of red; the row being pointed at fills its
                            // own button with the signal colour.
                            <Button
                              size="md"
                              variant="ghost"
                              onClick={() => openSeats(session)}
                              className="group-hover/session:border-[var(--accent)] group-hover/session:bg-[var(--accent)] group-hover/session:text-[var(--accent-ink)]"
                            >
                              Выбрать места
                              <ArrowRight size={15} strokeWidth={1.75} />
                            </Button>
                          ) : (
                            <ButtonLink to="/login" state={{ from: `/event/${event.id}` }} variant="ghost">
                              Войдите, чтобы получить билет
                            </ButtonLink>
                          )
                        }
                      />
                    )}
                  </div>
                </>
              ) : (
                <>
                  <SectionHead title="Билеты" />
                  <div className="mt-6 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-6">
                      <span className="t-num text-[15px]">{formatDateTime(event.date)}</span>
                      {event.location && (
                        <span className="text-[14px] text-[var(--muted)]">{event.location}</span>
                      )}
                    </div>

                    <div className="px-5 py-6 sm:px-6">
                      {past ? (
                        <Button disabled className="w-full" size="lg">
                          Мероприятие завершено
                        </Button>
                      ) : soldOut ? (
                        <Button disabled className="w-full" size="lg">
                          Мест нет
                        </Button>
                      ) : !isAuthenticated ? (
                        signIn
                      ) : (
                        <div className="space-y-6">
                          <div className="flex flex-wrap items-end justify-between gap-6">
                            <div>
                              <span className="t-label">Количество билетов</span>
                              <div className="mt-3">
                                <Stepper value={quantity} onChange={setQuantity} max={maxQuantity} />
                              </div>
                              {event.capacity > 0 && (
                                <p className="mt-3 text-[13px] text-[var(--muted2)]">
                                  {pluralize(available, 'место', 'места', 'мест')} осталось
                                </p>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="t-label">Итого</span>
                              {price ? (
                                <>
                                  <p className="t-poster t-num mt-3 text-[40px] leading-none">
                                    {formatPrice(price * quantity)}
                                  </p>
                                  {quantity > 1 && (
                                    <p className="t-num mt-2 text-[13px] text-[var(--muted2)]">
                                      {formatPrice(price)} × {quantity}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <p className="t-poster mt-3 text-[40px] leading-none">Бесплатно</p>
                              )}
                            </div>
                          </div>
                          <Button
                            className="w-full"
                            size="lg"
                            loading={buy.isPending}
                            onClick={() =>
                              buy.mutate(
                                { eventId: event.id, quantity },
                                { onSuccess: () => navigate('/cabinet') },
                              )
                            }
                          >
                            Получить {pluralize(quantity, 'билет', 'билета', 'билетов')}
                            <ArrowRight size={16} strokeWidth={1.75} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        </div>
      </div>

      <SeatPickerOverlay
        open={Boolean(pickerSession)}
        session={pickerSession}
        eventId={event.id}
        eventTitle={event.title}
        onClose={() => setPickerSession(null)}
        onBooked={() => {
          setPickerSession(null)
          navigate('/cabinet')
        }}
      />
    </div>
  )
}
