import { fromDatetimeLocal } from '../../utils/dates'
import { emptyRule, expandRule, ruleToPayload, validateRule } from '../../utils/recurrence'
import { DEFAULT_COLORS } from './eventForm'

/**
 * The creation wizard's state, its checks and the requests it turns into.
 *
 * Kept apart from the component so what gets sent can be tested without
 * rendering anything, and so the three kinds of event cannot quietly drift into
 * building their requests three different ways.
 */

export const STEPS = ['Информация', 'Тип', 'Расписание', 'Подтверждение']

/**
 * - single: one date, no seat map. Price and capacity belong to the event.
 * - hall:   seats in a hall, one showing or a recurring series of them.
 * - series: repeats without a hall. There is nowhere to hang a showing without
 *           seats, so each date becomes an event of its own.
 */
export const KINDS = {
  single: { label: 'Разовое', icon: '📅', lines: ['Одна дата, одно место', 'Без схемы рассадки'] },
  hall: { label: 'С залом', icon: '🪑', lines: ['Выбор зала, схема мест', 'Покупка конкретного места'] },
  series: { label: 'Повторяющееся', icon: '🔄', lines: ['Несколько дат и времён', 'Как расписание кинотеатра'] },
}

export const CATEGORY_LABELS = { standard: 'Стандарт', vip: 'VIP', balcony: 'Балкон' }

export function emptyWizard() {
  return {
    title: '',
    description: '',
    tags: [],
    image_file: null,
    image_url: null,
    template_id: null,
    ...DEFAULT_COLORS,

    kind: null,
    venueId: '',

    // single and series
    date: '',
    location: '',
    capacity: 0,
    price: 0,

    // hall
    hallId: '',
    recurring: false,
    datetime: '',
    prices: { standard: 0, vip: 0, balcony: 0 },

    // hall with recurring on, and series
    rule: emptyRule(),
  }
}

const nonNegative = (value) => Number.isFinite(Number(value)) && Number(value) >= 0

/**
 * Every moment the wizard will create something at, in order.
 * One for a single event or a lone showing; the expanded rule otherwise.
 */
export function momentsOf(form) {
  if (form.kind === 'single') {
    const iso = fromDatetimeLocal(form.date)
    return iso ? [new Date(iso)] : []
  }
  if (form.kind === 'hall' && !form.recurring) {
    const iso = fromDatetimeLocal(form.datetime)
    return iso ? [new Date(iso)] : []
  }
  if (form.kind === 'hall' || form.kind === 'series') return expandRule(form.rule)
  return []
}

/**
 * The first problem with a step, in Russian, or null when it may be left.
 *
 * `ctx.venueRequired` is set when the caller has to name a venue: always for a
 * hall, and for anything a venue administrator with several venues creates.
 */
export function validateStep(step, form, ctx = {}) {
  if (step === 0) {
    if (!form.title.trim()) return 'Укажите название'
    return null
  }

  if (step === 1) {
    return form.kind ? null : 'Выберите тип мероприятия'
  }

  if (step === 2) {
    const needsVenue = form.kind === 'hall' || ctx.venueRequired
    if (needsVenue && !form.venueId) return 'Выберите площадку'

    if (form.kind === 'single') {
      if (!fromDatetimeLocal(form.date)) return 'Укажите дату и время'
      if (!nonNegative(form.capacity)) return 'Вместимость не может быть отрицательной'
      if (!nonNegative(form.price)) return 'Цена не может быть отрицательной'
      return null
    }

    if (form.kind === 'hall') {
      if (!form.hallId) return 'Выберите зал'
      if (form.recurring) {
        const problem = validateRule(form.rule)
        if (problem) return problem
      } else if (!fromDatetimeLocal(form.datetime)) {
        return 'Укажите дату и время сеанса'
      }
      const bad = Object.values(form.prices).some((price) => !nonNegative(price))
      return bad ? 'Цена не может быть отрицательной' : null
    }

    if (form.kind === 'series') {
      const problem = validateRule(form.rule)
      if (problem) return problem
      if (!nonNegative(form.capacity)) return 'Вместимость не может быть отрицательной'
      if (!nonNegative(form.price)) return 'Цена не может быть отрицательной'
      return null
    }

    return 'Выберите тип мероприятия'
  }

  return null
}

/** The first step that is not ready, or -1 when every one is. */
export function firstInvalidStep(form, ctx) {
  for (let step = 0; step < STEPS.length - 1; step += 1) {
    if (validateStep(step, form, ctx)) return step
  }
  return -1
}

/**
 * POST /admin/events for one event.
 *
 * `moment` is when this particular event takes place: the only date for a
 * single event, the first showing for a hall, one date of many for a series.
 * `venueName` fills in the location of a hall event, which has no address
 * field of its own -- the venue is where it is.
 */
export function eventPayload(form, moment, { venueName = null } = {}) {
  const seated = form.kind === 'hall'
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    date: moment.toISOString(),
    location: seated ? venueName : form.location.trim() || null,
    capacity: seated ? 0 : Number(form.capacity) || 0,
    price: seated ? 0 : Number(form.price) || 0,
    has_seats: seated,
    venue_id: form.venueId ? Number(form.venueId) : null,
    tags: form.tags,
    card_bg: form.card_bg,
    card_accent: form.card_accent,
    card_text: form.card_text,
  }
}

/**
 * POST /sessions for a hall event. Prices go out only for the categories the
 * hall actually has: a price for balcony seats in a hall without a balcony
 * would sit in the table pricing nothing.
 */
export function sessionsPayload(form, eventId, categories) {
  const prices = categories.map((category) => ({
    category,
    price: Number(form.prices[category]) || 0,
  }))
  const base = { event_id: eventId, hall_id: Number(form.hallId), prices }
  return form.recurring
    ? { ...base, is_recurring: true, recurring: ruleToPayload(form.rule) }
    : { ...base, datetime: fromDatetimeLocal(form.datetime) }
}

/**
 * Seats of a hall grouped by category, aisles left out.
 * Drives both which price fields are shown and the counts beside them.
 */
export function seatCategories(seats) {
  const counts = {}
  for (const seat of seats ?? []) {
    if (seat.is_aisle) continue
    counts[seat.category] = (counts[seat.category] ?? 0) + 1
  }
  // A stable order, whatever order the seats came in.
  return Object.keys(CATEGORY_LABELS)
    .filter((category) => counts[category])
    .map((category) => ({ category, count: counts[category] }))
}

/** Runs `task` over `items`, `limit` at a time, keeping each outcome. */
export async function inBatches(items, limit, task) {
  const results = new Array(items.length)
  let next = 0
  async function worker() {
    while (next < items.length) {
      const index = next
      next += 1
      try {
        results[index] = { ok: true, value: await task(items[index], index) }
      } catch (error) {
        results[index] = { ok: false, error }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
