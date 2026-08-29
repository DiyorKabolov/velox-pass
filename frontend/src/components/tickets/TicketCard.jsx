import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Clock, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { downloadPdf, fetchQrBlobUrl } from '../../api/tickets'
import { formatDateTime, formatIsoDate, isExpired } from '../../utils/dates'
import { getTicketColors, readableOn, withAlpha } from '../../utils/colors'
import TruncatedText from '../ui/TruncatedText'

// Fixed so the card never changes size when its state changes, and sized for
// the tallest content -- a two-line title above the three detail rows. The
// body is centred, so content taller than this spills out of the card on both
// sides and the title ends up invisible against the page behind it.
//
// At the sm breakpoint that worst case measures 234px: 48 padding + 32 gaps +
// 55 title (2 x 22px at leading-tight) + 68 details (3 x 16px icon rows +
// 2 x 10px gaps) + 31 id row. Every one of those line-heights is set
// explicitly, so the total does not drift with the webfont.
const CARD_HEIGHT = 244
// Width of the tear and how far the halves are pushed apart. Together they are
// the gap between the two torn edges -- and the notch punched at each edge is
// welded to it, so that same total is exactly how far the pair ends up
// straddling the line the perforation ran on. Shrinking these is the only way
// to bring the notches back towards it; the cost is a shallower zigzag and a
// tighter gap.
const TEAR_WIDTH = 14
const SPLIT = 4
// Nudges the whole tear towards the stub. Without it the seam is pinned to the
// inner end of the strip, which leaves the torn edge sitting left of the line
// the perforation ran on. Must not exceed TEAR_WIDTH - TOOTH (5.32px): beyond
// that the tips of the teeth run past the half's own box and get clipped flat.
const TEAR_SHIFT = 4
// Must stay EVEN. The teeth alternate valley / peak, so an odd count ends the
// seam on a peak while it started in a valley -- the two ends of the tear then
// sit 13.64px apart horizontally, and the notch punched at each end follows,
// leaving the top one visibly left of the bottom one.
const TEETH = 14
// How deep the teeth bite into each half, as a share of the tear width.
const AMPLITUDE = 62
// How far a tooth reaches out of its half, in px.
const TOOTH = (TEAR_WIDTH * AMPLITUDE) / 100
// How much of that reach, measured back from the point, carries the other
// half's colour. A share rather than a fixed width, so it keeps its proportions
// if the tear is ever made deeper or shallower.
const TIP = TOOTH * 0.4
// Diameter of the punched holes at either end of the perforation.
const NOTCH = 18
// A scanned ticket is drained of colour. This lives on the two halves rather
// than on the whole card, so the notches painted over them stay the exact
// colour of the page.
const SPENT = 'grayscale(0.92) brightness(0.94)'

const STATES = {
  valid: { label: 'Активен', color: '#2f7d4f' },
  expired: { label: 'Истёк', color: '#b8433d' },
  used: { label: 'Погашен', color: '#5f6570' },
}

// Starts and ends on a PEAK, not in a valley: the notch at each end of the tear
// is welded to the seam, so this is what decides where the pair sits. The shift
// is folded in here, in the mask's own percentage units, so that everything
// derived from the seam -- the notches and the colour carried onto the teeth --
// follows it without being told about it separately.
const zig = (i) =>
  (i % 2 === 0 ? AMPLITUDE : 0) + (TEAR_SHIFT / TEAR_WIDTH) * 100
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

/** Trimmed string, or null for null / undefined / blank. */
const clean = (value) => {
  const text = String(value ?? '').trim()
  return text || null
}

/**
 * Venue, hall and seat on one line: "Большой зал · Партер · Место A14".
 * Missing parts are dropped rather than leaving stray separators, so a ticket
 * without a seat still reads as plain "Большой зал".
 */
function placeLine(ticket) {
  const seat = clean(ticket.seat_label)
  return [clean(ticket.event_location), clean(ticket.hall_name), seat && `Место ${seat}`]
    .filter(Boolean)
    .join(' · ')
}

/**
 * Where the tear meets the top and bottom edges, measured from the tear-side
 * edge of the half's own box. zig() is in the mask's percentage units, so it
 * is scaled back into the pixels the strip is actually painted at.
 */
const seamAt = (i) => (zig(i) / 100) * TEAR_WIDTH

/**
 * The holes punched through both ends of the perforation, kept visible after
 * the ticket is torn.
 *
 * They are painted over the halves in the page colour rather than cut out of
 * them. A hole would have to be composited into the very mask that carves the
 * zigzag, and anything nested inside a half is clipped away by that mask
 * before it can be seen -- which is why they vanished on a torn ticket.
 *
 * The overlay repeats the halves' own flex layout and tilts, so each disc
 * stays welded to its edge of the tear. The offsets are not the box corners:
 * the mask stops the body short of its box by between TEAR_WIDTH and
 * TEAR_WIDTH - peak, so the discs follow the seam instead.
 */
