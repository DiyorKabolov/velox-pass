export const CATEGORY_COLORS = {
  standard: '#52575f',
  vip: '#fbbf24',
  balcony: '#60a5fa',
  disabled: '#2a2a2a',
}

export const CATEGORY_LABELS = {
  standard: 'Стандарт',
  vip: 'VIP',
  balcony: 'Балкон',
  disabled: 'Недоступно',
}

export const TAKEN_COLOR = '#7f1d1d'
export const SELECTED_COLOR = '#a8b8c8'

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
