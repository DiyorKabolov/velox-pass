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
      {label && <span className="t-label mb-2 block">{label}</span>}
      <input
        id={inputId}
        className={[
          'h-11 w-full rounded-[var(--radius-sm)] bg-[var(--surface)] px-3.5',
          'text-[15px] text-[var(--text)] placeholder:text-[var(--muted2)]',
          'border outline-none transition-[border-color,background-color,box-shadow] duration-200',
          'hover:border-[var(--border2)] focus:bg-[var(--surface2)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          error
            ? 'border-[var(--err)] focus:shadow-[0_0_0_3px_var(--err-bg)]'
            : 'border-[var(--border)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)]',
          className,
        ].join(' ')}
        {...props}
      />
      {error && <span className="mt-2 block text-[13px] text-[var(--err)]">{error}</span>}
    </label>
  )
}