function TearNotches({ tilt }) {
  // Size inline, not as h-[..] w-[..]: a class built from a template literal is
  // invisible to Tailwind's source scan and would compile to nothing.
  const disc = 'absolute rounded-full'
  const skin = { background: 'var(--bg)', width: NOTCH, height: NOTCH }
  const edge = -NOTCH / 2
  // Punched on the colour boundary rather than on the point of the tooth. On an
  // intact ticket the hole sits exactly where the two colours meet, so half of
  // it should border each; anchored to the point instead, it swallowed the whole
  // coloured tip. TIP back from the seam is that boundary.
  const anchor = (i) => seamAt(i) - TIP
  const bodyRight = (i) => TEAR_WIDTH - anchor(i) - NOTCH / 2
  const stubLeft = (i) => anchor(i) - NOTCH / 2

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-10 flex">
      <div
        className="relative min-w-0 flex-1"
        style={{
          transform: `rotate(${tilt.body.toFixed(2)}deg)`,
          transformOrigin: 'center',
        }}
      >
        <span className={disc} style={{ ...skin, top: edge, right: bodyRight(0) }} />
        <span
          className={disc}
          style={{ ...skin, bottom: edge, right: bodyRight(TEETH) }}
        />
      </div>

      <div
        className="relative w-[118px] shrink-0 sm:w-[156px]"
        style={{
          marginLeft: SPLIT,
          transform: `rotate(${tilt.stub.toFixed(2)}deg)`,
          transformOrigin: 'left center',
        }}
      >
        <span className={disc} style={{ ...skin, top: edge, left: stubLeft(0) }} />
        <span
          className={disc}
          style={{ ...skin, bottom: edge, left: stubLeft(TEETH) }}
        />
      </div>
    </div>
  )
}

/**
 * The other half's colour on the points of the teeth alone, so they read as
 * pulled out of the opposite piece rather than printed that way: on an intact
 * ticket the colours meet on a straight line, so a jagged tear has to carry a
 * little of each side across to the other.
 *
 * Only the outermost TIP of each tooth is covered. The band is pinned to the
 * pointed side -- the body's teeth grow towards its right edge, the stub's away
 * from its left -- so narrowing it eats back from the root, never the point.
 *
 * It belongs inside the half, where the tear mask carves it to exactly the same
 * teeth and the grayscale of a spent ticket reaches it too.
 */
function ToothTint({ edge, color }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-y-0"
      style={{
        // Behind the copy: a positioned child would otherwise paint over it,
        // and at the mobile padding the band reaches 2px into the text box. The
        // half is a stacking context once torn, so this stays above its own
        // background and cannot escape the card.
        zIndex: -1,
        width: TIP,
        // The band the teeth sweep through, which the shift carries along.
        [edge]: edge === 'right' ? TEAR_WIDTH - TOOTH - TEAR_SHIFT : TEAR_SHIFT,
        // A clean edge, not a fade: on an intact ticket the two colours meet on a
        // straight printed line, and this is that line carried onto the teeth.
        background: color,
      }}
    />
  )
}

function InfoRow({ icon: Icon, children }) {
  return (
    <p className="flex items-center gap-2 text-[13px] leading-none opacity-60 sm:gap-2.5 sm:text-[15px]">
      <Icon size={16} strokeWidth={1.8} className="shrink-0 opacity-80" />
      <span className="min-w-0 flex-1">{children}</span>
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

  // An event without a title would otherwise leave the card headless.
  const title = clean(ticket.event_title) ?? 'Мероприятие'
  const place = placeLine(ticket)

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
    <article className="relative w-full max-w-[540px] px-2 py-6">
      {/* The card itself. Fixed height, so no state changes its size. */}
      <div className="relative flex" style={{ height: CARD_HEIGHT }}>
        {/* Body */}
        <div
          className="relative flex min-w-0 flex-1 flex-col justify-center gap-3 py-5 pl-4 pr-5 sm:gap-4 sm:py-6 sm:pl-7 sm:pr-9"
          style={{
            background: colors.bg,
            color: colors.text,
            borderRadius: torn ? 18 : '18px 0 0 18px',
            transform: torn ? `rotate(${tilt.body.toFixed(2)}deg)` : 'none',
            transformOrigin: 'center',
            filter: torn ? SPENT : 'none',
            ...(torn ? tearMask('right') : null),
          }}
        >
          {torn && <ToothTint edge="right" color={colors.accent} />}

          <h3 className="text-[18px] font-extrabold leading-tight sm:text-[22px]">
            <TruncatedText text={title} maxLines={2} />
          </h3>

          <div className="flex flex-col gap-2.5">
            <InfoRow icon={CalendarDays}>
              <span className="block truncate">{formatDateTime(ticket.event_date)}</span>
            </InfoRow>
            {place && (
              <InfoRow icon={MapPin}>
                <TruncatedText text={place} />
              </InfoRow>
            )}
            <InfoRow icon={Clock}>
              <span className="block truncate">
                Получен {formatIsoDate(ticket.created_at)}
              </span>
            </InfoRow>
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
            marginLeft: torn ? SPLIT : 0,
            transform: torn ? `rotate(${tilt.stub.toFixed(2)}deg)` : 'none',
            transformOrigin: 'left center',
            filter: torn ? SPENT : 'none',
            ...(torn ? tearMask('left') : null),
          }}
        >
          {torn && <ToothTint edge="left" color={colors.bg} />}

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

          {/* Always the call to action -- the seat is spelled out in full on
              the body's location line, so repeating it here says nothing new. */}
          <p className="text-center text-[10px] font-semibold uppercase leading-[1.4] tracking-[0.12em] opacity-85">
            Покажите
            <br />
            при входе
          </p>
        </div>

        {torn && <TearNotches tilt={tilt} />}

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
