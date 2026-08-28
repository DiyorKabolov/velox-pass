import { CATEGORY_COLORS, CATEGORY_CYCLE, rowLetter } from './seatStyles'

const CELL_COLORS = { ...CATEGORY_COLORS, aisle: 'transparent' }

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
        {grid.map((row, r) => (
          <div key={r} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right font-mono2 text-[10px] text-[var(--muted2)]">
              {rowLetter(r + 1)}
            </span>
            <div className="flex gap-1">
              {row.map((kind, c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => cycle(r, c)}
                  title={`${rowLetter(r + 1)}${c + 1} — ${kind}`}
                  className={[
                    'grid h-7 w-7 place-items-center rounded-[5px] font-mono2 text-[9px]',
                    'transition-all duration-150 hover:brightness-125 active:scale-90',
                    kind === 'aisle'
                      ? 'border border-dashed border-[var(--border2)] text-[var(--muted2)]'
                      : '',
                  ].join(' ')}
                  style={{
                    background: CELL_COLORS[kind],
                    color: kind === 'vip' ? '#1a1c1e' : '#cfd3d8',
                  }}
                >
                  {kind === 'aisle' ? '' : c + 1}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-[var(--muted2)]">
        Клик по ячейке: standard → vip → balcony → проход → disabled.
      </p>
    </div>
  )
}
