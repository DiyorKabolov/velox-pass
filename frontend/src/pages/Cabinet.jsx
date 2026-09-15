import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Gift, MapPin } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { apiError } from '../api/client'
import { acceptGift, declineGift, getReceivedGifts } from '../api/gifts'
import useTickets, { TICKETS_KEY } from '../hooks/useTickets'
import TicketCard from '../components/tickets/TicketCard'
import Button from '../components/ui/Button'
import { formatDateTime } from '../utils/dates'
import { ticketStartsAt } from '../utils/eventState'
import { pluralize } from '../utils/plural'

// Warm gold, so a gift reads as something other than an ordinary ticket.
const GOLD = '#fbbf24'
const GIFTS_KEY = ['gifts', 'received']

function GiftCard({ gift }) {
  const queryClient = useQueryClient()
  const pending = gift.gift_status === 'pending'

  const answer = useMutation({
    mutationFn: (accept) => (accept ? acceptGift(gift.ticket_id) : declineGift(gift.ticket_id)),
    onSuccess: (_, accept) => {
      queryClient.invalidateQueries({ queryKey: GIFTS_KEY })
      queryClient.invalidateQueries({ queryKey: TICKETS_KEY })
      toast.success(accept ? 'Подарок принят — билет в списке ниже' : 'Подарок отклонён')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось ответить на подарок')),
  })

  const place = [gift.event_location, gift.hall_name, gift.seat_label].filter(Boolean).join(' · ')

  return (
    <article
      className="w-full max-w-[540px] rounded-[18px] border p-5"
      style={{ borderColor: `${GOLD}55`, background: `linear-gradient(135deg, ${GOLD}14, var(--surface) 55%)` }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="flex items-center gap-2 text-sm" style={{ color: GOLD }}>
          <Gift size={16} />
          От: <strong>{gift.gifted_by_username ?? '—'}</strong>
        </span>
        <span
          className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{
            color: pending ? GOLD : 'var(--ok)',
            background: pending ? `${GOLD}1f` : 'var(--ok-bg)',
          }}
        >
          {pending ? 'Ожидает принятия' : 'Принято'}
        </span>
      </div>

      <h3 className="text-lg font-extrabold leading-tight">{gift.event_title}</h3>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--muted)]">
        <CalendarDays size={13} /> {formatDateTime(ticketStartsAt(gift))}
      </p>
      {place && (
        <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <MapPin size={13} /> {place}
        </p>
      )}

      {gift.gift_message && (
        <blockquote
          className="mt-4 whitespace-pre-line rounded-[var(--radius-sm)] border-l-2 px-3 py-2 text-sm"
          style={{ borderColor: GOLD, background: `${GOLD}0d` }}
        >
          {gift.gift_message}
        </blockquote>
      )}

      {pending && (
        <div className="mt-4 flex gap-2">
          <Button
            size="sm"
            loading={answer.isPending && answer.variables === true}
            disabled={answer.isPending}
            onClick={() => answer.mutate(true)}
            style={{ background: GOLD, borderColor: GOLD, color: '#1a1c1e' }}
          >
            Принять
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={answer.isPending && answer.variables === false}
            disabled={answer.isPending}
            onClick={() => answer.mutate(false)}
          >
            Отклонить
          </Button>
        </div>
      )}
    </article>
  )
}

export default function Cabinet() {
  const { data: tickets, isLoading, isError } = useTickets()
  const { data: gifts } = useQuery({ queryKey: GIFTS_KEY, queryFn: getReceivedGifts })
  const [searchParams, setSearchParams] = useSearchParams()

  // Arriving from a gift answered by its e-mailed link: say so once, then tidy
  // the address so a reload does not say it again.
  useEffect(() => {
    const outcome = searchParams.get('gift')
    if (!outcome) return
    if (outcome === 'accepted') toast.success('Подарок принят')
    else if (outcome === 'declined') toast('Подарок отклонён')
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <header className="mb-12 text-center">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.28em] text-[var(--muted2)]">
          Личный кабинет
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
          Мои билеты
        </h1>
        {tickets?.length > 0 && (
          <p className="mt-3 text-sm text-[var(--muted)]">
            {pluralize(tickets.length, 'билет', 'билета', 'билетов')} получено
          </p>
        )}
      </header>

      {gifts?.length > 0 && (
        <section className="mb-14">
          <h2 className="mb-5 text-center font-display text-lg tracking-tight" style={{ color: GOLD }}>
            🎁 Подарки
          </h2>
          <div className="flex flex-wrap justify-center gap-5">
            {gifts.map((gift) => (
              <GiftCard key={gift.id} gift={gift} />
            ))}
          </div>
        </section>
      )}

      {isLoading && (
        <div className="flex flex-wrap justify-center gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-[244px] w-full max-w-[540px] animate-pulse rounded-[18px] bg-[var(--surface)]"
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-center text-sm text-[var(--err)]">
          Не удалось загрузить билеты.
        </p>
      )}

      {!isLoading && !isError && tickets?.length === 0 && (
        <p className="text-center text-sm text-[var(--muted)]">
          Билетов пока нет. Выберите что-нибудь в афише.
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-6">
        {tickets?.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </div>
    </div>
  )
}
