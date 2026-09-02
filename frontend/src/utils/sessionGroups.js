import { pluralize } from './plural'

/**
 * Sessions arranged so a series reads as one thing.
 *
 * A recurring creation leaves its mark as a shared recurring_group_id; every
 * showing carrying the same one belongs together and is cancelled together.
 * Everything else stands alone.
 */
export function groupSessions(sessions) {
  const blocks = []
  const series = new Map()

  for (const session of sessions ?? []) {
    const groupId = session.recurring_group_id
    if (!groupId) {
      blocks.push({ kind: 'single', key: `s${session.id}`, sessions: [session] })
      continue
    }
    if (!series.has(groupId)) {
      const block = { kind: 'series', key: `g${groupId}`, groupId, sessions: [] }
      series.set(groupId, block)
      blocks.push(block)
    }
    series.get(groupId).sessions.push(session)
  }

  for (const block of blocks) {
    block.sessions.sort((a, b) => new Date(a.datetime) - new Date(b.datetime))
  }
  // Chronological by when each block first happens, so a series takes the place
  // its opening showing would have held.
  blocks.sort((a, b) => new Date(a.sessions[0].datetime) - new Date(b.sessions[0].datetime))
  return blocks
}

/** What the create call reports back, said to a person. */
export function creationMessage(result) {
  if (!result?.created) return 'Сеанс создан'
  const created = `Создано ${pluralize(result.created, 'сеанс', 'сеанса', 'сеансов')}`
  return result.skipped
    ? `${created}, пропущено ${result.skipped} — зал уже занят`
    : created
}
