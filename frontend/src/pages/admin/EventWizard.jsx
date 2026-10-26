import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Armchair, CalendarDays, Check, Repeat } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { apiError } from '../../api/client'
import { createEvent, uploadEventImage } from '../../api/events'
import { setEventTemplate } from '../../api/pdfTemplates'
import { createSessions } from '../../api/sessions'
import { getHallSeats, getVenueHalls, getVenues } from '../../api/venues'
import useAuth from '../../hooks/useAuth'
import { formatSessionStamp } from '../../utils/dates'
import { pluralize } from '../../utils/plural'
import { formatPrice } from '../../utils/ticketGroups'
import Button from '../../components/ui/Button'
import { CONTAINER, PageHeader } from '../../components/ui/Page'
import Input from '../../components/ui/Input'
import Select from '../../components/ui/Select'
import SeatMap from '../../components/seats/SeatMap'
import EventImageUpload from '../../components/admin/EventImageUpload'
import EventPreview from '../../components/admin/EventPreview'
import RecurrenceEditor from '../../components/admin/RecurrenceEditor'
import { CardColors, TagPicker } from '../../components/admin/EventStyleFields'
import {
  CATEGORY_LABELS,
  KINDS,
  STEPS,
  emptyWizard,
  eventPayload,
  firstInvalidStep,
  inBatches,
  momentsOf,
  seatCategories,
  sessionsPayload,
  validateStep,
} from '../../components/admin/wizardForm'

// Drawn marks for the three kinds of event, in place of emoji.
const KIND_ICONS = { single: CalendarDays, hall: Armchair, series: Repeat }

function Caption({ children }) {
  return (
    <span className="t-label mb-2 block">
      {children}
    </span>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <Caption>{label}</Caption>
      {children}
    </label>
  )
}

