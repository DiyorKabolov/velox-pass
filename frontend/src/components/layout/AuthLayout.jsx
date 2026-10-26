import { CONTAINER } from '../ui/Page'
import { Reveal, WordsReveal } from '../motion/Motion'

/**
 * The frame of the sign-in screens: the word for what is happening, set as
 * large as a playbill would set it, and the form beside it on a quiet panel.
 * On a phone the word sits above the form.
 */
export default function AuthLayout({ title, lead, children, footer }) {
  return (
    <div
      className={`${CONTAINER} grid min-h-[calc(100dvh-64px)] content-center items-center gap-x-20 gap-y-10 py-12 lg:grid-cols-[minmax(0,1fr)_420px]`}
    >
      <div className="min-w-0">
        <h1 className="t-poster text-[clamp(56px,8vw,120px)] text-[var(--text)]">
          <WordsReveal text={title} />
        </h1>
        {lead && (
          <Reveal
            as="p"
            delay={0.18}
            distance={10}
            className="mt-6 max-w-md text-[16px] leading-relaxed text-[var(--muted)]"
          >
            {lead}
          </Reveal>
        )}
      </div>

      <Reveal delay={0.1} className="w-full">
        <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          {children}
        </div>
        {footer && (
          <p className="mt-6 text-center text-[14px] text-[var(--muted)]">{footer}</p>
        )}
      </Reveal>
    </div>
  )
}
