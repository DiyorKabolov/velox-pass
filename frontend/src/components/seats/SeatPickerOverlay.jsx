import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowRight, Wifi, WifiOff, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSessionSeats } from '../../hooks/useSessionSeats'
import { useBuyTicket } from '../../hooks/useTickets'
import { formatSessionStamp } from '../../utils/dates'
import { pluralize } from '../../utils/plural'
import { formatPrice } from '../../utils/ticketGroups'
import Button from '../ui/Button'
import SeatMap from './SeatMap'

/**
 * The seat map over the whole screen, for choosing several seats at once.
 *
 * Kept live by the session's WebSocket: a seat someone else buys while it sits
 * in this selection is taken out of it, and the buyer is told, rather than
 * finding out from a refused order.
 */
export default function SeatPickerOverlay({ open, session, eventId, eventTitle, onClose, onBooked }) {
  // Seat ids, in the order they were picked.
  const [selected, setSelected] = useState([])
  const { seats, isLoading, isConnected, isCancelled, error } = useSessionSeats(
    open ? session?.id : null,
  )
  const buy = useBuyTicket()

  useEffect(() => {
    if (!open) setSelected([])
  }, [open])

  // Escape closes; the page behind stays put while this is open.
  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const byId = useMemo(() => new Map(seats.map((seat) => [seat.id, seat])), [seats])

  useEffect(() => {
    const lost = selected.filter((id) => byId.get(id)?.is_taken)
    if (!lost.length) return
    setSelected((current) => current.filter((id) => !lost.includes(id)))
    toast.error(
      lost.length === 1
        ? 'Одно из выбранных мест только что заняли'
        : `${pluralize(lost.length, 'место', 'места', 'мест')} из выбранных только что заняли`,
    )
    // Only a change in the map can take a seat away; the selection is read, not watched.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byId])

  if (!open || !session) return null

  const total = selected.reduce((sum, id) => sum + (byId.get(id)?.price ?? 0), 0)
  const toggle = (seat) =>
    setSelected((current) =>
      current.includes(seat.id) ? current.filter((id) => id !== seat.id) : [...current, seat.id],
    )

  const purchase = () =>
    buy.mutate(
      { eventId, sessionId: session.id, seatIds: selected },
      {
        onSuccess: () => {
          setSelected([])
          onBooked?.()
        },
      },
    )

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Выбор мест"
      className="fixed inset-0 z-[70] flex flex-col bg-[#0d0e10]/95 backdrop-blur-sm"
    >
      <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-5 py-4 sm:px-8">
        <div className="min-w-0">
          <p className="truncate font-display text-base tracking-tight">{eventTitle}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {[formatSessionStamp(session.datetime), session.hall_name].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-1.5 text-xs text-[var(--muted2)] sm:flex">
            {isConnected ? (
              <>
                <Wifi size={13} className="text-[var(--ok)]" /> обновляется вживую
              </>
            ) : (
              <>
                <WifiOff size={13} /> нет связи
              </>
            )}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="rounded-full border border-[var(--border)] p-2 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-5xl">
          {isCancelled && (
            <p className="mb-6 rounded-[var(--radius-sm)] border border-[var(--err)] bg-[var(--err-bg)] px-4 py-3 text-sm text-[var(--err)]">
              Сеанс отменён.
            </p>
          )}
          {error && <p className="mb-6 text-sm text-[var(--err)]">{error}</p>}
          <p className="mb-6 text-center text-sm text-[var(--muted)]">
            Выбрано: {pluralize(selected.length, 'место', 'места', 'мест')}
          </p>
          {isLoading ? (
            <div className="mx-auto h-72 max-w-2xl animate-pulse rounded-[var(--radius)] bg-[var(--surface)]" />
          ) : (
            <SeatMap
              seats={seats}
              selectedSeatIds={selected}
              onSeatToggle={toggle}
              mode={isCancelled ? 'view' : 'select'}
            />
          )}
        </div>
      </div>

      <footer className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4">
          <p className="text-sm">
            <span className="text-[var(--muted)]">Выбрано:</span>{' '}
            <strong>{pluralize(selected.length, 'место', 'места', 'мест')}</strong>
            <span className="mx-2 text-[var(--muted2)]">·</span>
            <span className="text-[var(--muted)]">Итого:</span>{' '}
            <strong className="font-mono2">{total ? formatPrice(total) : 'бесплатно'}</strong>
          </p>
          <Button onClick={purchase} disabled={!selected.length || isCancelled} loading={buy.isPending}>
            Купить
            <ArrowRight size={15} />
          </Button>
        </div>
      </footer>
    </div>,
    document.body,
  )
}
