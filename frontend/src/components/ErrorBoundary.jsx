import { Component } from 'react'
import { AlertTriangle } from 'lucide-react'

/**
 * The last line of defence against a white screen.
 *
 * React treats an error thrown while rendering -- or while running an effect's
 * cleanup on the way out of a page -- as fatal: with nothing to catch it, it
 * unmounts the entire tree, and the site becomes a blank document with no clue
 * as to why. A boundary turns that into a message the operator can act on, and
 * leaves the rest of the app reachable.
 *
 * A class, because this is the one thing hooks still cannot do.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Kept in the console: the message below is for the person using the site,
    // the stack is for whoever has to fix it.
    console.error('Необработанная ошибка интерфейса:', error, info?.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-dvh items-center px-5 py-16 sm:px-10">
        <div className="mx-auto w-full max-w-2xl">
          <p className="t-label flex items-center gap-2 text-[var(--err)]">
            <AlertTriangle size={14} strokeWidth={1.75} />
            Ошибка интерфейса
          </p>
          <h1 className="t-poster mt-4 text-[clamp(56px,10vw,112px)] text-[var(--text)]">
            Что-то пошло не так
          </h1>
          <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-[var(--muted)]">
            Страница не смогла отрисоваться. Остальной сайт работает — вернитесь на
            главную или обновите страницу.
          </p>

          {/* The message itself, not a stack: enough to report the problem
              without turning the page into a debugger. */}
          <p className="mt-6 break-words border-l-2 border-[var(--border2)] py-1 pl-4 font-mono2 text-[12px] text-[var(--muted2)]">
            {String(error?.message || error)}
          </p>

          <div className="mt-10 flex flex-wrap gap-3">
            {/* A full navigation, not a router push: the tree is already torn
                down, and only a reload is guaranteed to rebuild it. */}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-12 rounded-[var(--radius-sm)] bg-[var(--accent)] px-6 text-[15px] font-medium text-[var(--accent-ink)] transition-colors duration-200 hover:bg-[var(--accent-hover)]"
            >
              Обновить
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="h-12 rounded-[var(--radius-sm)] border border-[var(--border2)] px-6 text-[15px] text-[var(--text)] transition-colors duration-200 hover:bg-[var(--surface2)]"
            >
              На главную
            </button>
          </div>
        </div>
      </div>
    )
  }
}
