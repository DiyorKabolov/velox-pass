/**
 * The wordmark: the name in the poster face, split by the signal slash.
 *
 * The slash is the brand's one device -- it reads as motion (velox is "swift")
 * and as the separator a playbill uses between genres, and the site reuses it
 * wherever two things are listed side by side.
 */
export default function Logo({ className = '' }) {
  return (
    <span
      className={`t-poster inline-flex select-none items-baseline whitespace-nowrap text-[23px] leading-none text-[var(--text)] ${className}`}
    >
      Velox
      <span aria-hidden className="mx-[0.06em] text-[var(--accent)]">
        /
      </span>
      Pass
    </span>
  )
}
