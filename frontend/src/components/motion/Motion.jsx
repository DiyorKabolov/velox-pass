import { Children, Fragment, createContext, isValidElement, useContext, useLayoutEffect, useRef } from 'react'
import { typeset } from '../../utils/typography'

/**
 * The motion vocabulary of the site, in one place so every screen moves the
 * same way.
 *
 * Things arrive with a short rise and a fade on an expo-out curve: fast off the
 * mark, long settle. Nothing bounces and nothing loops.
 *
 * Arrivals are CSS keyframes (the .anim-* utilities in index.css), not
 * JavaScript. A keyframe animation needs nobody to report that it finished: it
 * holds the element on its first frame through the delay and lets go of it at
 * the end, whatever else happens on the page meanwhile. The JavaScript version
 * of this -- Framer Motion's presence bookkeeping -- could be left waiting on a
 * callback that never came, and the page with it.
 *
 * Framer Motion stays for what CSS cannot do: an underline that travels from
 * one tab to the next (layoutId), and things that animate on their way out
 * (modals, menus, the seat picker).
 */

export const EASE_OUT = [0.16, 1, 0.3, 1]
export const EASE_IN_OUT = [0.65, 0, 0.35, 1]

export const DURATION = {
  fast: 0.16,
  base: 0.28,
  slow: 0.6,
}

const ms = (seconds) => `${Math.round(seconds * 1000)}ms`

// Past this many, the rest of a list arrives together: a long list should not
// keep the reader waiting for its tail.
const MAX_STAGGERED = 8

// The moment, in seconds, a Reveal inside a Stagger is due; null outside one.
const StaggerSlot = createContext(null)

/**
 * Lines up the Reveals inside it: each starts `step` seconds after the one
 * before. The container itself does not move. Each child of the Stagger is one
 * step, whether it is a Reveal or a component that renders one.
 */
export function Stagger({ as: Tag = 'div', step = 0.06, delay = 0, className, children, ...props }) {
  let index = 0
  return (
    <Tag className={className} {...props}>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child
        const due = delay + step * Math.min(index++, MAX_STAGGERED)
        return <StaggerSlot.Provider value={due}>{child}</StaggerSlot.Provider>
      })}
    </Tag>
  )
}

/**
 * One block arriving: a rise of `distance` pixels and a fade. Inside a Stagger
 * it waits its turn; on its own it plays on mount, after `delay`.
 */
export function Reveal({ as: Tag = 'div', distance = 18, delay = 0, className = '', style, children, ...props }) {
  const due = (useContext(StaggerSlot) ?? 0) + delay
  return (
    <Tag
      className={`anim-rise ${className}`}
      style={{ '--rise': `${distance}px`, '--delay': ms(due), ...style }}
      {...props}
    >
      {/* What is inside a Reveal arrives with it, not on a turn of its own. */}
      <StaggerSlot.Provider value={null}>{children}</StaggerSlot.Provider>
    </Tag>
  )
}

/**
 * A headline whose words rise out of a slot one after another, the way the
 * letters of a departure board settle.
 *
 * Each word is masked on its own. The mask is padded above and below and the
 * padding is taken back with a negative margin: set solid in capitals, the
 * Cyrillic Д, Ц and Щ hang below the baseline and Й and Ё reach above the cap
 * height, and a mask cut to the line box would shave them off. The spaces sit
 * between the masks, not inside them: a space at the end of an inline-block is
 * dropped, and the line could not break there either.
 *
 * The words stay the heading's one and only text, spaces included, so it reads,
 * copies and is announced as the sentence it is -- no hidden second copy.
 */
export function WordsReveal({ text, as: Tag = 'span', delay = 0, step = 0.045, className = '' }) {
  // Split on ordinary spaces only: the no-break spaces typeset() puts in keep
  // a preposition and its word -- or a word and its dash -- in one slot.
  const set = typeset(text)
  const words = set.split(' ').filter(Boolean)

  return (
    <Tag className={className}>
      {words.map((word, index) => (
        <Fragment key={`${word}-${index}`}>
          <span
            className="inline-block overflow-hidden align-bottom"
            style={{ padding: '0.1em 0.02em 0.14em', margin: '-0.1em -0.02em -0.14em' }}
          >
            <span className="anim-word" style={{ '--delay': ms(delay + index * step) }}>
              {word}
            </span>
          </span>
          {index < words.length - 1 && ' '}
        </Fragment>
      ))}
    </Tag>
  )
}

const ruNumber = (n) => n.toLocaleString('ru-RU')

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Whether any of the element is on screen right now. */
function onScreen(element) {
  const box = element.getBoundingClientRect()
  return box.width > 0 && box.bottom > 0 && box.top < window.innerHeight
}

/**
 * Counts up from zero to its value -- once, when it first appears on screen --
 * and simply changes when the value does afterwards. A number mounted out of
 * sight, or with reduced motion asked for, is shown as it is: it never sits at
 * zero waiting for a scroll that may not come.
 */
function Counter({ value, format }) {
  const ref = useRef(null)
  const counted = useRef(false)
  // Held in a ref: an inline formatter is a new function on every render, and
  // as a dependency it would restart the count each time the parent rendered.
  const formatRef = useRef(format)
  formatRef.current = format

  // A layout effect, so the first number is in place before the first paint.
  // The text is written straight into the element rather than rendered: one
  // React render per frame for a counter would be absurd.
  useLayoutEffect(() => {
    const element = ref.current
    const show = (n) => {
      element.textContent = formatRef.current(n)
    }

    if (counted.current || prefersReducedMotion() || !onScreen(element)) {
      counted.current = true
      show(value)
      return undefined
    }

    // Whole numbers count in whole steps; money counts in kopecks.
    const round = Number.isInteger(value) ? Math.round : (n) => Math.round(n * 100) / 100
    const duration = Math.min(1200, 500 + Math.log10(Math.abs(value) + 1) * 250)
    const start = performance.now()
    let frame = 0
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration)
      show(round(value * (1 - (1 - progress) ** 4)))
      if (progress < 1) frame = requestAnimationFrame(tick)
      // Marked only once it is through: development mode mounts every
      // component twice, and a count cut short by that must run again.
      else counted.current = true
    }
    show(0)
    frame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(frame)
      show(value)
    }
  }, [value])

  return <span ref={ref} />
}

export function AnimatedNumber({ value, format = ruNumber, className = '' }) {
  const numeric = typeof value === 'number' && Number.isFinite(value)
  return (
    <span className={`t-num ${className}`}>
      {numeric ? <Counter value={value} format={format} /> : value}
    </span>
  )
}
