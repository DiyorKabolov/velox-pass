import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Text that clamps to `maxLines` and, only when it actually had to cut
 * something off, reveals the full string in a popup on click.
 *
 * The popup is rendered into <body> instead of next to the text. Its natural
 * place inside the ticket card would be clipped by the card's tear mask and
 * tinted by the grayscale filter a scanned card carries, and it would be
 * trapped inside the card's fixed height.
 */

const GAP = 10 // between the field and the popup
const EDGE = 8 // smallest distance the popup keeps from the viewport edge
const MAX_WIDTH = 280

export default function TruncatedText({ text, maxLines = 1, className = '' }) {
  const value = text == null ? '' : String(text)

  const ref = useRef(null)
  const popupRef = useRef(null)
  const [truncated, setTruncated] = useState(false)
  const [placement, setPlacement] = useState(null)

  const close = useCallback(() => setPlacement(null), [])

  // Whether the text is really cut off. A single line overflows sideways, a
  // clamped block overflows downwards -- the two need different measurements.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined

    const measure = () => {
      const overflow =
        maxLines > 1
          ? el.scrollHeight - el.clientHeight
          : el.scrollWidth - el.clientWidth
      // A pixel of slack: sub-pixel text metrics otherwise report an overflow
      // on strings that visually fit.
      setTruncated(overflow > 1)
    }

    measure()

    // The card is fluid, so the same string truncates at one width and not at
    // another; a late webfont swap changes the answer too.
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    document.fonts?.ready?.then(measure).catch(() => {})

    return () => observer.disconnect()
  }, [value, maxLines])

  // Text can stop being truncated (window widened) while its popup is open.
  useEffect(() => {
    if (!truncated) close()
  }, [truncated, close])

  const open = () => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return

    const width = Math.min(MAX_WIDTH, window.innerWidth - EDGE * 2)
    // Prefer above; drop below only when there is not enough room up there.
    const above = rect.top > 96
    const centre = rect.left + rect.width / 2
    const left = Math.min(
      Math.max(centre - width / 2, EDGE),
      window.innerWidth - width - EDGE,
    )

    setPlacement({
      width,
      left,
      above,
      top: above ? rect.top - GAP : rect.bottom + GAP,
      // Where the arrow sits along the popup, so it keeps pointing at the
      // field even after the popup was pushed away from a viewport edge.
      arrow: Math.min(Math.max(centre - left, 14), width - 14),
    })
  }

  useEffect(() => {
    if (!placement) return undefined

    // mousedown, not click: a click on another TruncatedText closes this one
    // first and then opens its own, so only one popup is ever on screen.
    const onPointerDown = (event) => {
      if (popupRef.current?.contains(event.target)) return
      if (ref.current?.contains(event.target)) return
      close()
    }
    const onKeyDown = (event) => event.key === 'Escape' && close()

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    // Fixed positioning is frozen at open time, so anything that moves the
    // field dismisses the popup rather than letting it drift away from it.
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [placement, close])

  const toggle = () => (placement ? close() : open())

  // The clamp stays applied even when the text fits: dropping it would let the
  // string re-expand, which would flip the measurement back and loop forever.
  // Multi-line clamping is inline rather than `line-clamp-${maxLines}`, which
  // Tailwind cannot see when it scans the source and would strip from the CSS.
  const clampStyle =
    maxLines > 1
      ? {
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: maxLines,
          overflow: 'hidden',
        }
      : null

  return (
    <>
      <span
        ref={ref}
        style={clampStyle}
        className={`${maxLines > 1 ? '' : 'block truncate'} ${className} ${
          truncated ? 'cursor-pointer' : ''
        }`}
        {...(truncated
          ? {
              role: 'button',
              tabIndex: 0,
              'aria-expanded': Boolean(placement),
              onClick: (event) => {
                event.stopPropagation()
                toggle()
              },
              onKeyDown: (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                toggle()
              },
            }
          : null)}
      >
        {value}
      </span>

      {placement &&
        createPortal(
          <div
            ref={popupRef}
            role="tooltip"
            className="fixed z-[100] rounded-lg bg-[#22252a] px-3 py-2 text-[13px] leading-snug text-white shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
            style={{
              left: placement.left,
              top: placement.top,
              width: placement.width,
              transform: placement.above ? 'translateY(-100%)' : 'none',
            }}
          >
            {value}
            <span
              aria-hidden
              className="absolute h-2.5 w-2.5 rotate-45 bg-[#22252a]"
              style={{
                left: placement.arrow - 5,
                [placement.above ? 'bottom' : 'top']: -4,
              }}
            />
          </div>,
          document.body,
        )}
    </>
  )
}
