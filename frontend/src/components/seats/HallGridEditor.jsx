import { CATEGORY_COLORS, CATEGORY_CYCLE, CATEGORY_LABELS, rowLetter } from './seatStyles'

const CELL_COLORS = { ...CATEGORY_COLORS, aisle: 'transparent' }
const CELL_LABELS = { ...CATEGORY_LABELS, aisle: 'Проход' }

/**
 * The number each cell of a row will carry, as the server will number it:
 * consecutively along the row, with an aisle taking none (see
 * seats_for_layout). The grid column would put a gap after every aisle and
 * disagree with the seat map buyers see.
 */
function seatNumbers(row) {
  let number = 0
  return row.map((kind) => (kind === 'aisle' ? null : ++number))
}

// A label in the middle of a sentence: lower case, unless it is an
// abbreviation such as VIP.
const inline = (label) => (/^[A-ZА-ЯЁ]+$/.test(label) ? label : label.toLowerCase())

/** Empty grid of the given size, everything standard. */
export function makeGrid(rows, cols, previous) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => previous?.[r]?.[c] ?? 'standard'),
  )
}

/** Editor grid -> the layout_json the API expects. */
export function gridToLayout(grid) {
  return {
    seats: grid.map((row) =>
      row.map((kind) => ({
        category: kind === 'aisle' ? 'standard' : kind,
        is_aisle: kind === 'aisle',
      })),
    ),
  }
}

/**
 * Click a cell to cycle standard -> vip -> balcony -> aisle -> disabled.
 * State lives in the parent so the grid can be rebuilt when rows/cols change.
 */
export default function HallGridEditor({ grid, onChange }) {
  const cycle = (r, c) => {
    const current = grid[r][c]
    const next = CATEGORY_CYCLE[(CATEGORY_CYCLE.indexOf(current) + 1) % CATEGORY_CYCLE.length]
    onChange(grid.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? next : cell))))
  }

  if (!grid.length || !grid[0]?.length) {
    return (
      <p className="py-6 text-center text-sm text-[var(--muted)]">
        Задайте количество рядов и мест.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto">
      <div className="w-fit space-y-1">
        {grid.map((row, r) => {
          const numbers = seatNumbers(row)
          return (
            <div key={r} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-[11px] font-semibold text-[var(--muted2)]">
                {rowLetter(r + 1)}
              </span>
              <div className="flex gap-1">
                {row.map((kind, c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => cycle(r, c)}
                    title={`${rowLetter(r + 1)}${numbers[c] ?? ''} — ${CELL_LABELS[kind] ?? kind}`}
                    className={[
                      'grid h-7 w-7 place-items-center rounded-[4px] text-[10px] font-semibold',
                      'transition-all duration-150 hover:brightness-125 active:scale-90',
                      kind === 'aisle'
                        ? 'border border-dashed border-[var(--border2)] text-[var(--muted2)]'
                        : '',
                    ].join(' ')}
                    style={{
                      background: CELL_COLORS[kind],
                      color: kind === 'vip' || kind === 'balcony' ? '#14110f' : '#cfc8bd',
                    }}
                  >
                    {numbers[c] ?? ''}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <p className="mt-4 text-[13px] text-[var(--muted2)]">
        Клик по ячейке меняет её: {CATEGORY_CYCLE.map((kind) => inline(CELL_LABELS[kind])).join(' → ')}.
      </p>
    </div>
  )
}
