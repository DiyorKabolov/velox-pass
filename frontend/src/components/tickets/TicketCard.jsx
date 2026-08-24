import { useEffect, useState } from 'react'
import { Download, MapPin, Armchair } from 'lucide-react'
import toast from 'react-hot-toast'
import { downloadPdf, fetchQrBlobUrl } from '../../api/tickets'
import { formatDate, isExpired } from '../../utils/dates'
import { getTicketColors, withAlpha } from '../../utils/colors'
import Badge from '../ui/Badge'

/** ok | used | expired — drives the badge and the torn-card treatment. */
function ticketState(ticket) {
  if (ticket.used) return 'used'
  if (isExpired(ticket.event_date)) return 'expired'
  return 'ok'
}

export default function TicketCard({ ticket }) {
  const colors = getTicketColors(ticket)
  const state = ticketState(ticket)
  const spent = state !== 'ok'

  const [qrSrc, setQrSrc] = useState(null)
  const [downloading, setDownloading] = useState(false)

  // The QR endpoint needs the JWT, so fetch it as a blob rather than <img src>.
  useEffect(() => {
    let revoked = null
    let cancelled = false

    fetchQrBlobUrl(ticket.ticket_id)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        revoked = url
        setQrSrc(url)
      })
      .catch(() => setQrSrc(null))

    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [ticket.ticket_id])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadPdf(ticket.ticket_id)
      toast.success('PDF downloaded')
    } catch {
      toast.error('Could not download the PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div
      className="relative w-[300px] overflow-hidden rounded-[var(--radius)] transition-transform duration-200 hover:-translate-y-0.5"
      style={{
        background: colors.bg,
        color: colors.text,
        opacity: spent ? 0.72 : 1,
        // A used ticket gets a torn bottom edge instead of a flat one.
        clipPath: spent
          ? 'polygon(0 0, 100% 0, 100% 94%, 92% 97%, 84% 93%, 76% 97%, 68% 93%, 60% 97%, 52% 93%, 44% 97%, 36% 93%, 28% 97%, 20% 93%, 12% 97%, 4% 93%, 0 96%)'
          : 'none',
      }}
    >
      <div className="h-1.5 w-full" style={{ background: colors.accent }} />

      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <span
            className="font-display text-[11px] tracking-[0.16em]"
            style={{ color: colors.accent }}
          >
            VELOX·PASS
          </span>
          <Badge tone={state}>{state}</Badge>
        </div>

        <h3 className="font-display text-base leading-snug line-clamp-2">
          {ticket.event_title ?? 'Event'}
        </h3>
        <p className="mt-1.5 text-sm opacity-70">{formatDate(ticket.event_date)}</p>

        {ticket.event_location && (
          <p className="mt-1 flex items-center gap-1.5 truncate text-sm opacity-55">
            <MapPin size={13} /> {ticket.event_location}
          </p>
        )}
        {ticket.seat_label && (
          <p className="mt-1 flex items-center gap-1.5 text-sm opacity-55">
            <Armchair size={13} /> {ticket.seat_label}
          </p>
        )}

        <div
          className="my-4 border-t border-dashed"
          style={{ borderColor: withAlpha(colors.text, 0.18) }}
        />

        <div className="flex items-center gap-4">
          <div
            className="flex h-[86px] w-[86px] shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-white p-1"
            style={{ border: `1px solid ${withAlpha(colors.text, 0.12)}` }}
          >
            {qrSrc ? (
              <img
                src={qrSrc}
                alt={`QR code for ticket ${ticket.ticket_id}`}
                className="h-full w-full object-contain"
                style={{ filter: spent ? 'grayscale(1)' : 'none' }}
              />
            ) : (
              <span className="font-mono2 text-[9px] opacity-40">QR</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-mono2 text-[11px] uppercase tracking-[0.10em] opacity-45">
              Ticket ID
            </p>
            <p className="truncate font-mono2 text-xs">{ticket.ticket_id}</p>

            {Number(ticket.price_paid) > 0 && (
              <p className="mt-2 font-mono2 text-sm">
                {Number(ticket.price_paid).toFixed(2)}
              </p>
            )}

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="mt-3 inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{ background: withAlpha(colors.accent, 0.22), color: colors.text }}
            >
              <Download size={13} />
              {downloading ? 'Preparing…' : 'PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
