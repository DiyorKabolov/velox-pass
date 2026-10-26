import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useSessionSeats } from '../../hooks/useSessionSeats'
import { useBuyTicket } from '../../hooks/useTickets'
import { formatSessionStamp } from '../../utils/dates'
import { pluralize } from '../../utils/plural'
import { formatPrice } from '../../utils/ticketGroups'
import { EASE_OUT } from '../motion/Motion'
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
    <AnimatePresence>
      {open && session && (
        <motion.div
          key="seat-picker"
          role="dialog"
          aria-modal="true"
          aria-label="Выбор мест"
          className="fixed inset-0 z-[70] flex flex-col bg-[var(--bg)]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.25 } }}
          exit={{ opacity: 0, transition: { duration: 0.2, delay: 0.05 } }}
        >
          <motion.div
            className="flex min-h-0 flex-1 flex-col"
            initial={{ y: 40 }}
            animate={{ y: 0, transition: { duration: 0.6, ease: EASE_OUT } }}
            exit={{ y: 20, transition: { duration: 0.2 } }}
          >
            <header className="border-b border-[var(--border)]">
              <div className="mx-auto flex max-w-5xl items-start justify-between gap-6 px-5 py-5 sm:px-8">
                <div className="min-w-0">
                  <p className="t-label">Выбор мест</p>
                  <p className="mt-2 truncate font-display text-[26px] font-bold uppercase leading-none text-[var(--text)] sm:text-[30px]">
                    {eventTitle}
                  </p>
                  <p className="t-num mt-2 text-[14px] text-[var(--muted)]">
                    {[formatSessionStamp(session.datetime), session.hall_name]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <span className="hidden items-center gap-2 text-[12px] text-[var(--muted)] sm:flex">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: isConnected ? 'var(--ok)' : 'var(--muted2)' }}
                    />
                    {isConnected ? 'обновляется вживую' : 'нет связи'}
                  </span>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Закрыть"
                    className="grid h-10 w-10 place-items-center rounded-[var(--radius-sm)] border border-[var(--border2)] text-[var(--muted)] transition-[color,background-color,transform] duration-200 hover:bg-[var(--surface2)] hover:text-[var(--text)] active:scale-[0.94]"
                  >
                    <X size={18} strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-auto px-5 py-10 sm:px-8">
              <div className="mx-auto max-w-5xl">
                {isCancelled && (
                  <p className="mb-8 rounded-[var(--radius-sm)] bg-[var(--err-bg)] px-4 py-3 text-[14px] text-[var(--err)]">
                    Сеанс отменён.
                  </p>
                )}
                {error && <p className="mb-8 text-[14px] text-[var(--err)]">{error}</p>}
                {isLoading ? (
                  <div className="skeleton mx-auto h-72 max-w-2xl rounded-[var(--radius)]" />
                ) : (
                  <div className="anim-rise" style={{ '--rise': '12px', '--delay': '150ms' }}>
                    <SeatMap
                      seats={seats}
                      selectedSeatIds={selected}
                      onSeatToggle={toggle}
                      mode={isCancelled ? 'view' : 'select'}
                    />
                  </div>
                )}
              </div>
            </div>

            <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
              <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
                <div className="flex items-baseline gap-8">
                  <div>
                    <p className="t-label">Выбрано</p>
                    <p className="t-num mt-1.5 text-[16px] text-[var(--text)]">
                      {pluralize(selected.length, 'место', 'места', 'мест')}
                    </p>
                  </div>
                  <div>
                    <p className="t-label">Итого</p>
                    <p className="t-poster t-num mt-1 text-[30px] leading-none text-[var(--text)]">
                      {total ? formatPrice(total) : 'бесплатно'}
                    </p>
                  </div>
                </div>
                <Button
                  size="lg"
                  onClick={purchase}
                  disabled={!selected.length || isCancelled}
                  loading={buy.isPending}
                >
                  Купить
                  <ArrowRight size={16} strokeWidth={1.75} />
                </Button>
              </div>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
