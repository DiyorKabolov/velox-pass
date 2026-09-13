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
      <div className="flex min-h-dvh items-center justify-center px-5 py-16">
        <div className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
          <AlertTriangle size={26} className="mx-auto mb-4 text-[var(--err)]" />
          <h1 className="font-display text-lg tracking-tight">Что-то пошло не так</h1>
          <p className="mt-3 text-sm text-[var(--muted)]">
            Страница не смогла отрисоваться. Остальной сайт работает — вернитесь на
            главную или обновите страницу.
          </p>

          {/* The message itself, not a stack: enough to report the problem
              without turning the page into a debugger. */}
          <p className="mt-4 break-words rounded-[var(--radius-sm)] bg-[var(--surface2)] px-3 py-2 font-mono2 text-[11px] text-[var(--muted2)]">
            {String(error?.message || error)}
          </p>

          <div className="mt-6 flex justify-center gap-3">
            {/* A full navigation, not a router push: the tree is already torn
                down, and only a reload is guaranteed to rebuild it. */}
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="rounded-[var(--radius-sm)] border border-[var(--border2)] px-4 py-2 text-sm text-[var(--muted)] transition-colors duration-150 hover:text-[var(--text)]"
            >
              На главную
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-[var(--radius-sm)] bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg)]"
            >
              Обновить
            </button>
          </div>
        </div>
      </div>
    )
  }
}
