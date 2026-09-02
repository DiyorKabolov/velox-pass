import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Repeat, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAdminEvents } from '../../api/admin'
import { getEventSessions } from '../../api/events'
import { cancelSessionGroup, createSessions, deleteSession } from '../../api/sessions'
import { getVenueHalls, getVenues } from '../../api/venues'
import Select from '../../components/ui/Select'
import { apiError } from '../../api/client'
import { formatDateTime, fromDatetimeLocal } from '../../utils/dates'
import { pluralize } from '../../utils/plural'
import { emptyRule, ruleToPayload, validateRule } from '../../utils/recurrence'
import { creationMessage, groupSessions } from '../../utils/sessionGroups'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import RecurrenceEditor from '../../components/admin/RecurrenceEditor'
import AdminLayout, { TableShell, Td, Th } from './AdminLayout'

const PRICE_CATEGORIES = ['standard', 'vip', 'balcony']
const CATEGORY_LABELS = { standard: 'Стандарт', vip: 'VIP', balcony: 'Балкон' }
const STATUS_LABELS = {
  active: 'активен',
  scheduled: 'запланирован',
  cancelled: 'отменён',
  sold_out: 'мест нет',
  finished: 'завершён',
}

export default function Sessions() {
  const queryClient = useQueryClient()

  const { data: events } = useQuery({ queryKey: ['admin', 'events'], queryFn: getAdminEvents })
  const { data: venues } = useQuery({ queryKey: ['venues'], queryFn: getVenues })

  // One sessions query per event, so the table can group them.
  const sessionQueries = useQueries({
    queries: (events ?? []).map((event) => ({
      queryKey: ['events', event.id, 'sessions'],
      queryFn: () => getEventSessions(event.id),
    })),
  })

  const [form, setForm] = useState(null)

  const { data: halls } = useQuery({
    queryKey: ['venues', form?.venueId, 'halls'],
    queryFn: () => getVenueHalls(form.venueId),
    enabled: Boolean(form?.venueId),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['events'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
    queryClient.invalidateQueries({ queryKey: ['venues'] })
  }

  const add = useMutation({
    mutationFn: createSessions,
    onSuccess: (result) => {
      invalidate()
      setForm(null)
      toast.success(creationMessage(result))
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось создать сеанс')),
  })

  const cancel = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      invalidate()
      toast.success('Сеанс отменён')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось отменить сеанс')),
  })

  const cancelSeries = useMutation({
    mutationFn: cancelSessionGroup,
    onSuccess: (result) => {
      invalidate()
      toast.success(
        `Отменено ${pluralize(result?.cancelled ?? 0, 'сеанс', 'сеанса', 'сеансов')}`,
      )
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось отменить серию')),
  })

  const submit = () => {
    if (!form.eventId) return toast.error('Выберите событие')
    if (!form.hallId) return toast.error('Выберите зал')

    const prices = PRICE_CATEGORIES.map((category) => ({
      category,
      price: Number(form.prices[category]) || 0,
    }))

    if (form.mode === 'series') {
      const problem = validateRule(form.rule)
      if (problem) return toast.error(problem)
      return add.mutate({
        event_id: Number(form.eventId),
        hall_id: Number(form.hallId),
        is_recurring: true,
        recurring: ruleToPayload(form.rule),
        prices,
      })
    }

    if (!fromDatetimeLocal(form.datetime)) return toast.error('Укажите дату и время')
    return add.mutate({
      event_id: Number(form.eventId),
      hall_id: Number(form.hallId),
      datetime: fromDatetimeLocal(form.datetime),
      prices,
    })
  }

  // Every showing with the event it belongs to, then arranged so a series
  // stays together.
  const blocks = useMemo(() => {
    const titles = new Map((events ?? []).map((event) => [event.id, event.title]))
    const all = (events ?? []).flatMap(
      (event, index) => sessionQueries[index]?.data ?? [],
    )
    return groupSessions(all).map((block) => ({
      ...block,
      title: titles.get(block.sessions[0].event_id) ?? '—',
    }))
    // sessionQueries is a new array on every render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, sessionQueries.map((query) => query.dataUpdatedAt).join()])

  const sessionRow = (session, inSeries) => (
    <tr key={session.id} className="transition-colors hover:bg-[var(--surface)]">
      <Td className={inSeries ? 'pl-8 text-[var(--muted)]' : undefined}>
        {inSeries ? '↳' : session.event_title}
      </Td>
      <Td className="font-mono2 text-xs text-[var(--muted)]">
        {formatDateTime(session.datetime)}
      </Td>
      <Td className="text-[var(--muted)]">
        {session.hall_name ?? '—'}
        {session.venue_name && (
          <span className="text-[var(--muted2)]"> · {session.venue_name}</span>
        )}
      </Td>
      <Td className="text-right font-mono2 text-xs">
        {session.seats_free} / {session.seats_total}
      </Td>
      <Td className="text-[var(--muted)]">
        {STATUS_LABELS[session.status] ?? session.status}
      </Td>
      <Td>
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="danger"
            aria-label="Отменить сеанс"
            onClick={() => {
              if (window.confirm('Отменить сеанс? Проданные билеты останутся.')) {
                cancel.mutate(session.id)
              }
            }}
          >
            <Trash2 size={13} />
          </Button>
        </div>
      </Td>
    </tr>
  )

  return (
    <AdminLayout
      title="Сеансы"
      subtitle="Сеансы с рассадкой: зал, время и цены по категориям."
      action={
        <Button
          onClick={() =>
            setForm({
              mode: 'single',
              eventId: '',
              venueId: '',
              hallId: '',
              datetime: '',
              rule: emptyRule(),
              prices: { standard: 25, vip: 60, balcony: 15 },
            })
          }
        >
          <Plus size={15} />
          Новый сеанс
        </Button>
      }
    >
      <TableShell>
        <thead>
          <tr>
            <Th>Мероприятие</Th>
            <Th>Когда</Th>
            <Th>Зал</Th>
            <Th className="text-right">Места</Th>
            <Th>Статус</Th>
            <Th className="text-right">Действия</Th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) =>
            block.kind === 'single' ? (
              sessionRow(block.sessions[0], false)
            ) : (
              // A series gets a header of its own: the showings under it are
              // one act of scheduling and are cancelled as one. The rows stay
              // siblings in this same table rather than a table of their own,
              // or their columns would not line up with everything above.
              <Fragment key={block.key}>
                <tr>
                  <Td colSpan={6} className="!px-0 !py-0">
                    <div className="flex flex-wrap items-center gap-3 bg-[var(--surface)] px-4 py-2.5">
                      <Repeat size={14} className="shrink-0 text-[var(--accent)]" />
                      <span className="min-w-0 flex-1 truncate text-sm">{block.title}</span>
                      <span className="shrink-0 rounded-full border border-[var(--border2)] px-2.5 py-1 font-mono2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                        Серия: {pluralize(block.sessions.length, 'сеанс', 'сеанса', 'сеансов')}
                      </span>
                      <Button
                        size="sm"
                        variant="danger"
                        loading={
                          cancelSeries.isPending && cancelSeries.variables === block.groupId
                        }
                        onClick={() => {
                          if (
                            window.confirm(
                              `Отменить все ${block.sessions.length} сеансов серии «${block.title}»?`,
                            )
                          ) {
                            cancelSeries.mutate(block.groupId)
                          }
                        }}
                      >
                        Отменить серию
                      </Button>
                    </div>
                  </Td>
                </tr>
                {block.sessions.map((session) => sessionRow(session, true))}
              </Fragment>
            ),
          )}
          {blocks.length === 0 && (
            <tr>
              <Td className="text-center text-[var(--muted)]" colSpan={6}>
                Сеансов пока нет. Создайте площадку и зал, затем сеанс.
              </Td>
            </tr>
          )}
        </tbody>
      </TableShell>

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.mode === 'series' ? 'Повторяющиеся сеансы' : 'Новый сеанс'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Отмена
            </Button>
            <Button loading={add.isPending} onClick={submit}>
              Создать
            </Button>
          </>
        }
      >
        {form && (
          <div className="space-y-4">
            <div
              role="radiogroup"
              aria-label="Вид сеанса"
              className="flex gap-1 rounded-[var(--radius-sm)] border border-[var(--border)] p-1"
            >
              {[
                { key: 'single', label: 'Разовый сеанс' },
                { key: 'series', label: 'Повторяющиеся сеансы' },
              ].map((option) => {
                const active = form.mode === option.key
                return (
                  <button
                    key={option.key}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setForm({ ...form, mode: option.key })}
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

            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Событие
              </span>
              <Select
                value={form.eventId}
                onChange={(value) => setForm({ ...form, eventId: value })}
                placeholder="— выберите —"
                aria-label="Событие"
                options={(events ?? []).map((event) => ({
                  value: String(event.id),
                  label: event.title,
                }))}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                  Площадка
                </span>
                <Select
                  value={form.venueId}
                  onChange={(value) => setForm({ ...form, venueId: value, hallId: '' })}
                  placeholder="— выберите —"
                  aria-label="Площадка"
                  options={(venues ?? []).map((venue) => ({
                    value: String(venue.id),
                    label: venue.name,
                  }))}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                  Зал
                </span>
                <Select
                  value={form.hallId}
                  disabled={!form.venueId}
                  onChange={(value) => setForm({ ...form, hallId: value })}
                  placeholder="— выберите —"
                  aria-label="Зал"
                  options={(halls ?? []).map((hall) => ({
                    value: String(hall.id),
                    label: `${hall.name} (${hall.seats_count})`,
                  }))}
                />
              </label>
            </div>

            {form.mode === 'series' ? (
              <RecurrenceEditor
                value={form.rule}
                onChange={(rule) => setForm({ ...form, rule })}
              />
            ) : (
              <Input
                label="Дата и время"
                name="datetime"
                type="datetime-local"
                value={form.datetime}
                onChange={(e) => setForm({ ...form, datetime: e.target.value })}
                required
              />
            )}

            <div>
              <span className="mb-2 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Цены по категориям
              </span>
              <div className="grid gap-3 sm:grid-cols-3">
                {PRICE_CATEGORIES.map((category) => (
                  <Input
                    key={category}
                    label={CATEGORY_LABELS[category] ?? category}
                    name={category}
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.prices[category]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        prices: { ...form.prices, [category]: e.target.value },
                      })
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}
