import { useEffect, useLayoutEffect } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

/**
 * Fades each page in as it arrives and puts the scroll where that page
 * expects it.
 *
 * The old page is gone at once; only the new one animates. A cross-fade would
 * have to keep the old page mounted until its exit finished, and that is a
 * promise the router has to wait on -- the version of this that did so could
 * be left waiting for good, with nothing under the header until a reload.
 * The fade is a CSS animation on a freshly keyed element (.anim-page), so
 * there is nothing for anything to wait on.
 *
 * Only opacity moves at this level. A transform on a wrapper this high up
 * would become the containing block of every `position: fixed` element inside
 * a page -- the scanner is one -- and pin it to the wrapper instead of the
 * viewport for as long as the animation ran. The rise each page makes as it
 * arrives is the page's own business (see components/motion).
 */

// How far down each history entry was scrolled, so Back lands where you were.
const scrollByEntry = new Map()

const ADMIN_TABS = /^\/admin(\/(events|venues|users|tickets|pdf-templates|sessions))?\/?$/

/**
 * The admin tabs are separate addresses but one screen -- the same header and
 * tab strip above a different table -- so moving between them is not treated
 * as leaving the page.
 */
export function screenOf(pathname) {
  return ADMIN_TABS.test(pathname) ? '/admin' : pathname
}

/**
 * Sets the scroll as the page mounts. A layout effect, so it runs once the
 * page's DOM is in and before the first paint: restoring earlier -- when the
 * old page has gone and the new one is not there yet -- lets the browser clamp
 * the position to a document that is momentarily only a header tall.
 */
function PlaceScroll({ entry, restore }) {
  useLayoutEffect(() => {
    const saved = restore ? scrollByEntry.get(entry) : 0
    window.scrollTo(0, saved ?? 0)
    // Once per page: the entry and how it was reached are fixed for its life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

export default function RouteTransition({ children }) {
  const location = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    if ('scrollRestoration' in window.history) window.history.scrollRestoration = 'manual'
  }, [])

  useEffect(() => {
    const entry = location.key
    const remember = () => scrollByEntry.set(entry, window.scrollY)
    window.addEventListener('scroll', remember, { passive: true })
    return () => window.removeEventListener('scroll', remember)
  }, [location.key])

  return (
    <div key={screenOf(location.pathname)} className="anim-page">
      <PlaceScroll entry={location.key} restore={navigationType === 'POP'} />
      {children(location)}
    </div>
  )
}
