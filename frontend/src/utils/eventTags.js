/**
 * The tag vocabulary, mirroring backend/app/core/tags.py. The API rejects
 * anything outside it, so the two lists have to agree.
 */
export const EVENT_TAGS = [
  'кино',
  'опера',
  'театр',
  'концерт',
  'стендап',
  'митап',
  'выставка',
  'спорт',
  'фестиваль',
  'другое',
]

/**
 * A hue per tag, so a card's pills are recognisable at a glance and stable
 * between renders. Kept muted: they sit on the coloured ticket artwork and must
 * not fight the event's own accent.
 */
export const TAG_COLORS = {
  кино: '#7dd3fc',
  опера: '#f0abfc',
  театр: '#fca5a5',
  концерт: '#fcd34d',
  стендап: '#86efac',
  митап: '#a5b4fc',
  выставка: '#fdba74',
  спорт: '#67e8f9',
  фестиваль: '#f9a8d4',
  другое: '#cbd5e1',
}

export const tagColor = (tag) => TAG_COLORS[tag] ?? TAG_COLORS['другое']

/** Keep the vocabulary order whatever order the tags arrived in. */
export function orderTags(tags) {
  if (!Array.isArray(tags) || !tags.length) return []
  const chosen = new Set(tags)
  return EVENT_TAGS.filter((tag) => chosen.has(tag))
}
