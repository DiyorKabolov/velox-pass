/**
 * A state, stamped in small capitals: colour on a faint wash of itself, no
 * outline, a corner just off square. A spent ticket is not an error, so it
 * reads in plain grey rather than in the alarm colour.
 */
const TONES = {
  ok: { color: 'var(--ok)', background: 'var(--ok-bg)' },
  expired: { color: 'var(--muted)', background: 'rgba(163, 157, 147, 0.1)' },
  used: { color: 'var(--muted2)', background: 'rgba(111, 106, 98, 0.14)' },
  warn: { color: 'var(--warn)', background: 'var(--warn-bg)' },
}

export default function Badge({ tone = 'ok', children, className = '' }) {
  return (
    <span
      style={TONES[tone] ?? TONES.ok}
      className={[
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-[3px] px-1.5 py-[3px]',
        'text-[10.5px] font-semibold uppercase leading-none tracking-[0.06em]',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
