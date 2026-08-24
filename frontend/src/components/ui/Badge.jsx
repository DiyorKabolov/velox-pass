const TONES = {
  ok: {
    color: 'var(--ok)',
    background: 'var(--ok-bg)',
    borderColor: 'rgba(74, 222, 128, 0.35)',
  },
  expired: {
    color: 'var(--muted)',
    background: 'rgba(122, 127, 136, 0.10)',
    borderColor: 'var(--border2)',
  },
  used: {
    color: 'var(--err)',
    background: 'var(--err-bg)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  warn: {
    color: 'var(--warn)',
    background: 'rgba(251, 191, 36, 0.10)',
    borderColor: 'rgba(251, 191, 36, 0.35)',
  },
}

export default function Badge({ tone = 'ok', children, className = '' }) {
  return (
    <span
      style={TONES[tone] ?? TONES.ok}
      className={[
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'font-mono2 text-[10px] uppercase tracking-[0.14em]',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
