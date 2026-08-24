import { ArrowLeft, CalendarDays, MapPin, Users } from 'lucide-react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useEvent } from '../hooks/useEvents'
import { useBuyTicket } from '../hooks/useTickets'
import useAuth from '../hooks/useAuth'
import { formatDate, isExpired } from '../utils/dates'
import { getCardColors } from '../utils/colors'
import Button from '../components/ui/Button'

export default function EventDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { data: event, isLoading, isError } = useEvent(id)
  const buy = useBuyTicket()

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
        <p className="text-sm text-[var(--err)]">Event not found.</p>
        <Link to="/" className="mt-4 inline-block text-sm text-[var(--accent)]">
          Back to events
        </Link>
      </div>
    )
  }

  const colors = getCardColors(event)
  const past = isExpired(event.date)
  const sold = event.tickets_sold ?? 0
  const soldOut = event.capacity > 0 && sold >= event.capacity
  const canBuy = !past && !soldOut

  const handleBuy = () => {
    if (!isAuthenticated) {
      toast('Sign in to buy a ticket')
      navigate('/login')
      return
    }
    if (event.has_seats) {
      toast('This event needs a seat — seat picker is on the event page')
    }
    buy.mutate(
      { eventId: event.id },
      { onSuccess: () => navigate('/cabinet') },
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-14">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm text-[var(--muted)] transition-colors hover:text-[var(--text)]"
      >
        <ArrowLeft size={15} /> All events
      </Link>

      <div className="flex flex-col gap-10 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1">
          <p className="font-mono2 text-[11px] uppercase tracking-[0.24em] text-[var(--muted2)]">
            {past ? 'Finished' : soldOut ? 'Sold out' : 'On sale'}
          </p>
          <h1 className="mt-3 font-display text-3xl leading-tight tracking-tight">
            {event.title}
          </h1>

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
            {event.capacity > 0 && (
              <p className="flex items-center gap-2.5 text-[var(--muted)]">
                <Users size={16} className="text-[var(--accent)]" />
                {sold} of {event.capacity} tickets taken
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

              <Button
                onClick={handleBuy}
                loading={buy.isPending}
                disabled={!canBuy}
                className="w-full"
                style={{ background: colors.accent, borderColor: colors.accent, color: colors.bg }}
              >
                {past ? 'Event finished' : soldOut ? 'Sold out' : 'Get ticket'}
              </Button>

              {event.capacity > 0 && canBuy && (
                <p className="mt-3 text-center font-mono2 text-[11px] opacity-50">
                  {Math.max(event.capacity - sold, 0)} left
                </p>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
