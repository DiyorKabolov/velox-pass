/**
 * Russian line-breaking rules for display type, applied with no-break spaces:
 * a one- or two-letter word ("с", "и", "на") travels with the word after it,
 * and a dash stays on the line of the word before it. Without them a heading
 * set this large strands a lone "С" or "И" at the end of a line, or opens one
 * with a dash.
 *
 * The short-word rule runs twice, because a run like "и в нём" overlaps itself
 * and a single pass binds only every other word.
 */
const SHORT_WORD = /(^|\s)(\p{L}{1,2})\s+/gu
const DASH = /\s+([—–])(?=\s)/g

export function typeset(text) {
  return String(text ?? '')
    .replace(SHORT_WORD, '$1$2 ')
    .replace(SHORT_WORD, '$1$2 ')
    .replace(DASH, ' $1')
}
