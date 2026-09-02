import { Plus, X } from 'lucide-react'
import Button from '../ui/Button'
import Input from '../ui/Input'
import { formatDateTime } from '../../utils/dates'
import { pluralize } from '../../utils/plural'
import { expandRule, MAX_SESSIONS, validateRule, WEEKDAYS } from '../../utils/recurrence'

/** Section caption, matching the labels the form controls carry. */
function Caption({ children }) {
  return (
    <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
      {children}
    </span>
  )
}

/**
 * The recurrence rule: which days, at what times, over what stretch.
 *
 * Holds no state of its own — the parent owns the rule, because it is the
 * parent that submits it. What this does own is the preview, which is computed
 * from the rule with the same walk the backend performs, so the number shown
 * here is the number that gets created.
 */
export default function RecurrenceEditor({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch })

  const toggleDay = (day) =>
    set({
      days: value.days.includes(day)
        ? value.days.filter((item) => item !== day)
        : [...value.days, day],
    })

  const setTime = (index, time) =>
    set({ times: value.times.map((item, i) => (i === index ? time : item)) })

  const removeTime = (index) =>
    set({ times: value.times.filter((_, i) => i !== index) })

  const moments = expandRule(value)
  const problem = validateRule(value)
  const overflow = moments.length > MAX_SESSIONS

  return (
    <div className="space-y-5">
      <div>
        <Caption>Дни недели</Caption>
        <div role="group" aria-label="Дни недели" className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => {
            const active = value.days.includes(day.value)
            return (
              <button
                key={day.value}
                type="button"
                aria-pressed={active}
                aria-label={day.long}
                onClick={() => toggleDay(day.value)}
                className={[
                  'w-11 rounded-[var(--radius-sm)] border py-2 text-xs transition-all duration-150',
                  'active:scale-[0.94]',
                  active
                    ? 'border-[var(--accent)] bg-[var(--accent)] font-medium text-[var(--bg)]'
                    : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--border2)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                {day.short}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <Caption>Время сеансов</Caption>
        <div className="flex flex-wrap items-center gap-2">
          {value.times.map((time, index) => (
            // Index as key: the inputs are positional and a time may repeat
            // while it is being typed, so the value cannot identify a row.
            // eslint-disable-next-line react/no-array-index-key
            <div key={index} className="flex items-center gap-1">
              <input
                type="time"
                value={time}
                aria-label={`Время ${index + 1}`}
                onChange={(event) => setTime(index, event.target.value)}
                className="w-[104px] rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-2 text-sm text-[var(--text)] outline-none transition-all duration-150 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25"
              />
              <button
                type="button"
                onClick={() => removeTime(index)}
                aria-label={`Убрать время ${time || index + 1}`}
                // The last one stays: a rule with no times describes nothing,
                // and an empty row is easier to fill than to conjure back.
                disabled={value.times.length === 1}
                className="rounded-[var(--radius-sm)] p-1.5 text-[var(--muted2)] transition-colors hover:text-[var(--err)] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => set({ times: [...value.times, ''] })}
          >
            <Plus size={13} />
            Добавить время
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Начало"
          name="recurring-start"
          type="date"
          value={value.startDate}
          onChange={(event) => set({ startDate: event.target.value })}
        />

        <div>
          <Caption>Окончание</Caption>
          <div
            role="radiogroup"
            aria-label="Как заканчивается серия"
            className="flex gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] p-1"
          >
            {[
              { key: 'date', label: 'По дате' },
              { key: 'count', label: 'Количество раз' },
            ].map((option) => {
              const active = value.endType === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => set({ endType: option.key })}
                  className={[
                    'flex-1 whitespace-nowrap rounded-[6px] px-2 py-1.5 text-xs transition-all duration-150',
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

          <div className="mt-2">
            {value.endType === 'date' ? (
              <Input
                name="recurring-end-date"
                type="date"
                aria-label="Дата окончания"
                value={value.endDate}
                onChange={(event) => set({ endDate: event.target.value })}
              />
            ) : (
              <Input
                name="recurring-end-count"
                type="number"
                min={1}
                max={MAX_SESSIONS}
                aria-label="Количество сеансов"
                value={value.endCount}
                onChange={(event) => set({ endCount: event.target.value })}
              />
            )}
          </div>
        </div>
      </div>

      {/* What the rule actually comes to. Shown before anything is created, so
          a slip in the days or the range is caught here rather than as 200
          sessions in the list. */}
      <div className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] p-3.5">
        {problem ? (
          <p className="text-sm text-[var(--muted)]">
            {overflow ? (
              <span className="text-[var(--err)]">{problem}</span>
            ) : (
              problem
            )}
          </p>
        ) : (
          <>
            <p className="text-sm text-[var(--text)]">
              Будет создано {pluralize(moments.length, 'сеанс', 'сеанса', 'сеансов')}
            </p>
            <ul className="mt-2 space-y-0.5 font-mono2 text-xs text-[var(--muted)]">
              {moments.slice(0, 5).map((moment) => (
                <li key={moment.getTime()}>{formatDateTime(moment)}</li>
              ))}
              {moments.length > 5 && (
                <li className="text-[var(--muted2)]">
                  …и ещё {moments.length - 5}
                </li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