/** 01 Информация · 02 Тип · … Steps already behind can be clicked back to. */
function Progress({ step, onJump }) {
  return (
    <ol className="mb-12 grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--border)] sm:grid-cols-4">
      {STEPS.map((label, index) => {
        const done = index < step
        const current = index === step
        return (
          <li key={label} className="bg-[var(--bg)]">
            <button
              type="button"
              disabled={!done}
              onClick={() => onJump(index)}
              aria-current={current ? 'step' : undefined}
              className={[
                'relative flex w-full items-baseline gap-3 px-4 py-4 text-left transition-colors duration-200 disabled:cursor-default',
                current
                  ? 'text-[var(--text)]'
                  : done
                    ? 'text-[var(--text)] hover:bg-[var(--surface)]'
                    : 'text-[var(--muted2)]',
              ].join(' ')}
            >
              <span
                className="t-poster t-num text-[28px] leading-none"
                style={{ color: current ? 'var(--accent)' : undefined }}
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-[14px]">{label}</span>
              {done && (
                <Check size={14} strokeWidth={2.25} className="ml-auto self-center text-[var(--ok)]" />
              )}
              {current && (
                <motion.span
                  layoutId="wizard-step"
                  transition={{ type: 'spring', stiffness: 480, damping: 40 }}
                  className="absolute inset-x-0 bottom-0 h-[2px] bg-[var(--accent)]"
                />
              )}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Where the event takes place.
 *
 * A venue administrator with a single venue has nothing to choose, so it is
 * stated rather than offered; with several, only theirs are listed. A
 * superadmin sees every venue, and for an event without seats may leave it
 * empty -- a lecture in a library belongs to no venue in the system.
 */
function VenuePicker({ venues, value, onChange, optional, locked }) {
  if (locked && venues?.length === 1) {
    return (
      <Field label="Площадка">
        <p className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3.5 py-2.5 text-sm">
          {venues[0].name}
        </p>
      </Field>
    )
  }
  return (
    <Field label="Площадка">
      <Select
        value={value}
        onChange={onChange}
        placeholder={optional ? '— без площадки —' : '— выберите —'}
        aria-label="Площадка"
        options={(venues ?? []).map((venue) => ({
          value: String(venue.id),
          label: venue.name,
        }))}
      />
    </Field>
  )
}

// --- step 1 ---------------------------------------------------------------

function InfoStep({ form, set }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        <Input
          label="Название"
          name="title"
          value={form.title}
          onChange={(event) => set({ title: event.target.value })}
          placeholder="Симфонический вечер"
          required
        />
        <Field label="Описание">
          <textarea
            value={form.description}
            onChange={(event) => set({ description: event.target.value })}
            rows={4}
            placeholder="О чём мероприятие?"
            className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3.5 py-2.5 text-sm text-[var(--text)] outline-none transition-all duration-150 placeholder:text-[var(--muted2)] focus:border-[var(--accent)] focus:shadow-[0_0_0_3px_var(--accent-dim)]"
          />
        </Field>
        <TagPicker value={form.tags} onChange={(tags) => set({ tags })} />
        <CardColors value={form} onChange={(colors) => set(colors)} />
      </div>

      <div className="min-w-0 space-y-6">
        <div>
          <Caption>Обложка</Caption>
          <EventImageUpload
            value={form.image_url}
            file={form.image_file}
            onPick={(image_file) => set({ image_file })}
            onRemove={() => set({ image_file: null, image_url: null })}
          />
        </div>
        {/* The wizard is a page, not a dialog: the preview stands on the
            page colour, and the date may live outside form.date. */}
        <EventPreview form={form} date={momentsOf(form)[0] ?? null} notch="var(--bg)" />
      </div>
    </div>
  )
}

// --- step 2 ---------------------------------------------------------------

function KindStep({ form, set }) {
  return (
    <div role="radiogroup" aria-label="Тип мероприятия" className="grid gap-4 md:grid-cols-3">
      {Object.entries(KINDS).map(([key, kind]) => {
        const selected = form.kind === key
        const Icon = KIND_ICONS[key] ?? CalendarDays
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => set({ kind: key, recurring: key === 'hall' ? form.recurring : false })}
            className={[
              'relative rounded-[var(--radius)] border p-6 text-left transition-[border-color,background-color,transform] duration-200 active:scale-[0.99]',
              selected
                ? 'border-[var(--text)] bg-[var(--surface2)]'
                : 'border-[var(--border)] hover:border-[var(--border2)] hover:bg-[var(--surface)]',
            ].join(' ')}
          >
            <Icon
              size={28}
              strokeWidth={1.5}
              aria-hidden
              className={selected ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}
            />
            {selected && (
              <Check
                size={16}
                strokeWidth={2.25}
                className="absolute right-5 top-5 text-[var(--text)]"
              />
            )}
            <p className="mt-6 font-display text-[24px] font-bold uppercase leading-none">
              {kind.label}
            </p>
            {kind.lines.map((line) => (
              <p key={line} className="mt-2 text-[14px] text-[var(--muted)]">
                {line}
              </p>
            ))}
          </button>
        )
      })}
    </div>
  )
}

// --- step 3 ---------------------------------------------------------------

function SingleStep({ form, set, venuePicker }) {
  const moments = momentsOf(form)
  return (
    <div className="max-w-2xl space-y-5">
      {venuePicker}
      <Input
        label="Дата и время"
        type="datetime-local"
        value={form.date}
        onChange={(event) => set({ date: event.target.value })}
      />
      <Input
        label="Место проведения"
        value={form.location}
        onChange={(event) => set({ location: event.target.value })}
        placeholder="Большой концертный зал"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Вместимость"
          type="number"
          min={0}
          value={form.capacity}
          onChange={(event) => set({ capacity: event.target.value })}
          placeholder="0 — без ограничения"
        />
        <Input
          label="Цена, сомони"
          type="number"
          min={0}
          step="0.01"
          value={form.price}
          onChange={(event) => set({ price: event.target.value })}
          placeholder="0 — бесплатно"
        />
      </div>
      {moments[0] && (
        <p className="text-sm text-[var(--muted)]">
          1 мероприятие · {formatSessionStamp(moments[0])}
          {form.location.trim() && ` · ${form.location.trim()}`}
        </p>
      )}
    </div>
  )
}

function HallStep({ form, set, venuePicker, halls, categories, seats }) {
  const moments = momentsOf(form)
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-5">
        {venuePicker}
        <Field label="Зал">
          <Select
            value={form.hallId}
            disabled={!form.venueId}
            onChange={(hallId) => set({ hallId })}
            placeholder={form.venueId ? '— выберите —' : 'Сначала площадка'}
            aria-label="Зал"
            options={(halls ?? []).map((hall) => ({
              value: String(hall.id),
              label: `${hall.name} (${pluralize(hall.seats_count, 'место', 'места', 'мест')})`,
            }))}
          />
        </Field>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={form.recurring}
            onChange={(event) => set({ recurring: event.target.checked })}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          <span className="text-sm">Повторяющиеся сеансы</span>
        </label>

        {form.recurring ? (
          <RecurrenceEditor value={form.rule} onChange={(rule) => set({ rule })} />
        ) : (
          <Input
            label="Дата и время сеанса"
            type="datetime-local"
            value={form.datetime}
            onChange={(event) => set({ datetime: event.target.value })}
          />
        )}

        {form.hallId && (
          <div>
            <Caption>Цены по категориям</Caption>
            {categories.length ? (
              <div className="grid gap-3 sm:grid-cols-3">
                {categories.map(({ category, count }) => (
                  <Input
                    key={category}
                    label={`${CATEGORY_LABELS[category]} · ${count}`}
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.prices[category]}
                    onChange={(event) =>
                      set({ prices: { ...form.prices, [category]: event.target.value } })
                    }
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">В этом зале нет мест.</p>
            )}
          </div>
        )}

        {!form.recurring && moments[0] && (
          <p className="text-sm text-[var(--muted)]">
            1 сеанс · {formatSessionStamp(moments[0])}
          </p>
        )}
      </div>

      <div className="min-w-0">
        {form.hallId ? (
          <>
            <Caption>Схема зала</Caption>
            <div className="max-h-80 overflow-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3">
              <SeatMap seats={seats ?? []} mode="view" />
            </div>
          </>
        ) : (
          <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--muted2)]">
            Схема появится, когда выбран зал
          </p>
        )}
      </div>
    </div>
  )
}

function SeriesStep({ form, set, venuePicker }) {
  return (
    <div className="max-w-2xl space-y-5">
      {venuePicker}
      <Input
        label="Место проведения"
        value={form.location}
        onChange={(event) => set({ location: event.target.value })}
        placeholder="Лекторий, 2 этаж"
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Вместимость на каждую дату"
          type="number"
          min={0}
          value={form.capacity}
          onChange={(event) => set({ capacity: event.target.value })}
          placeholder="0 — без ограничения"
        />
        <Input
          label="Цена, сомони"
          type="number"
          min={0}
          step="0.01"
          value={form.price}
          onChange={(event) => set({ price: event.target.value })}
          placeholder="0 — бесплатно"
        />
      </div>
      <p className="rounded-[var(--radius-sm)] bg-[var(--surface)] px-4 py-3 text-xs text-[var(--muted)]">
        Без зала сеансам не к чему крепиться, поэтому каждая дата станет отдельным
        мероприятием в афише — со своей вместимостью и продажей билетов.
      </p>
      <RecurrenceEditor
        value={form.rule}
        onChange={(rule) => set({ rule })}
        noun={['мероприятие', 'мероприятия', 'мероприятий']}
      />
    </div>
  )
}

// --- step 4 ---------------------------------------------------------------

function Summary({ form, venue, hall, categories }) {
  const moments = momentsOf(form)
  const kind = KINDS[form.kind]
  const rows = [['Название', form.title.trim()], ['Тип', kind?.label]]

  if (moments.length === 1) {
    rows.push(['Дата', formatSessionStamp(moments[0])])
  } else if (moments.length > 1) {
    rows.push([
      'Даты',
      `${formatSessionStamp(moments[0])} — ${formatSessionStamp(moments[moments.length - 1])}`,
    ])
  }

  if (form.kind === 'hall') {
    rows.push(['Место', [venue?.name, hall?.name].filter(Boolean).join(' · ')])
    rows.push([
      'Вместимость',
      hall ? `${pluralize(hall.seats_count, 'место', 'места', 'мест')} на сеанс` : '—',
    ])
    rows.push(['Сеансов', String(moments.length)])
    rows.push([
      'Цены',
      categories.length
        ? categories
            .map(({ category }) => {
              const price = Number(form.prices[category]) || 0
              return `${CATEGORY_LABELS[category]} ${price ? formatPrice(price) : 'бесплатно'}`
            })
            .join(' · ')
        : '—',
    ])
  } else {
    rows.push(['Место', [venue?.name, form.location.trim()].filter(Boolean).join(' · ') || '—'])
    rows.push(['Вместимость', Number(form.capacity) ? String(form.capacity) : 'без ограничения'])
    if (form.kind === 'series') rows.push(['Мероприятий', String(moments.length)])
    rows.push(['Цена', Number(form.price) ? formatPrice(form.price) : 'Бесплатно'])
  }
  if (form.tags.length) rows.push(['Теги', form.tags.join(', ')])

  return (
    <dl className="divide-y divide-[var(--border)] rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)]">
      {rows.map(([label, value]) => (
        <div key={label} className="grid grid-cols-[130px_minmax(0,1fr)] gap-4 px-5 py-3 text-sm">
          <dt className="text-[var(--muted)]">{label}</dt>
          <dd className="break-words">{value || '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

// --- the wizard -----------------------------------------------------------

export default function EventWizard() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { isSuperadmin } = useAuth()

  // Same page for both panels; where it was opened from decides where it
  // returns to.
  const fromVenuePanel = location.pathname.startsWith('/venue-admin')
  const returnTo = fromVenuePanel ? '/venue-admin' : '/admin/events'

  const [form, setForm] = useState(emptyWizard)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))

  // The backend narrows this to the caller's venues.
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: getVenues })
  const singleVenue = !isSuperadmin && venues?.length === 1

  // Nothing to choose: fill it in, so the checks and the request agree with
  // what is on screen.
  useEffect(() => {
    if (singleVenue && !form.venueId) set({ venueId: String(venues[0].id) })
  }, [singleVenue, venues, form.venueId])

  const { data: halls } = useQuery({
    queryKey: ['venues', form.venueId, 'halls'],
    queryFn: () => getVenueHalls(form.venueId),
    enabled: form.kind === 'hall' && Boolean(form.venueId),
  })
  const { data: seats } = useQuery({
    queryKey: ['halls', form.hallId, 'seats'],
    queryFn: () => getHallSeats(form.hallId),
    enabled: Boolean(form.hallId),
  })

  const venue = venues?.find((item) => String(item.id) === String(form.venueId))
  const hall = halls?.find((item) => String(item.id) === String(form.hallId))
  const categories = useMemo(() => seatCategories(seats), [seats])

  const ctx = { venueRequired: !isSuperadmin && (venues?.length ?? 0) > 1 }

  const next = () => {
    const problem = validateStep(step, form, ctx)
    if (problem) {
      toast.error(problem)
      return
    }
    setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  const venuePicker = (
    <VenuePicker
      venues={venues}
      value={form.venueId}
      locked={!isSuperadmin}
      optional={isSuperadmin && form.kind !== 'hall'}
      // A hall belongs to one venue; keeping it across a change of venue would
      // schedule the showing somewhere else entirely.
      onChange={(venueId) => set({ venueId, hallId: '' })}
    />
  )

  async function finishOne(event) {
    if (isSuperadmin && form.template_id) await setEventTemplate(event.id, form.template_id)
    if (form.image_file) await uploadEventImage(event.id, form.image_file)
  }

  async function submit() {
    const broken = firstInvalidStep(form, ctx)
    if (broken !== -1) {
      setStep(broken)
      toast.error(validateStep(broken, form, ctx))
      return
    }

    setSaving(true)
    const moments = momentsOf(form)
    let message = 'Мероприятие создано'
    let warning = null

    try {
      if (form.kind === 'series') {
        const results = await inBatches(moments, 4, async (moment) => {
          const event = await createEvent(eventPayload(form, moment, { venueName: venue?.name }))
          await finishOne(event)
          return event
        })
        const created = results.filter((result) => result.ok).length
        const failed = results.length - created
        message = `Создано ${pluralize(created, 'мероприятие', 'мероприятия', 'мероприятий')}`
        if (failed) {
          const reason = results.find((result) => !result.ok)?.error
          warning = `Не удалось создать ${failed}: ${apiError(reason, 'ошибка сервера')}`
        }
        if (!created) throw results.find((result) => !result.ok)?.error
      } else {
        const event = await createEvent(eventPayload(form, moments[0], { venueName: venue?.name }))

        // The event exists from here on. Anything that fails below is said so
        // plainly, rather than as though nothing had been created.
        try {
          await finishOne(event)
          if (form.kind === 'hall') {
            const result = await createSessions(
              sessionsPayload(form, event.id, categories.map((item) => item.category)),
            )
            const added = result?.created ?? 1
            message = `Мероприятие создано · ${pluralize(added, 'сеанс', 'сеанса', 'сеансов')} добавлено`
            if (result?.skipped) {
              warning = `${pluralize(result.skipped, 'сеанс пропущен', 'сеанса пропущено', 'сеансов пропущено')} — зал в это время занят`
            }
          }
        } catch (error) {
          warning = `Мероприятие создано, но не до конца: ${apiError(error, 'ошибка сервера')}. Сеансы можно добавить из списка мероприятий.`
        }
      }

      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
      queryClient.invalidateQueries({ queryKey: ['venue-admin'] })
      queryClient.invalidateQueries({ queryKey: ['venues'] })

      toast.success(message)
      if (warning) toast.error(warning, { duration: 8000 })
      navigate(returnTo)
    } catch (error) {
      toast.error(apiError(error, 'Не удалось создать мероприятие'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`${CONTAINER} pt-10 sm:pt-14`}>
      <PageHeader
        kicker={
          <nav aria-label="Хлебные крошки" className="flex items-center gap-2">
            <Link
              to={returnTo}
              className="transition-colors duration-200 hover:text-[var(--text)]"
            >
              {fromVenuePanel ? 'Моя площадка' : 'Афиша'}
            </Link>
            <span aria-hidden className="text-[var(--border2)]">
              /
            </span>
            <span className="text-[var(--text)]">Новое мероприятие</span>
          </nav>
        }
        title="Новое мероприятие"
        size="md"
        rule={false}
        className="mb-10"
      />
      <Progress step={step} onJump={setStep} />

      {step === 0 && <InfoStep form={form} set={set} />}
      {step === 1 && <KindStep form={form} set={set} />}
      {step === 2 && form.kind === 'single' && (
        <SingleStep form={form} set={set} venuePicker={venuePicker} />
      )}
      {step === 2 && form.kind === 'hall' && (
        <HallStep
          form={form}
          set={set}
          venuePicker={venuePicker}
          halls={halls}
          seats={seats}
          categories={categories}
        />
      )}
      {step === 2 && form.kind === 'series' && (
        <SeriesStep form={form} set={set} venuePicker={venuePicker} />
      )}
      {step === 3 && (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Summary form={form} venue={venue} hall={hall} categories={categories} />
          <EventPreview form={form} date={momentsOf(form)[0] ?? null} notch="var(--bg)" />
        </div>
      )}

      <div className="mt-10 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-6">
        <Button
          variant="ghost"
          onClick={() => (step === 0 ? navigate(returnTo) : setStep(step - 1))}
          disabled={saving}
        >
          <ArrowLeft size={15} />
          {step === 0 ? 'Отмена' : 'Назад'}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button onClick={next}>
            Далее
            <ArrowRight size={15} />
          </Button>
        ) : (
          <Button onClick={submit} loading={saving}>
            Создать мероприятие
            <ArrowRight size={15} />
          </Button>
        )}
      </div>
    </div>
  )
}
