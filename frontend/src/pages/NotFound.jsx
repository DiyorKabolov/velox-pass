import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CONTAINER } from '../components/ui/Page'
import { Reveal } from '../components/motion/Motion'

/** A ticket to nowhere: the number printed where the seat would be, the stub voided. */
function VoidTicket() {
  return (
    // Dropped onto the page, settling askew (the keyframes are in index.css).
    <div className="anim-drop relative mx-auto flex w-fit rotate-[-4deg] select-none shadow-[0_30px_60px_-30px_rgba(0,0,0,0.9)]">
      <div className="rounded-l-[14px] bg-[var(--card-bg)] px-8 pb-6 pt-7 text-left text-[var(--card-text)] sm:px-12">
        <p className="font-display text-[12px] font-bold uppercase tracking-[0.04em] opacity-60">
          Ряд — · Место — · Сеанс не найден
        </p>
        <p className="t-poster t-num mt-2 text-[clamp(110px,18vw,220px)] leading-[0.82]">404</p>
      </div>

      <div className="relative w-0">
        <span
          aria-hidden
          className="perforation-y absolute inset-y-4 left-0 text-[var(--card-text)] opacity-30"
        />
        <span aria-hidden className="absolute -left-[9px] -top-[9px] h-[18px] w-[18px] rounded-full bg-[var(--bg)]" />
        <span aria-hidden className="absolute -bottom-[9px] -left-[9px] h-[18px] w-[18px] rounded-full bg-[var(--bg)]" />
      </div>

      <div className="flex w-[72px] items-center justify-center rounded-r-[14px] bg-[var(--accent)] text-[var(--accent-ink)] sm:w-[96px]">
        <span className="t-poster -rotate-90 whitespace-nowrap text-[26px] sm:text-[32px]">
          Недействителен
        </span>
      </div>
    </div>
  )
}

export default function NotFound() {
  return (
    <div className={`${CONTAINER} grid min-h-[72vh] place-items-center py-16`}>
      <div className="text-center">
        <VoidTicket />
        <Reveal delay={0.35} distance={10}>
          <h1 className="mt-14 font-display text-[30px] font-bold uppercase leading-none text-[var(--text)] sm:text-[36px]">
            Такой страницы нет
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-[var(--muted)]">
            Ссылка устарела или мероприятие сняли с афиши.
          </p>
          <Link
            to="/"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--accent)] px-6 text-[15px] font-medium text-[var(--accent-ink)] transition-[background-color,transform] duration-200 ease-out hover:bg-[var(--accent-hover)] active:scale-[0.97]"
          >
            <ArrowLeft size={16} strokeWidth={1.75} />
            Вернуться в афишу
          </Link>
        </Reveal>
      </div>
    </div>
  )
}
