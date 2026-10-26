import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Gift } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiError } from '../../api/client'
import { acceptGift, declineGift } from '../../api/gifts'
import { GIFTS_KEY } from '../../hooks/useGifts'
import { TICKETS_KEY } from '../../hooks/useTickets'
import { formatDateTime } from '../../utils/dates'
import { ticketStartsAt } from '../../utils/eventState'
import Button from '../ui/Button'

// Warm gold, so a gift reads as something other than an ordinary ticket.
const GOLD = '#e8b54a'

/**
 * A ticket someone gave you, as a voucher: who it is from and what it is for
 * above the tear line, the note and the answer below it.
 */
export default function ReceivedGiftCard({ gift }) {
  const queryClient = useQueryClient()
  const pending = gift.gift_status === 'pending'

  const answer = useMutation({
    mutationFn: (accept) => (accept ? acceptGift(gift.ticket_id) : declineGift(gift.ticket_id)),
    onSuccess: (_, accept) => {
      queryClient.invalidateQueries({ queryKey: GIFTS_KEY })
      queryClient.invalidateQueries({ queryKey: TICKETS_KEY })
      toast.success(
        accept ? 'Подарок принят — билет во вкладке «Мои билеты»' : 'Подарок отклонён',
      )
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось ответить на подарок')),
  })

  const place = [gift.event_location, gift.hall_name, gift.seat_label].filter(Boolean).join(' · ')

  return (
    <article className="relative overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
      <div className="px-6 pb-5 pt-5">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-[13px]" style={{ color: GOLD }}>
            <Gift size={15} strokeWidth={1.75} />
            Подарок от <strong className="font-semibold">{gift.gifted_by_username ?? '—'}</strong>
          </span>
          <span
            className="-rotate-2 rounded-[3px] px-2 pb-[4px] pt-[5px] font-display text-[11.5px] font-bold uppercase leading-none tracking-[0.04em]"
            style={{
              color: pending ? GOLD : 'var(--ok)',
              boxShadow: `inset 0 0 0 1.5px ${pending ? 'rgba(232,181,74,0.7)' : 'rgba(111,208,140,0.7)'}`,
            }}
          >
            {pending ? 'Ожидает принятия' : 'Принято'}
          </span>
        </div>

        <h3 className="t-poster mt-4 text-[34px] text-[var(--text)]">{gift.event_title}</h3>
        <p className="t-num mt-3 text-[14px] text-[var(--muted)]">
          {formatDateTime(ticketStartsAt(gift))}
          {place && <span className="text-[var(--muted2)]"> · {place}</span>}
        </p>
      </div>

      {(gift.gift_message || pending) && (
        <div className="relative border-t border-dashed border-[var(--border2)] px-6 pb-6 pt-5">
          <span aria-hidden className="absolute -left-2 -top-2 h-4 w-4 rounded-full bg-[var(--bg)]" />
          <span aria-hidden className="absolute -right-2 -top-2 h-4 w-4 rounded-full bg-[var(--bg)]" />

          {gift.gift_message && (
            <blockquote className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--text)]">
              <span aria-hidden className="mr-1 font-display text-[22px] leading-none" style={{ color: GOLD }}>
                «
              </span>
              {gift.gift_message}
              <span aria-hidden className="ml-1 font-display text-[22px] leading-none" style={{ color: GOLD }}>
                »
              </span>
            </blockquote>
          )}

          {pending && (
            <div className={`flex gap-2 ${gift.gift_message ? 'mt-5' : ''}`}>
              <Button
                loading={answer.isPending && answer.variables === true}
                disabled={answer.isPending}
                onClick={() => answer.mutate(true)}
                style={{ background: GOLD, borderColor: GOLD, color: '#14110f' }}
              >
                Принять
              </Button>
              <Button
                variant="ghost"
                loading={answer.isPending && answer.variables === false}
                disabled={answer.isPending}
                onClick={() => answer.mutate(false)}
              >
                Отклонить
              </Button>
            </div>
          )}
        </div>
      )}
    </article>
  )
}
