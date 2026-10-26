import { Link } from 'react-router-dom'

/**
 * Three kinds of button and no more.
 *
 * primary -- the one thing this view is for, in signal vermilion.
 * ghost   -- everything else: a hairline frame that fills on hover.
 * danger  -- removing something; quiet until you point at it, because a row
 *            of red buttons down a table shouts louder than its content.
 *
 * Callers may still tint a button with `style` (an event's own colour, the
 * gold of a gift): the variants paint background, border and text through
 * those same properties, so an inline style wins cleanly.
 */
const VARIANTS = {
  primary:
    'bg-[var(--accent)] text-[var(--accent-ink)] border border-[var(--accent)] hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)]',
  ghost:
    'bg-transparent text-[var(--text)] border border-[var(--border2)] hover:bg-[var(--surface2)] hover:border-[var(--muted2)]',
  danger:
    'bg-transparent text-[var(--muted)] border border-[var(--border2)] hover:text-[var(--err)] hover:border-[var(--err)] hover:bg-[var(--err-bg)]',
}

const SIZES = {
  sm: 'h-8 px-3 text-[13px]',
  md: 'h-10 px-4 text-[14px]',
  lg: 'h-12 px-6 text-[15px]',
}

/** The classes of a button, for anything that has to look like one. */
export function buttonClasses({ variant = 'primary', size = 'md', className = '' } = {}) {
  return [
    'relative inline-flex shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-sm)]',
    'font-medium leading-none',
    'transition-[background-color,border-color,color,transform,opacity] duration-200 ease-out',
    'active:scale-[0.97] disabled:active:scale-100',
    'focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]',
    // Drained of colour as well as faded: a disabled vermilion at partial
    // opacity turns brick-red and reads as an error, not as "not yet".
    'disabled:cursor-not-allowed disabled:opacity-40 disabled:grayscale',
    VARIANTS[variant] ?? VARIANTS.primary,
    SIZES[size] ?? SIZES.md,
    className,
  ].join(' ')
}

/**
 * A link dressed as a button, for an action that is a move to another page.
 * A <Button> inside a <Link> is one control announced as two and tabbed
 * through twice.
 */
export function ButtonLink({ variant, size, className, children, ...props }) {
  return (
    <Link className={buttonClasses({ variant, size, className })} {...props}>
      {children}
    </Link>
  )
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
      aria-busy={loading || undefined}
      className={buttonClasses({ variant, size, className })}
      {...props}
    >
      {loading && (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-full border-[1.5px] border-current border-r-transparent"
        />
      )}
      {children}
    </button>
  )
}
