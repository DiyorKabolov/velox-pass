const VARIANTS = {
  primary:
    'bg-[var(--accent)] text-[var(--bg)] border border-[var(--accent)] hover:brightness-110',
  ghost:
    'bg-transparent text-[var(--text)] border border-[var(--border)] hover:bg-[var(--surface2)] hover:border-[var(--border2)]',
  danger:
    'bg-[var(--err-bg)] text-[var(--err)] border border-[var(--err)] hover:bg-[var(--err)] hover:text-[var(--bg)]',
}

const SIZES = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  loading = false,
  disabled = false,
  children,
  ...props
}) {
  const isDisabled = disabled || loading

  return (
    <button
      type={type}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center gap-2 rounded-[var(--radius-sm)]',
        'font-medium tracking-wide transition-all duration-150',
        'active:scale-[0.96] disabled:active:scale-100',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]',
        'disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:brightness-100',
        VARIANTS[variant] ?? VARIANTS.primary,
        SIZES[size] ?? SIZES.md,
        className,
      ].join(' ')}
      {...props}
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  )
}
