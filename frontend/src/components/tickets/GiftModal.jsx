import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { apiError } from '../../api/client'
import { giftTicket } from '../../api/gifts'
import useTickets, { TICKETS_KEY } from '../../hooks/useTickets'
import { formatDateTime } from '../../utils/dates'
import { isTicketExpired, ticketStartsAt } from '../../utils/eventState'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Select from '../ui/Select'

const GOLD = '#fbbf24'

/**
 * Give one of your tickets to a chosen friend.
 *
 * The friend is settled -- this opens from their row on the friends page -- so
 * what is chosen here is the ticket. Only tickets that can still be used are
 * offered; a gift waiting for an answer is not among them, since the server
 * keeps those out of the ticket list entirely.
 */
export default function GiftModal({ friend, open, onClose }) {
  const queryClient = useQueryClient()
  const { data: tickets, isLoading } = useTickets()
  const [ticketId, setTicketId] = useState('')
  const [message, setMessage] = useState('')

  const giftable = useMemo(
    () => (tickets ?? []).filter((ticket) => !ticket.used && !isTicketExpired(ticket)),
    [tickets],
  )

  const send = useMutation({
    mutationFn: () => giftTicket(ticketId, friend.username, message),
    onSuccess: (result) => {
      toast.success(
        result.mail_sent === false
          ? `Билет отправлен! ${friend.username} увидит подарок в личном кабинете.`
          : `Билет отправлен! ${friend.username} получит уведомление.`,
        { duration: 6000 },
      )
      onClose()
      // The ticket has left this cabinet; anything showing it is now stale.
      queryClient.invalidateQueries({ queryKey: TICKETS_KEY })
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось подарить билет')),
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title={`Подарить билет другу ${friend.username}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={() => send.mutate()}
            loading={send.isPending}
            disabled={!ticketId}
            style={{ background: GOLD, borderColor: GOLD, color: '#1a1c1e' }}
          >
            Подарить
          </Button>
        </>
      }
    >
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface2)]" />
      ) : !giftable.length ? (
        <p className="py-4 text-center text-sm text-[var(--muted)]">
          Действующих билетов нет.{' '}
          <Link to="/" onClick={onClose} className="text-[var(--accent)]">
            Выбрать что-нибудь в афише
          </Link>
        </p>
      ) : (
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              Выберите билет
            </span>
            <Select
              value={ticketId}
              onChange={setTicketId}
              placeholder="— билет —"
              aria-label="Выберите билет"
              options={giftable.map((ticket) => ({
                value: ticket.ticket_id,
                label: `${ticket.event_title} · ${formatDateTime(ticketStartsAt(ticket))}`,
              }))}
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              Сообщение
            </span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Поздравляю! 🎉"
              className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition-all duration-150 placeholder:text-[var(--muted2)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25"
            />
          </label>

          <p className="text-xs text-[var(--muted2)]">
            Билет сразу перейдёт к другу. Пока он не примет подарок, пройти по билету нельзя,
            а если откажется — билет вернётся к вам с новым QR-кодом.
          </p>
        </div>
      )}
    </Modal>
  )
}
