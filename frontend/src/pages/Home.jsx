import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw, Search } from 'lucide-react'
import { useEvents } from '../hooks/useEvents'
import useDebouncedValue from '../hooks/useDebouncedValue'
import EventCard from '../components/events/EventCard'
import Select from '../components/ui/Select'
import { EVENT_TAGS, tagColor } from '../utils/eventTags'
import {
  applyFilters,
  DATE_OPTIONS,
  DEFAULTS,
  isFiltered,
  SORT_OPTIONS,
  STATUS_OPTIONS,
} from '../utils/eventFilters'

/** One compact row of mutually exclusive choices. */
function PillGroup({ label, options, value, onChange }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-1"
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={[
              'whitespace-nowrap rounded-[6px] px-3 py-1.5 text-xs transition-all duration-150',
              'active:scale-[0.95]',
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
  )
}

export default function Home() {
  const { data: events, isLoading, isError } = useEvents()

  const [query, setQuery] = useState(DEFAULTS.query)
  const [date, setDate] = useState(DEFAULTS.date)
  const [status, setStatus] = useState(DEFAULTS.status)
  const [sort, setSort] = useState(DEFAULTS.sort)
  const [tags, setTags] = useState(DEFAULTS.tags)

  const toggleTag = (tag) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    )

  // The box updates instantly; the list waits for a pause in the typing.
  const settledQuery = useDebouncedValue(query, 300)

  const filters = { query: settledQuery, date, status, sort, tags }
  const filtered = useMemo(
    () => applyFilters(events, filters),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [events, settledQuery, date, status, sort, tags],
  )

  // Only tags something in the catalogue actually carries: offering a tag that
  // can only ever return nothing is a dead end.
  const availableTags = useMemo(() => {
    const used = new Set((events ?? []).flatMap((event) => event.tags ?? []))
    return EVENT_TAGS.filter((tag) => used.has(tag))
  }, [events])

  // Reads the box, not the debounced copy, so the reset link appears as soon as
  // a character is typed rather than 300ms later.
  const dirty = isFiltered({ query, date, status, sort, tags })

  const reset = () => {
    setQuery(DEFAULTS.query)
    setDate(DEFAULTS.date)
    setStatus(DEFAULTS.status)
    setSort(DEFAULTS.sort)
    setTags(DEFAULTS.tags)
  }

  const ready = !isLoading && !isError
  const hasEvents = (events?.length ?? 0) > 0

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <header className="mb-10 text-center">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.28em] text-[var(--muted2)]">
          В продаже
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">Афиша</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-[var(--muted)]">
          Выберите мероприятие, место и получите QR-билет мгновенно.
        </p>
      </header>

      {/* Hidden until there is actually something to narrow down. */}
      {ready && hasEvents && (
        <div className="mb-10 flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="relative min-w-[220px] flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted2)]"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск мероприятий..."
              aria-label="Поиск мероприятий"
              className="w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] py-2.5 pl-10 pr-3.5 text-sm text-[var(--text)] outline-none transition-all duration-150 placeholder:text-[var(--muted2)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25"
            />
          </div>

          <PillGroup
            label="Период"
            options={DATE_OPTIONS}
            value={date}
            onChange={setDate}
          />
          <PillGroup
            label="Статус"
            options={STATUS_OPTIONS}
            value={status}
            onChange={setStatus}
          />

          <Select
            value={sort}
            onChange={setSort}
            aria-label="Сортировка"
            className="!w-auto min-w-[210px] !py-2 !text-xs"
            options={SORT_OPTIONS}
          />

          {dirty && (
            <button
              type="button"
              onClick={reset}
              data-reset
              className="flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] px-2.5 py-2 text-xs text-[var(--muted)] transition-colors duration-150 hover:text-[var(--text)] active:scale-[0.95]"
            >
              <RotateCcw size={13} />
              Сбросить
            </button>
          )}
        </div>
      )}

      {ready && hasEvents && availableTags.length > 0 && (
        <div className="mb-10 flex flex-wrap items-center gap-2">
          {availableTags.map((tag) => {
            const on = tags.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => toggleTag(tag)}
                className={[
                  'rounded-full border px-3 py-1.5 text-xs transition-all duration-150',
                  'active:scale-[0.95]',
                  on ? 'font-medium' : 'text-[var(--muted)] hover:text-[var(--text)]',
                ].join(' ')}
                style={
                  on
                    ? {
                        borderColor: tagColor(tag),
                        background: `${tagColor(tag)}22`,
                        color: tagColor(tag),
                      }
                    : { borderColor: 'var(--border)' }
                }
              >
                {tag}
              </button>
            )
          })}
        </div>
      )}

      {isLoading && (
        <div className="flex flex-wrap justify-center gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[258px] w-full max-w-[320px] animate-pulse rounded-[var(--radius)] bg-[var(--surface)]"
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-center text-sm text-[var(--err)]">
          Не удалось загрузить афишу. Сервер запущен?
        </p>
      )}

      {/* Nothing published yet -- not the same as nothing matching. */}
      {ready && !hasEvents && (
        <p className="text-center text-sm text-[var(--muted)]">
          Мероприятий пока нет. Следите за обновлениями.
        </p>
      )}

      {ready && hasEvents && filtered.length === 0 && (
        <div className="py-10 text-center">
          <p className="font-display text-lg">Ничего не найдено</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Попробуйте изменить фильтры</p>
          <button
            type="button"
            onClick={reset}
            className="mt-5 rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg)] transition-all duration-150 hover:brightness-110 active:scale-[0.96]"
          >
            Сбросить фильтры
          </button>
        </div>
      )}

      <motion.div
        className="flex flex-wrap justify-center gap-6"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
      >
        {filtered.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </motion.div>
    </div>
  )
}
