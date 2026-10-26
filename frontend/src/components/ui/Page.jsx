import { Reveal, WordsReveal } from '../motion/Motion'

/** The page column: one measure for every screen, gutters that grow with it. */
export const CONTAINER = 'mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-10'

const TITLE_SIZES = {
  xl: 'text-[clamp(64px,11vw,148px)]',
  lg: 'text-[clamp(48px,7.4vw,104px)]',
  md: 'text-[clamp(40px,5.6vw,76px)]',
}

/**
 * The head of a page, set like the masthead of a playbill: the title in
 * capitals, flush left, as large as the column allows, with the page's facts
 * hung off the right at its baseline. A rule closes it.
 *
 * `kicker` names where the page sits ("Кабинет / Билеты") -- context, not a
 * slogan.
 */
export function PageHeader({
  kicker,
  title,
  meta,
  lead,
  actions,
  size = 'xl',
  // Without the closing rule, for a header that hands straight over to a tab
  // strip or a section rule of its own.
  rule = true,
  className = '',
}) {
  return (
    <header
      className={`${rule ? 'border-b border-[var(--border)] pb-7 sm:pb-9' : ''} ${className}`}
    >
      {kicker && (
        <Reveal distance={8} className="t-label mb-5 flex items-center gap-2">
          {kicker}
        </Reveal>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <h1 className={`t-poster min-w-0 text-[var(--text)] ${TITLE_SIZES[size] ?? TITLE_SIZES.xl}`}>
          {/* A title that changes in place -- the cabinet names its tab --
              is set afresh, its words rising again. */}
          <WordsReveal key={title} text={title} className="block" />
        </h1>
        {(meta || actions) && (
          <Reveal
            delay={0.18}
            distance={10}
            className="flex flex-wrap items-center gap-x-6 gap-y-3 pb-[0.4em] text-[14px] text-[var(--muted)]"
          >
            {meta}
            {actions}
          </Reveal>
        )}
      </div>
      {lead && (
        <Reveal
          as="p"
          delay={0.12}
          distance={10}
          className="mt-6 max-w-xl text-[16px] leading-relaxed text-[var(--muted)]"
        >
          {lead}
        </Reveal>
      )}
    </header>
  )
}

/**
 * A section opened by a full rule in paper white, the way a newspaper starts a
 * new department. `aside` hangs on the right: a count, a filter, a link.
 */
export function SectionHead({ title, aside, as: Tag = 'h2', className = '' }) {
  return (
    <div
      className={`flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3 border-t border-[var(--text)] pt-4 ${className}`}
    >
      <Tag className="font-display text-[26px] font-bold uppercase leading-none text-[var(--text)] sm:text-[30px]">
        {title}
      </Tag>
      {aside && <div className="text-[13px] text-[var(--muted)]">{aside}</div>}
    </div>
  )
}

/**
 * Nothing to show, said plainly, with the way forward when there is one. The
 * dashed frame marks the place the content will occupy.
 */
export function EmptyState({ title, children, action, className = '' }) {
  return (
    <div
      className={`rounded-[var(--radius)] border border-dashed border-[var(--border2)] px-6 py-12 sm:px-10 ${className}`}
    >
      <p className="font-display text-[26px] font-bold uppercase leading-none text-[var(--text)] sm:text-[30px]">
        {title}
      </p>
      {children && (
        <div className="mt-3 max-w-md text-[14px] leading-relaxed text-[var(--muted)]">{children}</div>
      )}
      {action && <div className="mt-6 flex flex-wrap gap-3">{action}</div>}
    </div>
  )
}
