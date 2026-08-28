import { fromDatetimeLocal, toDatetimeLocal } from '../../utils/dates'

export const DEFAULT_COLORS = {
  card_bg: '#fdfdf5',
  card_accent: '#a898e0',
  card_text: '#2a2a2a',
}

export const COLOR_PRESETS = [
  { name: 'Сиреневый', card_bg: '#fdfdf5', card_accent: '#a898e0', card_text: '#2a2a2a' },
  { name: 'Изумруд', card_bg: '#f4f7f2', card_accent: '#5fa86b', card_text: '#1f2a20' },
  { name: 'Красный', card_bg: '#fdf3f2', card_accent: '#d1544c', card_text: '#2e1f1e' },
  { name: 'Синий', card_bg: '#eef2f8', card_accent: '#4a6fa5', card_text: '#1e2733' },
  { name: 'Золото', card_bg: '#fbf3e8', card_accent: '#e08a4c', card_text: '#33241a' },
  { name: 'Моно', card_bg: '#f2f2f2', card_accent: '#4a4a4a', card_text: '#1f1f1f' },
]

export const EMPTY_EVENT = {
  title: '',
  description: '',
  date: '',
  location: '',
  capacity: 0,
  has_seats: false,
  ...DEFAULT_COLORS,
}

/** API event -> form state (dates become datetime-local strings). */
export function toFormValue(event) {
  if (!event) return { ...EMPTY_EVENT }
  return {
    title: event.title ?? '',
    description: event.description ?? '',
    date: toDatetimeLocal(event.date),
    location: event.location ?? '',
    capacity: event.capacity ?? 0,
    has_seats: Boolean(event.has_seats),
    card_bg: event.card_bg || DEFAULT_COLORS.card_bg,
    card_accent: event.card_accent || DEFAULT_COLORS.card_accent,
    card_text: event.card_text || DEFAULT_COLORS.card_text,
  }
}

/** Form state -> API payload. */
export function toPayload(form) {
  return {
    title: form.title.trim(),
    description: form.description.trim() || null,
    date: fromDatetimeLocal(form.date),
    location: form.location.trim() || null,
    capacity: Number(form.capacity) || 0,
    has_seats: Boolean(form.has_seats),
    card_bg: form.card_bg,
    card_accent: form.card_accent,
    card_text: form.card_text,
  }
}

/** Returns a message when the form cannot be submitted yet. */
export function validate(form) {
  if (!form.title.trim()) return 'Укажите название'
  if (!form.date) return 'Укажите дату'
  if (!fromDatetimeLocal(form.date)) return 'Некорректная дата'
  if (Number(form.capacity) < 0) return 'Вместимость не может быть отрицательной'
  return null
}

const HEX = /^#[0-9a-fA-F]{6}$/

export function normaliseHex(value, fallback) {
  const trimmed = String(value || '').trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  return HEX.test(withHash) ? withHash.toLowerCase() : fallback
}
