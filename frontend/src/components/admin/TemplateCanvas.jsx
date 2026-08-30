import { useLayoutEffect, useRef, useState } from 'react'
import { QrCode } from 'lucide-react'
import {
  elementHeight,
  elementLabel,
  FIELD_SAMPLES,
  movedBy,
  toScreen,
} from '../../utils/pdfLayout'

/**
 * The template's first page with the placed elements draggable on top.
 *
 * Dragging is done with pointer events rather than react-draggable: it is a
 * dozen lines here, it avoids adding a dependency for them, and pointer events
 * cover mouse, pen and touch in one path where mouse events cover only the
 * first. Pointer capture keeps the drag alive when the cursor outruns the box.
 */
export default function TemplateCanvas({
  imageUrl,
  layout,
  selected,
  onSelect,
  onMove,
}) {
  const frameRef = useRef(null)
  const drag = useRef(null)
  const [width, setWidth] = useState(0)

  const page = {
    width: layout.page_width || 595,
    height: layout.page_height || 842,
  }
  // One scale for both axes: the frame keeps the page's aspect ratio, so a
  // separate scaleY would only ever equal this one.
  const scale = width ? width / page.width : 0

  useLayoutEffect(() => {
    const frame = frameRef.current
    if (!frame) return undefined
    const measure = () => setWidth(frame.clientWidth)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  const onPointerDown = (event, index) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelect(index)
    drag.current = {
      index,
      startX: event.clientX,
      startY: event.clientY,
      origin: layout.elements[index],
    }
  }

  const onPointerMove = (event) => {
    const state = drag.current
    if (!state || !scale) return
    const next = movedBy(
      state.origin,
      event.clientX - state.startX,
      event.clientY - state.startY,
      scale,
      page,
    )
    onMove(state.index, next)
  }

  const endDrag = (event) => {
    if (!drag.current) return
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // The capture is gone already; nothing to release.
    }
    drag.current = null
  }

  return (
    <div
      ref={frameRef}
      className="relative mx-auto w-full overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-white"
      // The A4 ratio is held by the box itself, so the overlay coordinates stay
      // valid at any width without waiting for the image to load.
      style={{ aspectRatio: `${page.width} / ${page.height}` }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Первая страница шаблона"
          className="pointer-events-none absolute inset-0 h-full w-full select-none object-contain"
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center text-sm text-[var(--muted2)]">
          Загрузка страницы…
        </div>
      )}

      {scale > 0 &&
        layout.elements.map((element, index) => {
          const box = toScreen(element, scale, page.height)
          const isSelected = index === selected
          const isQr = element.type === 'qr'

          return (
            <div
              key={index}
              role="button"
              tabIndex={0}
              aria-label={`${elementLabel(element)}: перетащите, чтобы переместить`}
              onPointerDown={(event) => onPointerDown(event, index)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              className={[
                'absolute cursor-grab touch-none select-none active:cursor-grabbing',
                isSelected
                  ? 'outline outline-2 outline-offset-1 outline-[#3b82f6]'
                  : 'outline-dashed outline-1 outline-offset-1 outline-black/25',
              ].join(' ')}
              style={{
                left: box.left,
                top: box.top,
                height: box.height,
                width: isQr ? element.width * scale : 'auto',
              }}
            >
              {isQr ? (
                <div className="grid h-full w-full place-items-center bg-white/85">
                  <QrCode
                    size={Math.max(12, Math.min(box.height * 0.8, 200))}
                    className="text-black"
                  />
                </div>
              ) : (
                <span
                  className="block whitespace-nowrap leading-none"
                  style={{
                    // Rendered at the element's own size so what is dragged is
                    // the size that will print, not a stand-in.
                    fontSize: elementHeight(element) * scale,
                    color: element.color || '#000000',
                    fontWeight: element.font_weight === 'bold' ? 700 : 400,
                  }}
                >
                  {FIELD_SAMPLES[element.field] ?? element.field}
                </span>
              )}
            </div>
          )
        })}
    </div>
  )
}
