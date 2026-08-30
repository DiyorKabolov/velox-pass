/**
 * The layout model shared by the editor's list and its canvas.
 *
 * PDF places the origin at the bottom-left and counts upwards; the browser
 * counts down from the top-left. Every conversion between the two lives here,
 * so the flip is written once instead of at each call site.
 */

export const PAGE_WIDTH = 595
export const PAGE_HEIGHT = 842

export const FIELD_LABELS = {
  event_title: 'Название события',
  date: 'Дата',
  location: 'Место проведения',
  buyer_name: 'Имя покупателя',
  seat: 'Место в зале',
  ticket_id: 'ID билета',
}

/** What the canvas shows in place of real ticket data. */
export const FIELD_SAMPLES = {
  event_title: 'Балет «Щелкунчик»',
  date: '20.09.2026 19:00',
  location: 'Театр имени Вахтангова',
  buyer_name: 'Иван Петров',
  seat: 'Ряд 5 · J14',
  ticket_id: 'VP-4E57E4E880AA',
}

export const ADDABLE = [
  { value: 'qr', label: 'QR-код' },
  ...Object.entries(FIELD_LABELS).map(([value, label]) => ({ value, label })),
]

export const EMPTY_LAYOUT = {
  page_width: PAGE_WIDTH,
  page_height: PAGE_HEIGHT,
  elements: [],
}

const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** layout_json (a string from the API) into a usable object. */
export function parseLayout(raw) {
  if (!raw) return { ...EMPTY_LAYOUT, elements: [] }
  let data
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch {
    return { ...EMPTY_LAYOUT, elements: [] }
  }
  if (!data || typeof data !== 'object') return { ...EMPTY_LAYOUT, elements: [] }
  return {
    page_width: num(data.page_width, PAGE_WIDTH),
    page_height: num(data.page_height, PAGE_HEIGHT),
    elements: Array.isArray(data.elements)
      ? data.elements.filter((e) => e && typeof e === 'object')
      : [],
  }
}

/** A new element of the given kind, dropped somewhere visible on the page. */
export function makeElement(kind, index = 0) {
  // Staggered, so several added in a row do not land on top of each other.
  const y = PAGE_HEIGHT - 100 - index * 30
  if (kind === 'qr') {
    return { type: 'qr', x: 400, y: Math.max(y - 120, 40), width: 120, height: 120 }
  }
  return {
    type: 'text',
    field: kind,
    x: 50,
    y: Math.max(y, 40),
    font_size: kind === 'event_title' ? 18 : 12,
    font_weight: kind === 'event_title' ? 'bold' : 'normal',
    color: kind === 'event_title' ? '#000000' : '#444444',
  }
}

/**
 * The height an element occupies. A text element has no height of its own --
 * its y is the baseline reportlab draws from -- so the font size stands in for
 * it, which is what makes the canvas box line up with the printed line.
 */
export function elementHeight(element) {
  return element.type === 'qr' ? num(element.height, 120) : num(element.font_size, 12)
}

export function elementWidth(element, pageWidth = PAGE_WIDTH) {
  if (element.type === 'qr') return num(element.width, 120)
  // Text has no stored width; the box is only a drag handle, so an estimate
  // from the sample string is enough. 0.55em per character is about right for a
  // sans-serif face.
  const sample = FIELD_SAMPLES[element.field] ?? ''
  const guess = sample.length * num(element.font_size, 12) * 0.55
  return Math.min(Math.max(guess, 40), pageWidth)
}

/** PDF point box -> CSS box on a canvas scaled by `scale`. */
export function toScreen(element, scale, pageHeight = PAGE_HEIGHT) {
  const height = elementHeight(element)
  return {
    left: num(element.x, 0) * scale,
    // The flip: PDF y counts up from the bottom, CSS top counts down.
    top: (pageHeight - num(element.y, 0) - height) * scale,
    height: height * scale,
  }
}

/** A drag in CSS pixels -> the new PDF-point position, clamped to the page. */
export function movedBy(element, dxPx, dyPx, scale, page) {
  const width = elementWidth(element, page.width)
  const height = elementHeight(element)
  const x = num(element.x, 0) + dxPx / scale
  // Dragging down on screen lowers the PDF y, hence the minus.
  const y = num(element.y, 0) - dyPx / scale
  return {
    x: Math.round(Math.min(Math.max(x, 0), page.width - Math.min(width, page.width))),
    y: Math.round(Math.min(Math.max(y, 0), page.height - height)),
  }
}

export function serializeLayout(layout) {
  return JSON.stringify({
    page_width: layout.page_width ?? PAGE_WIDTH,
    page_height: layout.page_height ?? PAGE_HEIGHT,
    elements: layout.elements,
  })
}

export function elementLabel(element) {
  if (element.type === 'qr') return 'QR-код'
  return FIELD_LABELS[element.field] ?? element.field
}
