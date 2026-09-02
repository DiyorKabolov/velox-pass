/**
 * Keeps one row of a list open at a time, and keeps them from moving together.
 *
 * The rule the list follows: entering a row while another is open collapses
 * that one first and starts this one only once it has finished, so there is
 * never a card opening while another is closing. Leaving the list altogether
 * closes after a short delay, which is what stops the panel flickering shut as
 * the pointer crosses the gap between two rows.
 *
 * Plain object rather than a hook so the sequencing can be exercised on a fake
 * clock: it is all timing, and timing is exactly what a render test cannot see.
 * `timers` exists for that, and for nothing else.
 */
export function createHoverSequence({
  onChange,
  collapseDelay = 200,
  transitionMs = 300,
  // Wrapped, not handed over directly: stored as properties, setTimeout and
  // clearTimeout would be called with `timers` as their receiver, and in a
  // browser they are Window methods that refuse any receiver but the global --
  // "Illegal invocation". In Node they are ordinary functions, which is why
  // only a browser ever saw it.
  timers = {
    set: (fn, delay) => setTimeout(fn, delay),
    clear: (id) => clearTimeout(id),
  },
}) {
  let open = null
  // The row the pointer is on right now, which is not the row that is open:
  // between the two there is a whole collapse to sit through.
  let hovered = null
  let closeTimer = null
  // Non-null exactly while a collapse is running and an open is queued behind
  // it. Nothing may open while this is set.
  let openTimer = null

  const show = (id) => {
    if (open === id) return
    open = id
    onChange(id)
  }

  const clearOpen = () => {
    timers.clear(openTimer)
    openTimer = null
  }

  return {
    enter(id) {
      timers.clear(closeTimer)
      closeTimer = null
      hovered = id

      if (open === id) return

      // A collapse is already under way. Do not restart it and do not open
      // anything now -- the queued job below opens whichever row the pointer
      // has settled on by the time the collapse finishes. Without this, running
      // the pointer across a middle row would open the third one on top of the
      // first one's collapse, which is the very thing being avoided.
      if (openTimer !== null) return

      if (open === null) {
        show(id)
        return
      }

      // Somebody else is open. Collapse it now -- not after the leave delay,
      // which would leave both cards on screen -- and queue the next one.
      show(null)
      openTimer = timers.set(() => {
        openTimer = null
        // Abandoned if the pointer has left the list in the meantime.
        if (hovered !== null) show(hovered)
      }, transitionMs)
    },

    leave(id) {
      if (hovered === id) hovered = null
      timers.clear(closeTimer)
      closeTimer = timers.set(() => {
        closeTimer = null
        // Only when the pointer really did leave the list: landing on another
        // row is enter()'s business, and it closes this one itself.
        if (hovered === null) show(null)
      }, collapseDelay)
    },

    dispose() {
      timers.clear(closeTimer)
      closeTimer = null
      clearOpen()
    },
  }
}
