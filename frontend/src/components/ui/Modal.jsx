import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * Centred dialog rendered in a portal, so it is never clipped by a scrolling
 * table or a transformed ancestor. Escape and a backdrop click both close it,
 * and the page behind is locked so only the dialog scrolls.
 */
export default function Modal({ open, onClose, title, subtitle, footer, children }) {
  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onMouseDown={(event) => {
            // Only a press that starts on the backdrop closes: dragging a text
            // selection out of the dialog must not dismiss it.
            if (event.target === event.currentTarget) onClose()
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="my-auto w-full max-w-4xl overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] shadow-[0_24px_70px_rgba(0,0,0,0.55)]"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.985 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
              <div className="min-w-0">
                <h2 className="font-display text-base text-[var(--text)]">{title}</h2>
                {subtitle && (
                  <p className="mt-1 truncate text-sm text-[var(--muted)]">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="shrink-0 rounded-[var(--radius-sm)] border border-[var(--border)] p-2 text-[var(--muted)] transition-all duration-150 hover:border-[var(--border2)] hover:text-[var(--text)] active:scale-[0.92]"
              >
                <X size={15} />
              </button>
            </header>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>

            {footer && (
              <footer className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
                {footer}
              </footer>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
