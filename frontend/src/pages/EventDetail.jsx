import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Armchair, CalendarDays, MapPin, Users } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getEventSessions } from '../api/events'
import { useEvent } from '../hooks/useEvents'
import SeatBookingModal from '../components/seats/SeatBookingModal'
import { useBuyTicket } from '../hooks/useTickets'
import useAuth from '../hooks/useAuth'
import { formatDate, formatDateTime, isExpired } from '../utils/dates'
import { getCardColors, withAlpha } from '../utils/colors'
import { orderTags, tagColor } from '../utils/eventTags'
import { pluralize } from '../utils/plural'
import Button from '../components/ui/Button'

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { data: event, isLoading, isError } = useEvent(id)
  const buy = useBuyTicket()

  // A venue's schedule links straight to one showing. Marked and scrolled to
  // rather than opened: opening the seat picker would bounce a signed-out
  // visitor to the login page the moment they arrived from the timetable.
  const [searchParams] = useSearchParams()
  const highlighted = Number(searchParams.get('session')) || null
  const highlightRef = useRef(null)

  const [pickingSession, setPickingSession] = useState(null)

  // Only seated events have showings to choose from.
  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ['events', id, 'sessions'],
    queryFn: () => getEventSessions(id),
    enabled: Boolean(event?.has_seats),
  })

  useEffect(() => {
    highlightRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [highlighted, sessions])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-14">
        <div className="h-64 animate-pulse rounded-[var(--radius)] bg-[var(--surface)]" />
      </div>
    )
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
  const past = isExpired(event.date)
  const sold = event.tickets_sold ?? 0
  const tags = orderTags(event.tags)

  // Same pair of fields for both kinds of event: for a seated one they come
  // from the hall map of its live sessions, where capacity is 0.
  const total = event.total_seats ?? event.capacity ?? 0
  // available_seats falls back to a figure derived from what the payload does
  // carry, never to 0: a server that predates these fields would otherwise make
  // every event read "0 мест свободно, 100%" -- a confident wrong number rather
  // than a visibly missing one.
  const available = event.available_seats ?? Math.max(total - sold, 0)
  const soldOut = event.has_seats
    ? event.has_active_session === false || (total > 0 && available <= 0)
    : total > 0 && sold >= total
  const canBuy = !past && !soldOut

  const requireSignIn = () => {
    if (isAuthenticated) return false
    toast('Войдите, чтобы получить билет')
    navigate('/login')
    return true
  }

  const handleBuy = () => {
    if (requireSignIn()) return
    buy.mutate({ eventId: event.id }, { onSuccess: () => navigate('/cabinet') })
  }

  const openSeatPicker = (session) => {
    if (requireSignIn()) return
    setPickingSession(session)
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeft size={15} /> Вся афиша
      </Link>

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <p className="font-mono2 text-[11px] uppercase tracking-[0.24em] text-[var(--muted2)]">
            {past ? 'Завершено' : soldOut ? 'Мест нет' : 'В продаже'}
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight">
            {event.title}
          </h1>

          {tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border px-3 py-1 text-xs"
                  style={{
                    borderColor: `${tagColor(tag)}55`,
                    background: `${tagColor(tag)}1a`,
                    color: tagColor(tag),
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="mt-6 space-y-3 text-sm">
            <p className="flex items-center gap-2.5 text-[var(--muted)]">
              <CalendarDays size={16} className="text-[var(--accent)]" />
              {formatDate(event.date)}
            </p>
            {event.location && (
              <p className="flex items-center gap-2.5 text-[var(--muted)]">
                <MapPin size={16} className="text-[var(--accent)]" />
                {event.location}
              </p>
            )}
            {total > 0 && (
              <p className="flex items-center gap-2.5 text-[var(--muted)]">
                <Users size={16} className="text-[var(--accent)]" />
                {pluralize(available, 'место', 'места', 'мест')} свободно из {total}
              </p>
            )}
          </div>

          {event.description && (
            <p className="mt-8 whitespace-pre-line text-sm leading-relaxed text-[var(--muted)]">
              {event.description}
            </p>
          )}
        </div>

        <aside className="w-full lg:sticky lg:top-24 lg:w-[320px] lg:shrink-0">
          <div
            className="overflow-hidden rounded-[var(--radius)]"
            style={{ background: colors.bg, color: colors.text }}
          >
            <div className="h-1.5 w-full" style={{ background: colors.accent }} />
            <div className="p-6">
              <p
                className="font-display text-[11px] tracking-[0.16em]"
                style={{ color: colors.accent }}
              >
                VELOX·PASS
              </p>
              <h2 className="mt-3 font-display text-lg leading-snug line-clamp-2">
                {event.title}
              </h2>
              <p className="mt-2 text-sm opacity-70">{formatDate(event.date)}</p>
              {event.location && (
                <p className="mt-0.5 truncate text-sm opacity-55">{event.location}</p>
              )}

              <div
                className="my-5 border-t border-dashed"
                style={{ borderColor: 'rgba(0,0,0,0.16)' }}
              />

              {event.has_seats ? (
                <div className="space-y-2">
                  <p className="mb-3 text-xs uppercase tracking-[0.12em] opacity-55">
                    Сеансы
                  </p>
                  {sessions?.length ? (
                    sessions.map((session) => (
                      <button
                        key={session.id}
                        ref={session.id === highlighted ? highlightRef : null}
                        type="button"
                        disabled={past || session.seats_free === 0}
                        onClick={() => openSeatPicker(session)}
                        className={[
                          'flex w-full items-center justify-between gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 text-left text-sm transition-all duration-150 hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45',
                          session.id === highlighted ? 'ring-2 ring-offset-1' : '',
                        ].join(' ')}
                        style={{
                          background: withAlpha(colors.accent, 0.16),
                          ...(session.id === highlighted
                            ? { '--tw-ring-color': colors.accent, '--tw-ring-offset-color': colors.bg }
                            : {}),
                        }}
                      >
                        <span>
                          <span className="block font-medium">
                            {formatDateTime(session.datetime)}
                          </span>
                          {session.hall_name && (
                            <span className="text-xs opacity-60">{session.hall_name}</span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-1.5 font-mono2 text-xs opacity-70">
                          <Armchair size={13} />
                          {session.seats_free}
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm opacity-55">Сеансы пока не назначены.</p>
                  )}
                </div>
              ) : (
                <>
                <Button
                  onClick={handleBuy}
                  loading={buy.isPending}
                  disabled={!canBuy}
                  className="w-full"
                  style={{ background: colors.accent, borderColor: colors.accent, color: colors.bg }}
                >
                  {past ? 'Мероприятие завершено' : soldOut ? 'Мест нет' : 'Получить билет'}
                </Button>

                {total > 0 && canBuy && (
                  <p className="mt-3 text-center font-mono2 text-[11px] opacity-50">
                    свободно {available}
                  </p>
                )}
                </>
              )}
            </div>
          </div>
        </aside>
      </div>

      <SeatBookingModal
        open={Boolean(pickingSession)}
        session={pickingSession}
        eventId={event.id}
        onClose={() => setPickingSession(null)}
        onBooked={() => {
          refetchSessions()
          navigate('/cabinet')
        }}
      />
    </div>
  )
}
