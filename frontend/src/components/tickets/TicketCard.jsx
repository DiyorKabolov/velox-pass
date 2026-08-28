import { useEffect, useMemo, useState } from 'react'
import { Armchair, CalendarDays, Clock, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { downloadPdf, fetchQrBlobUrl } from '../../api/tickets'
import { formatDateTime, formatIsoDate, isExpired } from '../../utils/dates'
import { getTicketColors, readableOn, withAlpha } from '../../utils/colors'

// Fixed so the card never changes size when its state changes. Sized for the
// tallest content -- a two-line title plus the extra seat row -- because the
// body is centred, so anything taller spills out of the card and the title
// ends up invisible against the page behind it.
const CARD_HEIGHT = 268
const TEAR_WIDTH = 22
const TEETH = 13
// How deep the teeth bite into each half, as a share of the tear width.
const AMPLITUDE = 62

const STATES = {
  valid: { label: 'Активен', color: '#2f7d4f' },
  expired: { label: 'Истёк', color: '#b8433d' },
  used: { label: 'Погашен', color: '#5f6570' },
}

const zig = (i) => (i % 2 === 0 ? 0 : AMPLITUDE)
const seamPoints = () =>
  Array.from(
    { length: TEETH + 1 },
    (_, i) => `${zig(i)},${((i / TEETH) * 100).toFixed(2)}`,
  ).join(' ')

function tearSvg(keep) {
  const pts = seamPoints()
  const d = keep === 'left' ? `M0,0 L${pts} L0,100 Z` : `M100,0 L${pts} L100,100 Z`
  const svg =
    "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' " +
    `preserveAspectRatio='none'><path d='${d}' fill='#fff'/></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/**
 * Give a half its torn edge by masking the element itself rather than covering
 * it with a background-coloured overlay. An overlay leaves a hairline of the
 * layer underneath once the piece is rotated by a fractional angle, and its
 * colour also drifts because it is painted inside the card's grayscale filter.
 */
function tearMask(edge) {
  const svg = tearSvg(edge === 'right' ? 'left' : 'right')
  // Opaque white in both layers, so it masks correctly in alpha and luminance.
  const image = `${svg}, linear-gradient(#fff, #fff)`
  const position =
    edge === 'right' ? 'right center, left center' : 'left center, right center'
  // The solid layer overlaps the zigzag layer by 1px: butting them exactly
  // edge to edge can leave a sub-pixel transparent seam across the card.
  const size = `${TEAR_WIDTH}px 100%, calc(100% - ${TEAR_WIDTH - 1}px) 100%`
  return {
    maskImage: image,
    maskPosition: position,
    maskSize: size,
    maskRepeat: 'no-repeat',
    WebkitMaskImage: image,
    WebkitMaskPosition: position,
    WebkitMaskSize: size,
    WebkitMaskRepeat: 'no-repeat',
  }
}

/** Stable 32-bit hash, so one ticket always gets the same "random" tilt. */
function hashOf(seed, salt) {
  let h = 2166136261 ^ salt
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  }
  return (h >>> 0) / 4294967295
}

/**
 * Tilt for a torn ticket: the body shifts a little, the stub noticeably more,
 * as if the ticket had been picked up, ripped and dropped back down.
 */
function tearAngles(ticketId) {
  const body = -1.7 + hashOf(ticketId, 1) * 3.4
  const spread = 2.6 + hashOf(ticketId, 2) * 3.4
  return { body, stub: body + spread }
}

/**
 * "J14" -> "Ряд J · Место 14". Anything that does not match the row-letter
 * scheme is shown exactly as it came from the API.
 */
function seatText(label) {
  const parts = String(label ?? '').match(/^([A-Za-z]+)(\d+)$/)
  return parts ? `Ряд ${parts[1]} · Место ${parts[2]}` : label
}

function InfoRow({ icon: Icon, children }) {
  return (
    <p className="flex items-center gap-2 text-[13px] leading-none opacity-60 sm:gap-2.5 sm:text-[15px]">
      <Icon size={16} strokeWidth={1.8} className="shrink-0 opacity-80" />
      <span className="truncate">{children}</span>
    </p>
  )
}

export default function TicketCard({ ticket }) {
  const colors = getTicketColors(ticket)
  const stubText = readableOn(colors.accent)

  // Only a scanned ticket is physically torn. A passed event leaves the ticket
  // intact and is called out by the state badge instead.
  const torn = Boolean(ticket.used)
  const state = torn
    ? STATES.used
    : isExpired(ticket.event_date)
      ? STATES.expired
      : STATES.valid

  const tilt = useMemo(() => tearAngles(ticket.ticket_id), [ticket.ticket_id])

  const [qrSrc, setQrSrc] = useState(null)
  const [downloading, setDownloading] = useState(false)

  // The QR endpoint requires the JWT, so it is fetched as a blob rather than
  // pointed at directly from <img src>.
  useEffect(() => {
    let objectUrl = null
    let cancelled = false

    fetchQrBlobUrl(ticket.ticket_id)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url)
          return
        }
        objectUrl = url
        setQrSrc(url)
      })
      .catch(() => setQrSrc(null))

    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [ticket.ticket_id])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      await downloadPdf(ticket.ticket_id)
      toast.success('PDF скачан')
    } catch {
      toast.error('Не удалось скачать PDF')
    } finally {
      setDownloading(false)
    }
  }

  return (
    // Padding leaves room for both halves to tilt out of the row when torn.
    <article
      className="relative w-full max-w-[540px] px-2 py-6"
      style={{ filter: torn ? 'grayscale(0.92) brightness(0.94)' : 'none' }}
    >
      {/* The card itself. Fixed height, so no state changes its size. */}
      <div className="relative flex" style={{ height: CARD_HEIGHT }}>
        {/* Body */}
        <div
          className="flex min-w-0 flex-1 flex-col justify-center gap-3 py-5 pl-4 pr-5 sm:gap-4 sm:py-6 sm:pl-7 sm:pr-9"
          style={{
            background: colors.bg,
            color: colors.text,
            borderRadius: torn ? 18 : '18px 0 0 18px',
            transform: torn ? `rotate(${tilt.body.toFixed(2)}deg)` : 'none',
            transformOrigin: 'center',
            ...(torn ? tearMask('right') : null),
          }}
        >
          <h3 className="line-clamp-2 text-[18px] font-extrabold leading-tight sm:text-[22px]">
            {ticket.event_title ?? 'Событие'}
          </h3>

          <div className="flex flex-col gap-2.5">
            <InfoRow icon={CalendarDays}>{formatDateTime(ticket.event_date)}</InfoRow>
            {ticket.event_location && (
              <InfoRow icon={MapPin}>{ticket.event_location}</InfoRow>
            )}
            {ticket.seat_label && (
              <InfoRow icon={Armchair}>
                <strong className="font-semibold">{seatText(ticket.seat_label)}</strong>
              </InfoRow>
            )}
            <InfoRow icon={Clock}>Получен {formatIsoDate(ticket.created_at)}</InfoRow>
          </div>

          {/* Id, download and state share one row so the height stays constant. */}
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="min-w-0 truncate rounded-full px-2.5 py-1.5 font-mono2 text-[11px]"
              style={{
                background: withAlpha(colors.accent, 0.14),
                border: `1px solid ${withAlpha(colors.accent, 0.45)}`,
              }}
            >
              {ticket.ticket_id}
            </span>

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all duration-150 hover:brightness-95 active:scale-[0.94] disabled:opacity-50 disabled:active:scale-100"
              style={{
                border: `1px solid ${withAlpha(colors.text, 0.22)}`,
                color: colors.text,
              }}
            >
              {downloading ? '…' : '↓ PDF'}
            </button>

            <span
              className="shrink-0 rounded-full px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em]"
              style={{
                color: state.color,
                background: withAlpha(state.color, 0.12),
                border: `1px solid ${withAlpha(state.color, 0.4)}`,
              }}
            >
              {state.label}
            </span>
          </div>
        </div>

        {/* Stub. Once torn it tilts further than the body. */}
        <div
          className="relative flex w-[118px] shrink-0 flex-col items-center justify-center gap-2 px-3 py-5 sm:w-[156px] sm:gap-3 sm:px-4 sm:py-6"
          style={{
            background: colors.accent,
            color: stubText,
            borderRadius: torn ? 18 : '0 18px 18px 0',
            marginLeft: torn ? 7 : 0,
            transform: torn ? `rotate(${tilt.stub.toFixed(2)}deg)` : 'none',
            transformOrigin: 'left center',
            ...(torn ? tearMask('left') : null),
          }}
        >
          <div className="flex h-[86px] w-[86px] items-center justify-center rounded-xl bg-white p-1 sm:h-[104px] sm:w-[104px] sm:p-1.5">
            {qrSrc ? (
              <img
                src={qrSrc}
                alt={`QR-код билета ${ticket.ticket_id}`}
                className="h-full w-full object-contain"
              />
            ) : (
              <span className="font-mono2 text-[9px] text-black/30">QR</span>
            )}
          </div>

          {ticket.seat_label ? (
            <p className="text-center text-[11px] font-bold uppercase leading-tight tracking-[0.08em]">
              {ticket.seat_label}
            </p>
          ) : (
            <p className="text-center text-[10px] font-semibold uppercase leading-[1.4] tracking-[0.12em] opacity-85">
              Покажите
              <br />
              при входе
            </p>
          )}
        </div>

        {/* Intact perforation. Anchored to the stub's own left edge rather than
            a fixed offset, so it tracks the stub when its width changes at the
            sm breakpoint. */}
        {!torn && (
          <>
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-[22px] right-[118px] top-[22px] sm:right-[156px]"
              style={{ borderRight: `2px dashed ${withAlpha(colors.text, 0.3)}` }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute right-[109px] top-[-9px] h-[18px] w-[18px] rounded-full sm:right-[147px]"
              style={{ background: 'var(--bg)' }}
            />
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-[-9px] right-[109px] h-[18px] w-[18px] rounded-full sm:right-[147px]"
              style={{ background: 'var(--bg)' }}
            />
          </>
        )}
      </div>
    </article>
  )
}
