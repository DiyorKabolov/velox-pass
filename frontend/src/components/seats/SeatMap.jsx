import {
  CATEGORY_COLORS,
  LEGEND,
  SELECTED_COLOR,
  TAKEN_COLOR,
  CATEGORY_LABELS,
  groupByRow,
  rowLetter,
  seatNumber,
} from './seatStyles'

function seatFill(seat, isSelected) {
  if (isSelected) return SELECTED_COLOR
  if (seat.is_taken) return TAKEN_COLOR
  return CATEGORY_COLORS[seat.category] ?? CATEGORY_COLORS.standard
}

/**
 * Interactive seat grid.
 *
 * `mode="view"` renders the same picture without click handling, which the
 * hall list and the admin session view use.
 */
export default function SeatMap({
  seats = [],
  selectedSeatId = null,
  onSeatSelect,
  mode = 'select',
  screenLabel = 'Сцена',
}) {
  const rows = groupByRow(seats)
  const selectable = mode === 'select'

  if (!rows.length) {
    return (
      <p className="py-8 text-center text-sm text-[var(--muted)]">
        В этом зале ещё нет мест.
      </p>
    )
  }

  return (
    <div>
      {/* Screen / stage indicator */}
      <div className="mb-6">
        <div
          className="mx-auto h-1.5 w-3/4 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, transparent, var(--accent), transparent)',
          }}
        />
        <p className="mt-2 text-center font-mono2 text-[10px] uppercase tracking-[0.24em] text-[var(--muted2)]">
          {screenLabel}
        </p>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="mx-auto w-fit space-y-1.5">
          {rows.map(([row, cells]) => (
            <div key={row} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right font-mono2 text-[10px] text-[var(--muted2)]">
                {rowLetter(row)}
              </span>

              <div className="flex gap-1.5">
                {cells.map((seat) => {
                  if (seat.is_aisle) {
                    // Aisles keep the grid aligned but are never rendered.
                    return <span key={seat.id} className="h-7 w-7" aria-hidden />
                  }

                  const isSelected = seat.id === selectedSeatId
                  const isBlocked = seat.is_taken || seat.category === 'disabled'
                  const canClick = selectable && !isBlocked

                  return (
                    <button
                      key={seat.id}
                      type="button"
                      disabled={!canClick}
                      onClick={() => canClick && onSeatSelect?.(seat)}
                      title={`Ряд ${rowLetter(row)} · Место ${seatNumber(seat)} · ${
                        CATEGORY_LABELS[seat.category] ?? seat.category
                      }${seat.price ? ` · ${seat.price}` : ''}${
                        seat.is_taken ? ' · занято' : ''
                      }`}
                      aria-label={`Место ${seat.label ?? seat.col}, ${
                        CATEGORY_LABELS[seat.category] ?? seat.category
                      }${seat.is_taken ? ', занято' : ''}`}
                      className={[
                        'grid h-7 w-7 place-items-center rounded-[5px] font-mono2 text-[9px]',
                        'transition-all duration-150',
                        canClick
                          ? 'cursor-pointer hover:brightness-125 active:scale-90'
                          : 'cursor-not-allowed',
                        isSelected ? 'ring-2 ring-[var(--text)] ring-offset-1 ring-offset-[var(--surface)]' : '',
                        seat.category === 'vip' && !seat.is_taken && !isSelected
                          ? 'shadow-[0_0_8px_rgba(251,191,36,0.45)]'
                          : '',
                      ].join(' ')}
                      style={{
                        background: seatFill(seat, isSelected),
                        color: isSelected || seat.category === 'vip' ? '#1a1c1e' : '#cfd3d8',
                        opacity: seat.is_taken ? 0.75 : 1,
                      }}
                    >
                      {seatNumber(seat)}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-2 border-t border-[var(--border)] pt-4">
        {LEGEND.map((item) => (
          <span key={item.key} className="flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
            <span
              className="h-3 w-3 rounded-[3px]"
              style={{ background: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  )
}
