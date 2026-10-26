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
import { formatPrice } from '../../utils/ticketGroups'

function seatFill(seat, isSelected) {
  if (isSelected) return SELECTED_COLOR
  if (seat.is_taken) return TAKEN_COLOR
  return CATEGORY_COLORS[seat.category] ?? CATEGORY_COLORS.standard
}

/** Ink for the number printed on a seat, against whatever it is filled with. */
function seatInk(seat, isSelected) {
  if (isSelected) return '#170803'
  if (seat.is_taken) return '#4a4540'
  if (seat.category === 'vip' || seat.category === 'balcony') return '#14110f'
  if (seat.category === 'disabled') return 'transparent'
  return '#cfc8bd'
}

/**
 * Interactive seat grid.
 *
 * Two ways to select: pass `selectedSeatIds` (an array, in the order the seats
 * were picked) with `onSeatToggle` to choose several, each marked with its
 * place in that order; or `selectedSeatId` with `onSeatSelect` for one.
 * `mode="view"` renders the same picture without click handling, which the
 * hall list and the admin session view use.
 */
export default function SeatMap({
  seats = [],
  selectedSeatId = null,
  selectedSeatIds = null,
  onSeatSelect,
  onSeatToggle,
  mode = 'select',
  screenLabel = 'Сцена',
}) {
  const rows = groupByRow(seats)
  const selectable = mode === 'select'
  const multi = Array.isArray(selectedSeatIds)
  const order = multi ? new Map(selectedSeatIds.map((id, index) => [id, index + 1])) : null

  // Only the categories this hall actually contains. Listing VIP and balcony in
  // a hall that has neither invites the reader to hunt for seats that are not
  // there. Aisles are excluded because they are never drawn.
  const present = new Set(seats.filter((s) => !s.is_aisle).map((s) => s.category))
  // "Taken" and "selected" are states rather than categories, so they are shown
  // when they can actually occur, not when a category exists.
  if (seats.some((s) => s.is_taken)) present.add('taken')
  if (selectable) present.add('selected')
  const legend = LEGEND.filter((item) => present.has(item.key))

  if (!rows.length) {
    return (
      <p className="py-8 text-center text-[14px] text-[var(--muted)]">
        В этом зале ещё нет мест.
      </p>
    )
  }

  return (
    <div>
      {/* Stage / screen: a band of light the seats face. */}
      <div className="mb-8">
        <div
          className="mx-auto h-[3px] w-3/4 rounded-full"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(241,236,227,0.85) 30%, rgba(241,236,227,0.85) 70%, transparent)',
          }}
        />
        <p className="t-label mt-3 text-center">{screenLabel}</p>
      </div>

      <div className="overflow-x-auto pb-2 pt-2">
        <div className="mx-auto w-fit space-y-1.5">
          {rows.map(([row, cells]) => (
            <div key={row} className="flex items-center gap-2.5">
              <span className="w-6 shrink-0 text-right text-[11px] font-semibold text-[var(--muted2)]">
                {rowLetter(row)}
              </span>

              <div className="flex gap-1.5">
                {cells.map((seat) => {
                  if (seat.is_aisle) {
                    // Aisles keep the grid aligned but are never rendered.
                    return <span key={seat.id} className="h-7 w-7" aria-hidden />
                  }

                  const position = multi ? order.get(seat.id) : null
                  const isSelected = multi ? position !== undefined : seat.id === selectedSeatId
                  const isBlocked = seat.is_taken || seat.category === 'disabled'
                  const canClick = selectable && !isBlocked

                  return (
                    <button
                      key={seat.id}
                      type="button"
                      disabled={!canClick}
                      aria-pressed={selectable ? isSelected : undefined}
                      onClick={() => {
                        if (!canClick) return
                        if (multi) onSeatToggle?.(seat)
                        else onSeatSelect?.(seat)
                      }}
                      title={`Ряд ${rowLetter(row)} · Место ${seatNumber(seat)} · ${
                        CATEGORY_LABELS[seat.category] ?? seat.category
                      }${seat.price ? ` · ${formatPrice(seat.price)}` : ''}${
                        seat.is_taken ? ' · занято' : ''
                      }`}
                      aria-label={`Место ${seat.label ?? seat.col}, ${
                        CATEGORY_LABELS[seat.category] ?? seat.category
                      }${seat.is_taken ? ', занято' : ''}${isSelected ? ', выбрано' : ''}`}
                      className={[
                        'relative grid h-7 w-7 place-items-center rounded-[4px] text-[10px] font-semibold',
                        'transition-[filter,transform,background-color] duration-150 ease-out',
                        canClick
                          ? 'cursor-pointer hover:-translate-y-px hover:brightness-125 active:scale-90'
                          : 'cursor-not-allowed',
                        isSelected ? 'scale-[1.06]' : '',
                      ].join(' ')}
                      style={{
                        background: seatFill(seat, isSelected),
                        color: seatInk(seat, isSelected),
                      }}
                    >
                      {seatNumber(seat)}
                      {/* The order it was picked in, so "the third seat" in the
                          summary can be found on the map. */}
                      {position !== null && position !== undefined && (
                        <span className="absolute -right-1.5 -top-1.5 grid h-[15px] min-w-[15px] place-items-center rounded-full bg-[var(--text)] px-[3px] text-[9px] font-bold leading-none text-[var(--bg)]">
                          {position}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {legend.length > 0 && (
        <div className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 border-t border-[var(--border)] pt-5">
          {legend.map((item) => (
            <span key={item.key} className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
              <span className="h-3 w-3 rounded-[3px]" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
