import { useEffect, useState } from 'react'

/** Up to two letters: the first of each of the first two words. */
function initialsOf(username) {
  const words = String(username ?? '').trim().split(/[\s._-]+/).filter(Boolean)
  if (!words.length) return '?'
  const letters = words.length > 1 ? words[0][0] + words[1][0] : words[0].slice(0, 2)
  return letters.toUpperCase()
}

/** A stable hue per name, so the same person keeps the same colour everywhere. */
function hueOf(username) {
  let hash = 0
  for (const char of String(username ?? '')) hash = (hash * 31 + char.codePointAt(0)) >>> 0
  return hash % 360
}

/**
 * A user's picture, or their initials on a colour of their own when there is
 * none -- or when the picture fails to load, which otherwise leaves a broken
 * image icon in its place.
 */
export default function Avatar({ username, src, size = 40, className = '' }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [src])

  const box = { width: size, height: size, fontSize: Math.round(size * 0.38) }

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={username ?? ''}
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full object-cover ${className}`}
        style={box}
      />
    )
  }

  return (
    <span
      aria-label={username}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-medium text-white ${className}`}
      style={{ ...box, background: `hsl(${hueOf(username)} 42% 40%)` }}
    >
      {initialsOf(username)}
    </span>
  )
}
