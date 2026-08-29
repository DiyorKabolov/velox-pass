import { useEffect, useState } from 'react'

/**
 * The value as it was `delay` ms ago, held steady while it keeps changing.
 * Typing in the search box re-renders the whole listing, so the filtering runs
 * once the typist pauses rather than on every keystroke.
 */
export default function useDebouncedValue(value, delay = 300) {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return settled
}
