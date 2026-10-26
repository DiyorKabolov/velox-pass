import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { RotateCcw, Search } from 'lucide-react'
import { useEvents } from '../hooks/useEvents'
import useDebouncedValue from '../hooks/useDebouncedValue'
import EventCard from '../components/events/EventCard'
import Button from '../components/ui/Button'
import Select from '../components/ui/Select'
import { CONTAINER, EmptyState, PageHeader, SectionHead } from '../components/ui/Page'
import { Reveal } from '../components/motion/Motion'
import { EVENT_TAGS } from '../utils/eventTags'
import { isEventOver } from '../utils/eventState'
import { pluralize } from '../utils/plural'
import {
  applyFilters,
  DATE_OPTIONS,
  DEFAULTS,
  isFiltered,
  SORT_OPTIONS,
  STATUS_OPTIONS,
} from '../utils/eventFilters'

const SPRING = { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 }

/**
 * One row of mutually exclusive choices, set as words. The chosen one is
 * underlined, and the underline slides to whatever is chosen next.
 */
function TextChoice({ id, label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex items-baseline gap-4">
      <span className="t-label w-[52px] shrink-0">{label}</span>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={[
                'relative whitespace-nowrap pb-1.5 text-[14px] transition-colors duration-200',
                active ? 'text-[var(--text)]' : 'text-[var(--muted)] hover:text-[var(--text)]',
              ].join(' ')}
            >
              {option.label}
              {active && (
                <motion.span
                  layoutId={`filter-${id}`}
                  transition={SPRING}
                  className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--accent)]"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Posters in a grid, dealt in one after another. The page keys the grid by
 * its filters, so a new choice deals a fresh hand rather than shuffling the
 * old one: cards sliding across each other to new places read as noise, and
 * the bookkeeping behind that sliding is what used to leave the page blank.
 */
function PosterGrid({ events }) {
  return (
    <ul className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
      {events.map((event, index) => (
        <li
          key={event.id}
          className="anim-rise"
          style={{ '--rise': '28px', '--delay': `${120 + Math.min(index, 8) * 60}ms` }}
        >
          <EventCard event={event} />
        </li>
      ))}
    </ul>
  )
}

/** The shape of the listing while it loads: posters and the lines under them. */
function PosterSkeletons() {
  return (
    <div className="mt-12 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:gap-x-8">
      {Array.from({ length: 6 }).map((_, index) => {
        const breathe = { animationDelay: `${index * 90}ms` }
        return (
          <div key={index} aria-hidden>
            <div style={breathe} className="skeleton aspect-[4/5] rounded-[4px]" />
            <div style={breathe} className="skeleton mt-4 h-[21px] w-1/2 rounded-[2px]" />
            <div style={breathe} className="skeleton mt-2.5 h-3.5 w-3/4 rounded-[2px]" />
          </div>
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
  // Names the current choice of filters: the grids are keyed by it, so each
  // new choice deals its posters afresh.
  const hand = JSON.stringify(filters)
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

  // What is still ahead reads first; what has passed is kept, but below it and
  // greyed out. Each half keeps the order the sort gave it.
  const upcoming = filtered.filter((event) => !isEventOver(event))
  const finished = filtered.filter((event) => isEventOver(event))

  const count = ready && hasEvents
    ? dirty
      ? `${filtered.length} из ${pluralize(events.length, 'события', 'событий', 'событий')}`
      : pluralize(events.length, 'событие', 'события', 'событий')
    : null

  return (
    <div className={`${CONTAINER} pt-10 sm:pt-14`}>
      <PageHeader
        title="Афиша"
        meta={count && <span className="t-num">{count}</span>}
        lead="Кино, спектакли и концерты. Место выбираете на схеме зала, билет с QR-кодом приходит сразу."
      />

      {/* Hidden until there is actually something to narrow down. */}
      {ready && hasEvents && (
        <Reveal delay={0.22} distance={10} className="mt-8 space-y-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <label className="flex min-w-[240px] flex-1 items-center gap-3 border-b border-[var(--border2)] transition-colors duration-200 focus-within:border-[var(--accent)]">
              <Search size={18} strokeWidth={1.75} className="shrink-0 text-[var(--muted)]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Найти по названию или месту"
                aria-label="Поиск мероприятий"
                className="h-12 w-full bg-transparent text-[17px] text-[var(--text)] outline-none placeholder:text-[var(--muted2)]"
              />
            </label>

            <div className="flex items-center gap-3">
              <span className="t-label">Порядок</span>
              <Select
                value={sort}
                onChange={setSort}
                aria-label="Сортировка"
                className="!w-[230px] !py-2 !text-[14px]"
                options={SORT_OPTIONS}
              />
            </div>

            {dirty && (
              <button
                type="button"
                onClick={reset}
                data-reset
                className="flex shrink-0 items-center gap-1.5 text-[14px] text-[var(--muted)] transition-colors duration-200 hover:text-[var(--text)]"
              >
                <RotateCcw size={14} strokeWidth={1.75} />
                Сбросить
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-baseline gap-x-12 gap-y-4">
            <TextChoice
              id="date"
              label="Когда"
              options={DATE_OPTIONS}
              value={date}
              onChange={setDate}
            />
            <TextChoice
              id="status"
              label="Статус"
              options={STATUS_OPTIONS}
              value={status}
              onChange={setStatus}
            />
          </div>

          {availableTags.length > 0 && (
            <div role="group" aria-label="Жанр" className="flex items-baseline gap-4">
              <span className="t-label w-[52px] shrink-0">Жанр</span>
              <div className="flex flex-wrap items-baseline gap-y-2">
                {availableTags.map((tag, index) => {
                  const on = tags.includes(tag)
                  // The slash rides on the end of the tag before it, so a
                  // wrapped line ends with one rather than starting with it.
                  return (
                    <span key={tag} className="inline-flex items-baseline">
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleTag(tag)}
                        className={[
                          'pb-1 text-[14px] decoration-[var(--accent)] decoration-2 underline-offset-[6px] transition-colors duration-200',
                          on
                            ? 'text-[var(--text)] underline'
                            : 'text-[var(--muted)] hover:text-[var(--text)]',
                        ].join(' ')}
                      >
                        {tag}
                      </button>
                      {index < availableTags.length - 1 && (
                        <span aria-hidden className="px-2.5 text-[var(--border2)]">
                          /
                        </span>
                      )}
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </Reveal>
      )}

      {isLoading && <PosterSkeletons />}

      {isError && (
        <EmptyState className="mt-12" title="Афиша не загрузилась">
          Не удалось загрузить афишу. Сервер запущен?
        </EmptyState>
      )}

      {/* Nothing published yet -- not the same as nothing matching. */}
      {ready && !hasEvents && (
        <EmptyState className="mt-12" title="Мероприятий пока нет">
          Следите за обновлениями.
        </EmptyState>
      )}

      {ready && hasEvents && filtered.length === 0 && (
        <EmptyState
          className="mt-12"
          title="Ничего не найдено"
          action={
            <Button variant="ghost" onClick={reset}>
              Сбросить фильтры
            </Button>
          }
        >
          Попробуйте изменить фильтры
        </EmptyState>
      )}

      {ready && filtered.length > 0 && (
        <>
          {(upcoming.length > 0 || status !== 'finished') && (
            <section className="mt-14">
              <SectionHead
                title="Ближайшие"
                aside={
                  upcoming.length > 0 &&
                  pluralize(upcoming.length, 'событие', 'события', 'событий')
                }
              />
              {upcoming.length > 0 ? (
                <PosterGrid key={hand} events={upcoming} />
              ) : (
                <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-[var(--muted)]">
                  Ближайших событий нет — новые появятся здесь, как только откроется
                  продажа.
                </p>
              )}
            </section>
          )}

          {finished.length > 0 && (
            <section className="mt-20">
              <SectionHead
                title="Прошедшие"
                aside={pluralize(finished.length, 'событие', 'события', 'событий')}
              />
              <PosterGrid key={hand} events={finished} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
