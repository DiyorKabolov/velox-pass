import { motion } from 'framer-motion'
import { NavLink } from 'react-router-dom'

const SPRING = { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 }

const TAB =
  'group relative flex shrink-0 items-center gap-2 pb-3 pt-1 text-[15px] outline-none transition-colors duration-200'

// Sits on top of the strip's hairline from the inside. The strip scrolls
// sideways on a phone, and a scroll container clips to its padding box -- an
// underline pushed down onto the border line itself would be cut away.
function Indicator({ layoutId }) {
  return (
    <motion.span
      layoutId={layoutId}
      transition={SPRING}
      className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--accent)]"
    />
  )
}

function Extras({ item }) {
  return (
    <>
      {item.count != null && (
        <span className="t-num text-[12px] text-[var(--muted2)]">{item.count}</span>
      )}
      {item.badge > 0 && (
        <span className="t-num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-semibold leading-none text-[var(--accent-ink)]">
          {item.badge}
        </span>
      )}
    </>
  )
}

const label = (active) =>
  [
    'inline-flex items-center gap-2 rounded-[3px]',
    'group-focus-visible:outline group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-[var(--accent)]',
    active ? 'text-[var(--text)]' : 'text-[var(--muted)] group-hover:text-[var(--text)]',
  ].join(' ')

/**
 * Text tabs over a hairline, the current one underlined in the signal colour.
 * The underline is a shared layout element, so it travels to the tab you
 * picked. `layoutId` must be unique among the tab strips on screen at once.
 */
export function Tabs({ items, value, onChange, layoutId, className = '' }) {
  return (
    <div
      role="tablist"
      className={`scrollbar-none flex gap-7 overflow-x-auto border-b border-[var(--border)] ${className}`}
    >
      {items.map((item) => {
        const active = item.key === value
        const Icon = item.icon
        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.key)}
            className={TAB}
          >
            <span className={label(active)}>
              {Icon && <Icon size={16} strokeWidth={1.75} className="shrink-0" />}
              {item.label}
              <Extras item={item} />
            </span>
            {active && <Indicator layoutId={layoutId} />}
          </button>
        )
      })}
    </div>
  )
}

/** The same strip, where each tab is an address of its own. */
export function RouteTabs({ items, layoutId, className = '' }) {
  return (
    <nav
      className={`scrollbar-none flex gap-7 overflow-x-auto border-b border-[var(--border)] ${className}`}
    >
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} end={item.end} className={TAB}>
          {({ isActive }) => (
            <>
              <span className={label(isActive)}>
                {item.label}
                <Extras item={item} />
              </span>
              {isActive && <Indicator layoutId={layoutId} />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
