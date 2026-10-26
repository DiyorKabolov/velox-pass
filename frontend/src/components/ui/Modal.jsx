import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { EASE_OUT } from '../motion/Motion'

/**
 * Centred dialog rendered in a portal, so it is never clipped by a scrolling
 * table or a transformed ancestor. Escape and a backdrop click both close it,
 * and the page behind is locked so only the dialog scrolls.
 */
// Named sizes rather than a free class, so every dialog picks from the same
// short list instead of inventing its own width.
const SIZES = {
  md: 'max-w-[640px]',
  lg: 'max-w-4xl',
}

export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  footer,
  size = 'lg',
  children,
}) {
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
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-[rgba(8,7,6,0.78)] p-4 sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.22 } }}
          exit={{ opacity: 0, transition: { duration: 0.18, delay: 0.04 } }}
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
            className={`my-auto w-full ${SIZES[size] ?? SIZES.lg} overflow-hidden rounded-[var(--radius)] border border-[var(--border2)] bg-[var(--surface)] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.85)]`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.42, ease: EASE_OUT } }}
            exit={{ opacity: 0, y: 12, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } }}
          >
            <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 pb-4 pt-5">
              <div className="min-w-0">
                <h2 className="font-display text-[24px] font-bold uppercase leading-[1.05] text-[var(--text)]">
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-1.5 truncate text-[14px] text-[var(--muted)]">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="-mr-2 -mt-1 shrink-0 rounded-[var(--radius-sm)] p-2 text-[var(--muted)] transition-[color,background-color,transform] duration-200 hover:bg-[var(--surface2)] hover:text-[var(--text)] active:scale-[0.92]"
              >
                <X size={18} strokeWidth={1.75} />
              </button>
            </header>

            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>

            {footer && (
              <footer className="flex items-center justify-end gap-3 border-t border-[var(--border)] bg-[var(--bg)] px-6 py-4">
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
