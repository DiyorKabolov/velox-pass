import { useEffect, useState } from 'react'
import { Wifi, WifiOff } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSessionSeats } from '../../hooks/useSessionSeats'
import { useBuyTicket } from '../../hooks/useTickets'
import { formatDateTime } from '../../utils/dates'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import SeatMap from './SeatMap'

/** Seat picker for one session, kept live by the session WebSocket. */
export default function SeatBookingModal({ open, session, eventId, onClose, onBooked }) {
  const [selected, setSelected] = useState(null)
  const { seats, isLoading, isConnected, isCancelled, error } = useSessionSeats(
    open ? session?.id : null,
  )
  const buy = useBuyTicket()

  useEffect(() => {
    if (!open) setSelected(null)
  }, [open])

  // If someone else takes the seat we picked, drop the selection.
  useEffect(() => {
    if (!selected) return
    const fresh = seats.find((seat) => seat.id === selected.id)
    if (fresh?.is_taken) {
      setSelected(null)
      toast.error('Это место только что заняли')
    }
  }, [seats, selected])

  const handleBook = () => {
    if (!selected) return
    buy.mutate(
      { eventId, sessionId: session.id, seatId: selected.id },
      {
        onSuccess: () => {
          setSelected(null)
          onBooked?.()
          onClose()
        },
      },
    )
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={session ? formatDateTime(session.datetime) : 'Выбор места'}
      subtitle={
        session
          ? [session.hall_name, session.venue_name].filter(Boolean).join(' · ')
          : undefined
      }
      footer={
        <>
          <span className="mr-auto flex items-center gap-1.5 text-xs text-[var(--muted2)]">
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
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleBook} disabled={!selected} loading={buy.isPending}>
            {selected
              ? `Взять ${selected.label ?? selected.col}${
                  selected.price ? ` · ${selected.price}` : ''
                }`
              : 'Выберите место'}
          </Button>
        </>
      }
    >
      {isCancelled && (
        <p className="mb-4 rounded-[var(--radius-sm)] border border-[var(--err)] bg-[var(--err-bg)] px-4 py-3 text-sm text-[var(--err)]">
          Сеанс отменён.
        </p>
      )}
      {error && <p className="mb-4 text-sm text-[var(--err)]">{error}</p>}

      {isLoading ? (
        <div className="h-56 animate-pulse rounded-[var(--radius)] bg-[var(--surface2)]" />
      ) : (
        <SeatMap
          seats={seats}
          selectedSeatId={selected?.id ?? null}
          onSeatSelect={setSelected}
          mode={isCancelled ? 'view' : 'select'}
        />
      )}

      {selected && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] px-4 py-3">
          <span className="text-sm text-[var(--text)]">
            Место <strong>{selected.label ?? selected.col}</strong>
            <span className="text-[var(--muted)]"> · {selected.category}</span>
          </span>
          <span className="font-mono2 text-sm text-[var(--accent)]">
            {selected.price ? selected.price.toFixed(2) : 'бесплатно'}
          </span>
        </div>
      )}
    </Modal>
  )
}
