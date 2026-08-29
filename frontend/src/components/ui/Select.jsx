import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

/**
 * Dropdown in the site's own palette, replacing <select>, whose popup is drawn
 * by the operating system and cannot be styled to match.
 *
 * The panel is rendered into <body> and positioned from the trigger's rect:
 * inside the flow it would be clipped by any scrolling or masked ancestor, and
 * several of the places this is used sit in exactly such a container.
 *
 * Keyboard behaviour follows the listbox pattern, so nothing is lost by giving
 * up the native element: arrows move the highlight, Enter or Space commits,
 * Escape closes, Home and End jump, and typing a letter jumps to a label.
 */

const GAP = 6
const EDGE = 8
const MAX_PANEL = 280

export default function Select({
  options = [],
  value,
  onChange,
  placeholder = 'Выберите…',
  className = '',
  disabled = false,
  'aria-label': ariaLabel,
  id,
}) {
  const listId = useId()
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const typed = useRef({ text: '', at: 0 })

  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const [active, setActive] = useState(0)

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null

  const close = useCallback(() => {
    setOpen(false)
    setRect(null)
  }, [])

  const place = useCallback(() => {
    const box = triggerRef.current?.getBoundingClientRect()
    if (!box) return
    const height = Math.min(MAX_PANEL, options.length * 36 + 12)
    // Below unless the panel would run off the bottom and there is more room up.
    const below = window.innerHeight - box.bottom - GAP
    const dropUp = below < height && box.top > below
    setRect({
      left: Math.min(box.left, window.innerWidth - box.width - EDGE),
      width: box.width,
      // Anchored by its bottom edge when dropping up, never by a transform: the
      // opening keyframes animate transform, and a CSS animation outranks an
      // inline style, so a translate here would be dropped mid-animation and
      // the panel would jump.
      top: dropUp ? undefined : box.bottom + GAP,
      bottom: dropUp ? window.innerHeight - box.top + GAP : undefined,
      dropUp,
      maxHeight: Math.max(120, Math.min(MAX_PANEL, (dropUp ? box.top : below) - EDGE)),
    })
  }, [options.length])

  const openPanel = () => {
    if (disabled) return
    place()
    setActive(selectedIndex >= 0 ? selectedIndex : 0)
    setOpen(true)
  }

  const commit = (index) => {
    const option = options[index]
    if (!option) return
    onChange?.(option.value)
    close()
    triggerRef.current?.focus()
  }

  // Re-measure before paint, so the panel never shows in the wrong place first.
  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (event) => {
      if (panelRef.current?.contains(event.target)) return
      if (triggerRef.current?.contains(event.target)) return
      close()
    }
    // The panel is fixed at the position it opened at, so anything that moves
    // the trigger closes it rather than leaving it stranded.
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open, close])

  // Keep the highlighted row in view when the arrows walk past the edge.
  useEffect(() => {
    if (!open) return
    panelRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const jumpToLetter = (key) => {
    const now = Date.now()
    // Keystrokes within a second build one search string, as a native select does.
    typed.current.text = now - typed.current.at < 1000 ? typed.current.text + key : key
    typed.current.at = now
    const needle = typed.current.text.toLowerCase()
    const found = options.findIndex((option) =>
      String(option.label).toLowerCase().startsWith(needle),
    )
    if (found >= 0) {
      if (open) setActive(found)
      else commit(found)
    }
  }

  const onKeyDown = (event) => {
    const { key } = event

    if (!open) {
      if (key === 'ArrowDown' || key === 'ArrowUp' || key === 'Enter' || key === ' ') {
        event.preventDefault()
        openPanel()
        return
      }
      if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        jumpToLetter(key)
      }
      return
    }

    if (key === 'Escape' || key === 'Tab') {
      close()
      return
    }
    if (key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => Math.min(i + 1, options.length - 1))
    } else if (key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (key === 'End') {
      event.preventDefault()
      setActive(options.length - 1)
    } else if (key === 'Enter' || key === ' ') {
      event.preventDefault()
      commit(active)
    } else if (key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault()
      jumpToLetter(key)
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : openPanel())}
        onKeyDown={onKeyDown}
        className={[
          'flex w-full items-center justify-between gap-2 rounded-[var(--radius-sm)]',
          'border border-[var(--border)] bg-[var(--surface2)] px-3.5 py-2.5 text-left text-sm',
          'outline-none transition-all duration-150',
          'focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25',
          disabled
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer hover:border-[var(--border2)]',
          selected ? 'text-[var(--text)]' : 'text-[var(--muted2)]',
          className,
        ].join(' ')}
      >
        <span className="truncate">{selected ? selected.label : placeholder}</span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-[var(--muted)] transition-transform duration-200 ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            id={listId}
            role="listbox"
            tabIndex={-1}
            className="fixed z-[90] overflow-y-auto rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.5)]"
            style={{
              left: rect.left,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
              maxHeight: rect.maxHeight,
              // Grows out of the trigger rather than appearing at full size.
              animation: 'velox-select-in 130ms cubic-bezier(0.22, 1, 0.36, 1)',
              transformOrigin: rect.dropUp ? 'bottom center' : 'top center',
            }}
          >
            {options.map((option, index) => {
              const isSelected = option.value === value
              return (
                <div
                  key={option.value}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => commit(index)}
                  className={[
                    'flex cursor-pointer items-center justify-between gap-2 rounded-[6px]',
                    'px-3 py-2 text-sm transition-colors duration-100',
                    index === active ? 'bg-[var(--accent-dim)]' : '',
                    isSelected ? 'text-[var(--accent)]' : 'text-[var(--text)]',
                  ].join(' ')}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && <Check size={14} className="shrink-0" />}
                </div>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
