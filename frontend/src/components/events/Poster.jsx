import { getCardColors, inkFor, withAlpha } from '../../utils/colors'
import { orderTags } from '../../utils/eventTags'
import { typeset } from '../../utils/typography'

/**
 * An event as a printed playbill.
 *
 * Most events arrive without artwork, so the poster is typeset from the event
 * itself rather than left as an empty frame: the field is the event's own
 * accent and the title is set in black condensed capitals as large as the
 * longest word allows. With artwork, the picture takes the field and the type
 * sits on a scrim at its foot.
 *
 * The poster is only the picture. When and where are set beside it, in the
 * page's own type (see EventCard), not printed onto it: a field of colour is
 * for the name, and small print on it is hard to read and fights the title.
 *
 * Every size is in container units (cqw), so the same poster scales from a
 * grid cell to the hero of the event page without a second layout.
 */

/**
 * How large the title may be, in cqw. The longest word has to fit across the
 * poster on its own line -- capitals in this face run about half an em wide at
 * worst (Ш, Ж, Ю) -- and a long title is held to about four lines.
 */
function titleSize(title) {
  const text = String(title ?? '')
  const longest = Math.max(1, ...text.split(/\s+/).map((word) => word.length))
  const byWord = 86 / (longest * 0.5)
  const byLength = 400 / Math.max(text.length, 1)
  return Math.max(8, Math.min(25, byWord, byLength))
}

/** A rubber stamp across the corner: "ЗАВЕРШЕНО", "МЕСТ НЕТ". */
function Stamp({ children, color }) {
  return (
    <span
      className="t-poster absolute right-[5cqw] top-[5cqw] z-[2] rotate-[-7deg] border-2 px-[1.6cqw] pb-[0.5cqw] pt-[0.9cqw] leading-none"
      style={{ color, borderColor: color, fontSize: 'max(11px, 4.6cqw)' }}
    >
      {children}
    </span>
  )
}

export default function Poster({
  event,
  stamp = null,
  past = false,
  // Inside a link with the `group` class: pointing at the link slowly pushes
  // into the artwork.
  interactive = false,
  className = '',
}) {
  const colors = getCardColors(event)
  const tags = orderTags(event?.tags)
  const title = event?.title || 'Без названия'
  const hasArt = Boolean(event?.image_url)

  // On a colour field the ink is chosen against that field; over a photograph
  // it is always paper, on the scrim.
  const ink = hasArt ? '#fbf8f1' : inkFor(colors.accent)

  return (
    <div className={`relative select-none ${className}`} style={{ containerType: 'inline-size' }}>
      <div
        className="relative aspect-[4/5] overflow-hidden rounded-[4px]"
        style={{
          background: colors.accent,
          color: ink,
          // A finished event keeps a memory of its colour but steps back:
          // mostly drained of it.
          filter: past ? 'grayscale(0.8) contrast(0.95)' : undefined,
        }}
      >
        {hasArt && (
          <>
            <img
              src={event.image_url}
              alt=""
              loading="lazy"
              draggable={false}
              className={`absolute inset-0 h-full w-full object-cover ${
                interactive
                  ? 'transition-transform duration-[900ms] ease-out group-hover:scale-[1.045]'
                  : ''
              }`}
            />
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to bottom, rgba(10,9,8,0.55) 0%, rgba(10,9,8,0) 26%, rgba(10,9,8,0) 42%, rgba(10,9,8,0.82) 100%)',
              }}
            />
          </>
        )}

        <div className="relative z-[1] flex h-full flex-col p-[6cqw]">
          {tags.length > 0 && (
            <p
              className="flex flex-wrap items-center gap-x-[1.6cqw] gap-y-[1cqw] border-b pb-[2.4cqw] font-display font-bold uppercase leading-none tracking-[0.04em]"
              style={{
                fontSize: 'max(10px, 3.4cqw)',
                borderColor: withAlpha(ink, 0.28),
                // Room for the stamp across the corner.
                paddingRight: stamp ? '27cqw' : undefined,
              }}
            >
              {tags.map((tag, index) => (
                <span key={tag} className="inline-flex items-center gap-x-[1.6cqw]">
                  {index > 0 && <span style={{ opacity: 0.45 }}>/</span>}
                  {tag}
                </span>
              ))}
            </p>
          )}

          <h3
            className="t-poster mt-auto"
            style={{ fontSize: `${titleSize(title)}cqw`, overflowWrap: 'anywhere' }}
          >
            {typeset(title)}
          </h3>
        </div>

        {stamp && <Stamp color={ink}>{stamp}</Stamp>}
      </div>
    </div>
  )
}
