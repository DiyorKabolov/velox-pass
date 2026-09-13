import { fromDatetimeLocal } from '../../utils/dates'
import { emptyRule, ruleToPayload, validateRule } from '../../utils/recurrence'

export const PRICE_CATEGORIES = ['standard', 'vip', 'balcony']

export const CATEGORY_LABELS = {
  standard: 'Стандарт',
  vip: 'VIP',
  balcony: 'Балкон',
}

/**
 * The shape the session fields work on, shared by the dialog and by the block
 * on the new-event page so both build the same request.
 */
export function emptySessionForm(overrides = {}) {
  return {
    mode: 'single',
    eventId: '',
    venueId: '',
    hallId: '',
    datetime: '',
    rule: emptyRule(),
    prices: { standard: 25, vip: 60, balcony: 15 },
    ...overrides,
  }
}

/** Has anything been filled in? Used where the block is optional. */
export function sessionFormTouched(form) {
  if (!form) return false
  return Boolean(form.hallId || form.datetime || form.mode === 'series')
}

/** The first problem in Russian, or null when the form is ready to send. */
export function validateSessionForm(form, { requireEvent = true } = {}) {
  if (requireEvent && !form.eventId) return 'Выберите мероприятие'
  if (!form.hallId) return 'Выберите зал'
  if (form.mode === 'series') return validateRule(form.rule)
  if (!fromDatetimeLocal(form.datetime)) return 'Укажите дату и время сеанса'
  return null
}

/**
 * The POST /sessions body. `eventId` is passed in rather than read from the
 * form because on the new-event page it only exists once the event is saved.
 */
export function sessionPayload(form, eventId) {
  const prices = PRICE_CATEGORIES.map((category) => ({
    category,
    price: Number(form.prices[category]) || 0,
  }))

  const base = { event_id: Number(eventId), hall_id: Number(form.hallId), prices }

  return form.mode === 'series'
    ? { ...base, is_recurring: true, recurring: ruleToPayload(form.rule) }
    : { ...base, datetime: fromDatetimeLocal(form.datetime) }
}
