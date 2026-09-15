import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CalendarDays, Check, ExternalLink, MapPin, Minus, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { getEventSessions } from '../api/events'
import { getPublicVenue } from '../api/venues'
import { useEvent } from '../hooks/useEvents'
import useTickets, { useBuyTicket } from '../hooks/useTickets'
import useAuth from '../hooks/useAuth'
import { dayKey, formatDate, formatDateTime } from '../utils/dates'
import { bookableSessions, eventEndsAt, isEventOver } from '../utils/eventState'
import { getCardColors } from '../utils/colors'
import { orderTags, tagColor } from '../utils/eventTags'
import { pluralize } from '../utils/plural'
import { formatPrice } from '../utils/ticketGroups'
import Button from '../components/ui/Button'
import WeekSchedule from '../components/events/WeekSchedule'
import SeatPickerOverlay from '../components/seats/SeatPickerOverlay'

// Matches MAX_TICKETS_PER_ORDER on the server, which refuses anything larger.
const MAX_PER_ORDER = 100

/** Google Maps search, which opens in the maps app on a phone as well. */
const mapLink = (query) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`

function Hero({ event, colors, status, tags }) {
  const ends = eventEndsAt(event)
  const range =
    ends && dayKey(ends) !== dayKey(event.date)
      ? `${formatDate(event.date)} — ${formatDate(ends)}`
      : formatDate(event.date)

  return (
    <section className="relative h-[450px] w-full overflow-hidden">
      {event.image_url ? (
        <img src={event.image_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.bg} 100%)` }}
        />
      )}
      {/* Clear for the top three fifths, then a long fade into the page. A
          shorter one put a visible edge across the middle of the picture. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, rgba(26,28,30,0) 0%, rgba(26,28,30,0) 20%, rgba(26,28,30,0.3) 50%, rgba(26,28,30,0.85) 75%, rgba(26,28,30,1) 100%)',
        }}
      />

      <div className="relative mx-auto flex h-full max-w-[900px] flex-col justify-end px-5 pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-black/45 px-3 py-1 font-mono2 text-[10px] uppercase tracking-[0.18em] text-white backdrop-blur">
            {status}
          </span>
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border px-3 py-1 text-xs backdrop-blur"
              style={{ borderColor: `${tagColor(tag)}99`, background: `${tagColor(tag)}33`, color: '#fff' }}
            >
              {tag}
            </span>
          ))}
        </div>

        <h1 className="mt-4 font-display text-3xl leading-tight tracking-tight text-white drop-shadow sm:text-5xl">
          {event.title}
        </h1>

        <div className="mt-5 flex flex-wrap gap-2 text-sm text-white">
          <span className="inline-flex items-center gap-2 rounded-full bg-black/45 px-3.5 py-1.5 backdrop-blur">
            <CalendarDays size={15} /> {range}
          </span>
          {event.location && (
            <span className="inline-flex items-center gap-2 rounded-full bg-black/45 px-3.5 py-1.5 backdrop-blur">
              <MapPin size={15} /> {event.location}
            </span>
          )}
        </div>
      </div>
    </section>
  )
}

function Stepper({ value, onChange, max }) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Меньше"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
        className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border2)] transition-colors hover:text-[var(--text)] disabled:opacity-35"
      >
        <Minus size={16} />
      </button>
      <span aria-live="polite" className="w-10 text-center font-mono2 text-2xl font-semibold">
        {value}
      </span>
      <button
        type="button"
        aria-label="Больше"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className="grid h-10 w-10 place-items-center rounded-full border border-[var(--border2)] transition-colors hover:text-[var(--text)] disabled:opacity-35"
      >
        <Plus size={16} />
      </button>
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
    return <div className="h-[450px] w-full animate-pulse bg-[var(--surface)]" />
  }

  if (isError || !event) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-20 text-center">
        <p className="text-sm text-[var(--err)]">Мероприятие не найдено.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-[var(--accent)]">
          Вернуться в афишу
        </Link>
      </div>
    )
  }

  const colors = getCardColors(event)
  const past = isEventOver(event)
  const tags = orderTags(event.tags)
  const sold = event.tickets_sold ?? 0
  const total = event.total_seats ?? event.capacity ?? 0
  const available = event.available_seats ?? Math.max(total - sold, 0)
  const soldOut = event.has_seats
    ? event.has_active_session === false || (total > 0 && available <= 0)
    : total > 0 && available <= 0
  const status = past ? 'Завершено' : soldOut ? 'Мест нет' : 'В продаже'

  // Without seats, as many as are left -- or, with no capacity set, as many as
  // one order may hold.
  const maxQuantity = Math.max(event.capacity ? Math.min(available, MAX_PER_ORDER) : MAX_PER_ORDER, 1)
  const price = Number(event.price) || 0
  const owned = (myTickets ?? []).filter((ticket) => ticket.event_id === event.id).length

  const venueName = venue?.name ?? bookable[0]?.venue_name ?? null
  const venueAddress = venue?.address ?? null
  const accentButton = { background: colors.accent, borderColor: colors.accent, color: colors.bg }

  const signIn = (
    <Link to="/login" state={{ from: `/event/${event.id}` }} className="block">
      <Button className="w-full" style={accentButton}>
        Войдите чтобы получить билет
      </Button>
    </Link>
  )

  return (
    <div className="pb-16">
      <Hero event={event} colors={colors} status={status} tags={tags} />

      <div className="mx-auto max-w-[900px] space-y-10 px-5 pt-6">
        {event.description ? (
          <section>
            {event.description.length > 280 && (
              <h2 className="mb-4 font-display text-xl tracking-tight">О мероприятии</h2>
            )}
            <p className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--muted)]">
              {event.description}
            </p>
          </section>
        ) : (
          <p className="text-sm text-[var(--muted2)]">Описание пока не добавлено.</p>
        )}

        {venueName && (
          <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="mb-3 font-display text-base tracking-tight">Площадка</h2>
            <p className="text-sm">{venueName}</p>
            {venueAddress && <p className="mt-1 text-sm text-[var(--muted)]">{venueAddress}</p>}
            <a
              href={mapLink([venueName, venueAddress].filter(Boolean).join(', '))}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
            >
              <ExternalLink size={14} /> Открыть на карте
            </a>
          </section>
        )}

        {owned > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-[var(--ok)] bg-[var(--ok-bg)] px-4 py-3 text-sm">
            <span className="flex items-center gap-2 text-[var(--ok)]">
              <Check size={16} />
              У вас есть {pluralize(owned, 'билет', 'билета', 'билетов')} на это мероприятие
            </span>
            <Link to="/cabinet" className="shrink-0 text-[var(--accent)] hover:underline">
              Мои билеты →
            </Link>
          </div>
        )}

        <section ref={schedule}>
          {event.has_seats ? (
            <>
              <h2 className="mb-5 font-display text-xl tracking-tight">Расписание сеансов</h2>
              {past || !bookable.length ? (
                <p className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-6 text-center text-sm text-[var(--muted)]">
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
                  accent={colors.accent}
                  renderAction={(session, full) =>
                    full ? (
                      <span className="text-sm text-[var(--muted2)]">Мест нет</span>
                    ) : isAuthenticated ? (
                      <Button size="sm" style={accentButton} onClick={() => openSeats(session)}>
                        Выбрать места
                        <ArrowRight size={14} />
                      </Button>
                    ) : (
                      <Link to="/login" state={{ from: `/event/${event.id}` }}>
                        <Button size="sm" variant="ghost">
                          Войдите чтобы получить билет
                        </Button>
                      </Link>
                    )
                  }
                />
              )}
            </>
          ) : (
            <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6">
              <p className="flex items-center gap-2 text-sm">
                <CalendarDays size={15} className="text-[var(--accent)]" />
                {formatDateTime(event.date)}
              </p>
              {event.location && (
                <p className="mt-2 flex items-center gap-2 text-sm">
                  <MapPin size={15} className="text-[var(--accent)]" />
                  {event.location}
                </p>
              )}

              <div className="mt-6 border-t border-[var(--border)] pt-6">
                {past ? (
                  <Button disabled className="w-full" style={accentButton}>
                    Мероприятие завершено
                  </Button>
                ) : soldOut ? (
                  <Button disabled className="w-full" style={accentButton}>
                    Мест нет
                  </Button>
                ) : !isAuthenticated ? (
                  signIn
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <span className="text-sm text-[var(--muted)]">Количество билетов:</span>
                      <Stepper value={quantity} onChange={setQuantity} max={maxQuantity} />
                    </div>
                    <p className="text-sm">
                      {price ? (
                        <>
                          <span className="text-[var(--muted)]">Итого: </span>
                          <strong className="font-mono2">{formatPrice(price * quantity)}</strong>
                          {quantity > 1 && (
                            <span className="text-[var(--muted2)]"> ({formatPrice(price)} × {quantity})</span>
                          )}
                        </>
                      ) : (
                        <strong>Бесплатно</strong>
                      )}
                    </p>
                    {event.capacity > 0 && (
                      <p className="text-xs text-[var(--muted2)]">
                        {pluralize(available, 'место', 'места', 'мест')} осталось
                      </p>
                    )}
                    <Button
                      className="w-full"
                      style={accentButton}
                      loading={buy.isPending}
                      onClick={() =>
                        buy.mutate(
                          { eventId: event.id, quantity },
                          { onSuccess: () => navigate('/cabinet') },
                        )
                      }
                    >
                      Получить {pluralize(quantity, 'билет', 'билета', 'билетов')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
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
