import { useState } from 'react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { getAdminEvents } from '../../api/admin'
import { getEventSessions } from '../../api/events'
import { createSession, deleteSession } from '../../api/sessions'
import { getVenueHalls, getVenues } from '../../api/venues'
import Select from '../../components/ui/Select'
import { apiError } from '../../api/client'
import { formatDateTime, fromDatetimeLocal } from '../../utils/dates'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
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
  }

  const add = useMutation({
    mutationFn: createSession,
    onSuccess: () => {
      invalidate()
      setForm(null)
      toast.success('Сеанс создан')
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

  const submit = () => {
    if (!form.eventId) return toast.error('Выберите событие')
    if (!form.hallId) return toast.error('Выберите зал')
    if (!fromDatetimeLocal(form.datetime)) return toast.error('Укажите дату и время')

    add.mutate({
      event_id: Number(form.eventId),
      hall_id: Number(form.hallId),
      datetime: fromDatetimeLocal(form.datetime),
      prices: PRICE_CATEGORIES.map((category) => ({
        category,
        price: Number(form.prices[category]) || 0,
      })),
    })
  }

  const rows = (events ?? []).flatMap((event, index) =>
    (sessionQueries[index]?.data ?? []).map((session) => ({ event, session })),
  )

  return (
    <AdminLayout
      title="Сеансы"
      subtitle="Сеансы с рассадкой: зал, время и цены по категориям."
      action={
        <Button
          onClick={() =>
            setForm({
              eventId: '',
              venueId: '',
              hallId: '',
              datetime: '',
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
          {rows.map(({ event, session }) => (
            <tr key={session.id} className="transition-colors hover:bg-[var(--surface)]">
              <Td>{event.title}</Td>
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
          ))}
          {rows.length === 0 && (
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
        title="Новый сеанс"
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

            <Input
              label="Дата и время"
              name="datetime"
              type="datetime-local"
              value={form.datetime}
              onChange={(e) => setForm({ ...form, datetime: e.target.value })}
              required
            />

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
