import { normaliseHex } from './eventForm'

/** Native swatch plus a hex box, kept in sync and tolerant of partial typing. */
export default function ColorField({ label, value, fallback, onChange }) {
  const safe = normaliseHex(value, fallback)

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
        {label}
      </span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={safe}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} — образец цвета`}
          className="h-9 w-11 shrink-0 cursor-pointer rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] p-1"
        />
        <input
          type="text"
          value={value}
          spellCheck={false}
          // Free typing while the field is focused; the swatch above always
          // shows the last valid colour.
          onChange={(event) => onChange(event.target.value)}
          onBlur={(event) => onChange(normaliseHex(event.target.value, fallback))}
          className="w-full min-w-0 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 font-mono2 text-xs text-[var(--text)] outline-none transition-all duration-150 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25"
        />
      </span>
    </label>
  )
}
