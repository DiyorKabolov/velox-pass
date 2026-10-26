/**
 * Where to send someone once they have signed in: back to the page that sent
 * them to the login screen.
 *
 * In-app links hand the path over in the router state (`state.from`); a full
 * reload to /login -- the API client does one when a token expires -- can only
 * carry it in the address, as `?next=`. Either way the value is checked before
 * it is followed: `next` comes from a URL anyone can write, and anything but a
 * path on this site would turn the login page into an open redirect.
 */

// A path on this site: one leading slash, not two -- and no backslash or
// control character, which browsers quietly turn into a second slash
// ("/\evil.com", "/<tab>/evil.com" both mean //evil.com).
// eslint-disable-next-line no-control-regex
const LOCAL_PATH = /^\/(?![/\\])[^\\\u0000-\u001F\u007F]*$/

// Pointless or circular destinations after signing in.
const AUTH_SCREENS = /^\/(login|register|confirm)(?:[/?#]|$)/

export function returnPath(location, fallback = '/') {
  const candidates = [location?.state?.from, new URLSearchParams(location?.search ?? '').get('next')]
  const target = candidates.find(
    (path) => typeof path === 'string' && LOCAL_PATH.test(path) && !AUTH_SCREENS.test(path),
  )
  return target ?? fallback
}

/** The current page as a `from` for the login screen: path and query both. */
export const hereOf = (location) => `${location.pathname}${location.search ?? ''}`
