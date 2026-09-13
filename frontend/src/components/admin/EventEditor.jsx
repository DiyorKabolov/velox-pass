import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import Input from '../ui/Input'
import Select from '../ui/Select'
import { getPreviewImage, getTemplates } from '../../api/pdfTemplates'
import useAuth from '../../hooks/useAuth'
import EventImageUpload from './EventImageUpload'
import EventPreview from './EventPreview'
import { CardColors, TagPicker } from './EventStyleFields'

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

  // Templates are managed by the superadmin, and the list behind the picker is
  // theirs alone; anyone else would get a 403 from it.
  const { isSuperadmin } = useAuth()

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
            value={form.has_seats ? '' : form.capacity}
            disabled={form.has_seats}
            onChange={(event) => set({ capacity: event.target.value })}
            placeholder={
              form.has_seats ? 'Из залов сеансов' : '0 — без ограничения'
            }
          />
        </div>

        {/* Which kind of event this is decides where its capacity comes from,
            and until now there was no way to say: every event created here was
            unseated, and a showing could never be scheduled for it. */}
        <div
          role="radiogroup"
          aria-label="Рассадка"
          className="flex gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] p-1"
        >
          {[
            { seated: false, label: 'Свободная рассадка' },
            { seated: true, label: 'Места в зале' },
          ].map((option) => {
            const active = Boolean(form.has_seats) === option.seated
            return (
              <button
                key={option.label}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({ has_seats: option.seated })}
                className={[
                  'flex-1 rounded-[6px] px-3 py-1.5 text-xs transition-all duration-150',
                  active
                    ? 'bg-[var(--accent)] font-medium text-[var(--bg)]'
                    : 'text-[var(--muted)] hover:text-[var(--text)]',
                ].join(' ')}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        <p className="-mt-1 text-xs text-[var(--muted2)]">
          {form.has_seats
            ? 'Зрители выбирают конкретные места. Вместимость складывается из залов, где назначены сеансы.'
            : 'Билет без места. Вместимость задаётся здесь; ноль — без ограничения.'}
        </p>

        {/* Seated events price per category on each session, so the field
            only exists for the other kind. */}
        {!form.has_seats && (
          <Input
            label="Цена билета, сомони"
            name="price"
            type="number"
            min={0}
            step="0.01"
            value={form.price ?? 0}
            onChange={(event) => set({ price: event.target.value })}
            placeholder="0 — бесплатно"
          />
        )}

        <Input
          label="Место проведения"
          name="location"
          value={form.location}
          onChange={field('location')}
          placeholder="Большой концертный зал"
        />

        <div className="space-y-6 pt-1">
          <TagPicker value={form.tags} onChange={(tags) => set({ tags })} />
          <CardColors value={form} onChange={(colors) => set(colors)} />
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

        {isSuperadmin && (
          <div className="mb-6">
            <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
              PDF шаблон
            </span>
            <TemplatePicker
              value={form.template_id}
              onChange={(template_id) => set({ template_id })}
            />
          </div>
        )}

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
