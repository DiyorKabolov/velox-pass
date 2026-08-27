export default function Input({
  label,
  error,
  className = '',
  id,
  ...props
}) {
  const inputId = id || props.name

  return (
    <label className="block" htmlFor={inputId}>
      {label && (
        <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
          {label}
        </span>
      )}
      <input
        id={inputId}
        className={[
          'w-full rounded-[var(--radius-sm)] bg-[var(--surface2)] px-3.5 py-2.5',
          'text-[var(--text)] placeholder:text-[var(--muted2)]',
          'border transition-all duration-150 outline-none',
          'focus:ring-2 focus:ring-[var(--accent)]/25',
          error
            ? 'border-[var(--err)]'
            : 'border-[var(--border)] focus:border-[var(--accent)]',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <span className="mt-1.5 block text-xs text-[var(--err)]">{error}</span>}
    </label>
  )
}
