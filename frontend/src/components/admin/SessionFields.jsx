import { useQuery } from '@tanstack/react-query'
import { getVenueHalls, getVenues } from '../../api/venues'
import Input from '../ui/Input'
import Select from '../ui/Select'
import RecurrenceEditor from './RecurrenceEditor'
import { CATEGORY_LABELS, PRICE_CATEGORIES } from './sessionForm'

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  )
}

/**
 * Everything about one showing except which event it belongs to: hall, when,
 * and what a seat costs.
 *
 * The event is deliberately left out. Scheduling is reached two ways now -- from
 * an event's own row, where the event is already known, and from the new-event
 * page, where it does not exist yet -- and in neither is there anything to pick.
 */
export default function SessionFields({ value, onChange, disabled = false }) {
  const set = (patch) => onChange({ ...value, ...patch })

  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: getVenues })
  const { data: halls } = useQuery({
    queryKey: ['venues', value.venueId, 'halls'],
    queryFn: () => getVenueHalls(value.venueId),
    enabled: Boolean(value.venueId),
  })

  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label="Вид сеанса"
        className="flex gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] p-1"
      >
        {[
          { key: 'single', label: 'Разовый сеанс' },
          { key: 'series', label: 'Повторяющиеся сеансы' },
        ].map((option) => {
          const active = value.mode === option.key
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => set({ mode: option.key })}
              className={[
                'flex-1 rounded-[6px] px-3 py-1.5 text-xs transition-all duration-150',
                active
                  ? 'bg-[var(--accent)] font-medium text-[var(--bg)]'
                  : 'text-[var(--muted)] hover:text-[var(--text)]',
              ].join(' ')}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Площадка">
          <Select
            value={value.venueId}
            disabled={disabled}
            // Halls belong to one venue, so a hall chosen under the old one
            // would be scheduled somewhere else entirely.
            onChange={(venueId) => set({ venueId, hallId: '' })}
            placeholder="— выберите —"
            aria-label="Площадка"
            options={(venues ?? []).map((venue) => ({
              value: String(venue.id),
              label: venue.name,
            }))}
          />
        </Field>

        <Field label="Зал">
          <Select
            value={value.hallId}
            disabled={disabled || !value.venueId}
            onChange={(hallId) => set({ hallId })}
            placeholder="— выберите —"
            aria-label="Зал"
            options={(halls ?? []).map((hall) => ({
              value: String(hall.id),
              label: `${hall.name} (${hall.seats_count})`,
            }))}
          />
        </Field>
      </div>

      {value.mode === 'series' ? (
        <RecurrenceEditor value={value.rule} onChange={(rule) => set({ rule })} />
      ) : (
        <Input
          label="Дата и время"
          name="datetime"
          type="datetime-local"
          value={value.datetime}
          disabled={disabled}
          onChange={(event) => set({ datetime: event.target.value })}
        />
      )}

      <div>
        <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
          Цены по категориям
        </span>
        <div className="grid gap-3 sm:grid-cols-3">
          {PRICE_CATEGORIES.map((category) => (
            <Input
              key={category}
              label={CATEGORY_LABELS[category] ?? category}
              name={category}
              type="number"
              min={0}
              step="0.01"
              disabled={disabled}
              value={value.prices[category]}
              onChange={(event) =>
                set({ prices: { ...value.prices, [category]: event.target.value } })
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}
