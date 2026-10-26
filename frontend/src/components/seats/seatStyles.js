// Seats are drawn in the lobby's own inks: a warm grey for the ordinary seat,
// gold for VIP, a cool steel for the balcony. A taken seat sinks almost into
// the floor, an unavailable one is hatched, and the seats being chosen light up
// in the signal colour -- the only vermilion on the map.
export const CATEGORY_COLORS = {
  standard: '#3b3732',
  vip: '#e8b54a',
  balcony: '#8aa1d6',
  disabled: 'repeating-linear-gradient(135deg, #1d1b19 0 3px, #2a2723 3px 6px)',
}

export const CATEGORY_LABELS = {
  standard: 'Стандарт',
  vip: 'VIP',
  balcony: 'Балкон',
  disabled: 'Недоступно',
}

export const TAKEN_COLOR = '#211e1b'
export const SELECTED_COLOR = '#ff5b2e'

/** Cycle used by the hall editor when a cell is clicked. */
export const CATEGORY_CYCLE = ['standard', 'vip', 'balcony', 'aisle', 'disabled']

export const LEGEND = [
  { key: 'standard', label: 'Стандарт', color: CATEGORY_COLORS.standard },
  { key: 'vip', label: 'VIP', color: CATEGORY_COLORS.vip },
  { key: 'balcony', label: 'Балкон', color: CATEGORY_COLORS.balcony },
  { key: 'disabled', label: 'Недоступно', color: CATEGORY_COLORS.disabled },
  { key: 'taken', label: 'Занято', color: TAKEN_COLOR },
  { key: 'selected', label: 'Выбрано', color: SELECTED_COLOR },
]

/** 1 -> A, 26 -> Z, 27 -> AA. Matches the backend's label scheme. */
export function rowLetter(row) {
  let label = ''
  let n = row
  while (n > 0) {
    const rest = (n - 1) % 26
    label = String.fromCharCode(65 + rest) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

/** Group a flat seat list into rows, preserving column order. */
export function groupByRow(seats) {
  const rows = new Map()
  for (const seat of seats) {
    if (!rows.has(seat.row)) rows.set(seat.row, [])
    rows.get(seat.row).push(seat)
  }
  return [...rows.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([row, cells]) => [row, cells.sort((a, b) => a.col - b.col)])
}

/**
 * Number printed on a seat. It comes from the label ("A3" -> 3), which the
 * backend numbers consecutively skipping aisles; `col` is only the grid
 * coordinate and would show a gap where an aisle sits.
 */
export function seatNumber(seat) {
  const digits = String(seat.label ?? '').match(/\d+$/)
  return digits ? digits[0] : seat.col
}
