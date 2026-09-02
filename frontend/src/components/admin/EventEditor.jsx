import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { getPreviewImage, getTemplates } from '../../api/pdfTemplates'
import { EVENT_TAGS, tagColor } from '../../utils/eventTags'
import EventImageUpload from './EventImageUpload'
import ColorField from './ColorField'
import EventPreview from './EventPreview'
import { COLOR_PRESETS, DEFAULT_COLORS } from './eventForm'

/**
 * The whole event form, shared by the edit modal and the create page so the
 * two can never drift apart. Fully controlled: state lives in the parent.
 */
/** Small render of the chosen template, so the pick can be recognised. */
function TemplateThumb({ templateId }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    if (!templateId) {
      setUrl(null)
      return undefined
    }
    let objectUrl = null
    let cancelled = false
    getPreviewImage(templateId)
      .then((value) => {
        if (cancelled) {
          URL.revokeObjectURL(value)
          return
        }
        objectUrl = value
        setUrl(value)
      })
      .catch(() => setUrl(null))
    // The blob URL is ours to release; without this every reopen leaks one.
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [templateId])

  if (!templateId || !url) return null
  return (
    <img
      src={url}
      alt=""
      className="mt-3 h-28 w-auto rounded border border-[var(--border)] bg-white object-contain"
    />
  )
}

export default function EventEditor({ form, onChange }) {
  const set = (patch) => onChange({ ...form, ...patch })
  const field = (name) => (event) => set({ [name]: event.target.value })

  const activePreset = COLOR_PRESETS.find(
    (preset) =>
      preset.card_bg === form.card_bg &&
      preset.card_accent === form.card_accent &&
      preset.card_text === form.card_text,
  )

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <div className="min-w-0 space-y-4">
        <Input
          label="Название"
          name="title"
          value={form.title}
          onChange={field('title')}
          placeholder="Симфонический вечер"
          required
        />

        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            Описание
          </span>
          <textarea
            name="description"
            value={form.description}
            onChange={field('description')}
            rows={3}
            placeholder="О чём мероприятие?"
            className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3.5 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--muted2)] outline-none transition-all duration-150 focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Дата и время"
            name="date"
            type="datetime-local"
            value={form.date}
            onChange={field('date')}
            required
          />
          <Input
            label="Вместимость"
            name="capacity"
            type="number"
            min={0}
            value={form.capacity}
            onChange={(event) => set({ capacity: event.target.value })}
            placeholder="0 — без ограничения"
          />
        </div>

        <Input
          label="Место проведения"
          name="location"
          value={form.location}
          onChange={field('location')}
          placeholder="Большой концертный зал"
        />

        <div className="pt-1">
          <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            Теги
          </span>
          {/* Pills rather than a dropdown: the whole vocabulary is ten items,
              several may apply at once, and the choice reads at a glance. */}
          <div className="mb-1 flex flex-wrap gap-2">
            {EVENT_TAGS.map((tag) => {
              const on = (form.tags ?? []).includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set({
                      tags: on
                        ? (form.tags ?? []).filter((t) => t !== tag)
                        : [...(form.tags ?? []), tag],
                    })
                  }
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
          <p className="mb-5 text-xs text-[var(--muted2)]">
            По тегам зрители фильтруют афишу. Можно выбрать несколько.
          </p>

          <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            Цвета билета
          </span>

          <div className="mb-4 flex flex-wrap gap-2">
            {COLOR_PRESETS.map((preset) => {
              const isActive = activePreset?.name === preset.name
              return (
                <button
                  key={preset.name}
                  type="button"
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
              value={form.card_bg}
              fallback={DEFAULT_COLORS.card_bg}
              onChange={(card_bg) => set({ card_bg })}
            />
            <ColorField
              label="Акцент"
              value={form.card_accent}
              fallback={DEFAULT_COLORS.card_accent}
              onChange={(card_accent) => set({ card_accent })}
            />
            <ColorField
              label="Текст"
              value={form.card_text}
              fallback={DEFAULT_COLORS.card_text}
              onChange={(card_text) => set({ card_text })}
            />
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="mb-6">
          <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            Обложка
          </span>
          <EventImageUpload
            value={form.image_url}
            file={form.image_file}
            onPick={(image_file) => set({ image_file })}
            onRemove={() => set({ image_file: null, image_url: null })}
          />
          <p className="mt-2 text-xs text-[var(--muted2)]">
            Появится кружком на карточке в афише.
          </p>
        </div>

        <div className="mb-6">
          <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
            PDF шаблон
          </span>
          <TemplatePicker
            value={form.template_id}
            onChange={(template_id) => set({ template_id })}
          />
        </div>

        <EventPreview form={form} />
      </div>
    </div>
  )
}

/** Template chooser. "По умолчанию" is a real choice, not an absent one: it
    means follow whichever template is flagged default, now and later. */
function TemplatePicker({ value, onChange }) {
  const { data: templates } = useQuery({
    queryKey: ['admin', 'pdf-templates'],
    queryFn: getTemplates,
  })

  const options = [
    { value: '', label: 'По умолчанию' },
    ...(templates ?? []).map((template) => ({
      value: String(template.id),
      label: template.is_default ? `${template.name} (основной)` : template.name,
    })),
  ]

  return (
    <>
      <Select
        value={value == null ? '' : String(value)}
        onChange={(next) => onChange(next === '' ? null : Number(next))}
        options={options}
        aria-label="PDF шаблон"
      />
      <TemplateThumb templateId={value} />
      <Link
        to="/admin/pdf-templates"
        className="mt-2 inline-block text-xs text-[var(--muted)] transition-colors hover:text-[var(--accent)]"
      >
        Управление шаблонами →
      </Link>
    </>
  )
}
