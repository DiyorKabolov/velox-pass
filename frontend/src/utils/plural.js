/**
 * Russian plural form for a count: plural(5, 'билет', 'билета', 'билетов').
 *
 * The rules are 1 / 2-4 / rest, with the teens (11-14) always taking the
 * "many" form, which is why the check on the last two digits comes first.
 */
export function plural(count, one, few, many) {
  const n = Math.abs(Number(count) || 0)
  const lastTwo = n % 100
  if (lastTwo >= 11 && lastTwo <= 14) return many
  const last = n % 10
  if (last === 1) return one
  if (last >= 2 && last <= 4) return few
  return many
}

/** Same, but returns the number together with the word. */
export function pluralize(count, one, few, many) {
  return `${count} ${plural(count, one, few, many)}`
}
