import { EVENT_TAGS, tagColor } from '../../utils/eventTags'
import ColorField from './ColorField'
import { COLOR_PRESETS, DEFAULT_COLORS } from './eventForm'

/**
 * The parts of an event form that describe how it looks rather than when it is:
 * its tags and its ticket colours. Shared by the edit dialog and the creation
 * wizard, so a preset added here reaches both.
 */

function Caption({ children }) {
  return (
    <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
      {children}
    </span>
  )
}

/** Pills rather than a dropdown: the vocabulary is ten items, several may
    apply at once, and the choice reads at a glance. */
export function TagPicker({ value, onChange }) {
  const tags = value ?? []
  return (
    <div>
      <Caption>Теги</Caption>
      <div className="mb-1 flex flex-wrap gap-2">
        {EVENT_TAGS.map((tag) => {
          const on = tags.includes(tag)
          return (
            <button
              key={tag}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? tags.filter((t) => t !== tag) : [...tags, tag])}
              className={[
                'rounded-full border px-3 py-1.5 text-xs transition-all duration-150',
                'active:scale-[0.95]',
                on ? 'font-medium' : 'text-[var(--muted)] hover:text-[var(--text)]',
              ].join(' ')}
              style={
                on
                  ? {
                      borderColor: tagColor(tag),
                      background: `${tagColor(tag)}22`,
                      color: tagColor(tag),
                    }
                  : { borderColor: 'var(--border)' }
              }
            >
              {tag}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-[var(--muted2)]">
        По тегам зрители фильтруют афишу. Можно выбрать несколько.
      </p>
    </div>
  )
}

/** Six presets and the three colours themselves, for when none of them fits. */
export function CardColors({ value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch })
  const active = COLOR_PRESETS.find(
    (preset) =>
      preset.card_bg === value.card_bg &&
      preset.card_accent === value.card_accent &&
      preset.card_text === value.card_text,
  )

  return (
    <div>
      <Caption>Цвета билета</Caption>
      <div className="mb-4 flex flex-wrap gap-2">
        {COLOR_PRESETS.map((preset) => {
          const isActive = active?.name === preset.name
          return (
            <button
              key={preset.name}
              type="button"
              aria-pressed={isActive}
              onClick={() =>
                set({
                  card_bg: preset.card_bg,
                  card_accent: preset.card_accent,
                  card_text: preset.card_text,
                })
              }
              className={[
                'flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs transition-all duration-150 active:scale-[0.95]',
                isActive
                  ? 'border-[var(--accent)] bg-[var(--accent-dim)] text-[var(--text)]'
                  : 'border-[var(--border)] text-[var(--muted)] hover:border-[var(--border2)] hover:text-[var(--text)]',
              ].join(' ')}
            >
              <span
                className="h-4 w-4 rounded-full border border-black/20"
                style={{ background: preset.card_accent }}
              />
              {preset.name}
            </button>
          )
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <ColorField
          label="Фон"
          value={value.card_bg}
          fallback={DEFAULT_COLORS.card_bg}
          onChange={(card_bg) => set({ card_bg })}
        />
        <ColorField
          label="Акцент"
          value={value.card_accent}
          fallback={DEFAULT_COLORS.card_accent}
          onChange={(card_accent) => set({ card_accent })}
        />
        <ColorField
          label="Текст"
          value={value.card_text}
          fallback={DEFAULT_COLORS.card_text}
          onChange={(card_text) => set({ card_text })}
        />
      </div>
    </div>
  )
}
