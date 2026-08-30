import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Grid3x3, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiError } from '../../api/client'
import {
  createHall,
  createVenue,
  deleteHall,
  deleteVenue,
  getVenueHalls,
  getVenues,
} from '../../api/venues'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import VenueStaff from '../../components/admin/VenueStaff'
import HallGridEditor, { gridToLayout, makeGrid } from '../../components/seats/HallGridEditor'
import AdminLayout, { TableShell, Td, Th } from './AdminLayout'

// Values are what the API stores; the map holds what a person reads.
const VENUE_TYPES = ['cinema', 'theater', 'concert', 'stadium', 'other']
const VENUE_TYPE_LABELS = {
  cinema: 'Кинотеатр',
  theater: 'Театр',
  concert: 'Концертный зал',
  stadium: 'Стадион',
  other: 'Другое',
}

const EMPTY_VENUE = { name: '', type: 'theater', address: '' }
const EMPTY_HALL = { name: '', rows: 5, cols: 8 }

/** Pill tabs matching the admin strip above. */
function Tab({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-selected={active}
      role="tab"
      className={[
        'rounded-[var(--radius-sm)] px-3.5 py-1.5 text-sm transition-colors duration-150',
        active
          ? 'bg-[var(--accent)] font-medium text-[var(--bg)]'
          : 'text-[var(--muted)] hover:text-[var(--text)]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

/** Halls of one venue, with the creation form folded out underneath. */
function HallsTab({ venueId }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState(null)

  const { data: halls, isLoading } = useQuery({
    queryKey: ['venues', venueId, 'halls'],
    queryFn: () => getVenueHalls(venueId),
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['venues', venueId, 'halls'] })
    // halls_count on the venue row moves with it.
    queryClient.invalidateQueries({ queryKey: ['venues'] })
  }

  const add = useMutation({
    mutationFn: createHall,
    onSuccess: (hall) => {
      refresh()
      setForm(null)
      toast.success(`Зал создан, мест: ${hall.seats_count}`)
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось создать зал')),
  })

  const remove = useMutation({
    mutationFn: deleteHall,
    onSuccess: () => {
      refresh()
      toast.success('Зал удалён')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось удалить зал')),
  })

  // Resizing keeps whatever was already painted, inside the new bounds.
  const resize = (rows, cols) =>
    setForm((current) => ({
      ...current,
      rows,
      cols,
      grid: makeGrid(rows, cols, current.grid),
    }))

  const submit = () => {
    if (!form.name.trim()) {
      toast.error('Укажите название зала')
      return
    }
    add.mutate({
      venue_id: venueId,
      name: form.name.trim(),
      rows: form.rows,
      cols: form.cols,
      layout_json: gridToLayout(form.grid),
    })
  }

  return (
    <div>
      {isLoading ? (
        <p className="text-sm text-[var(--muted)]">Загрузка залов…</p>
      ) : halls?.length ? (
        <ul className="divide-y divide-[var(--border)] rounded-[var(--radius-sm)] border border-[var(--border)]">
          {halls.map((hall) => (
            <li
              key={hall.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5"
            >
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <Grid3x3 size={14} className="shrink-0 text-[var(--accent)]" />
                <span className="truncate">{hall.name}</span>
                <span className="shrink-0 font-mono2 text-xs text-[var(--muted2)]">
                  {hall.rows}×{hall.cols} · {hall.seats_count} мест
                </span>
              </span>
              <Button
                size="sm"
                variant="danger"
                aria-label={`Удалить ${hall.name}`}
                loading={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Удалить зал "${hall.name}"?`)) remove.mutate(hall.id)
                }}
              >
                <Trash2 size={13} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[var(--muted)]">Залов пока нет.</p>
      )}

      {form ? (
        <div className="mt-4 space-y-4 rounded-[var(--radius-sm)] border border-[var(--border)] p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Название зала"
              name="hallName"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="Большой зал"
              required
            />
            <Input
              label="Рядов"
              name="rows"
              type="number"
              min={1}
              max={40}
              value={form.rows}
              onChange={(event) =>
                resize(Math.max(1, Math.min(40, Number(event.target.value) || 1)), form.cols)
              }
            />
            <Input
              label="Мест в ряду"
              name="cols"
              type="number"
              min={1}
              max={40}
              value={form.cols}
              onChange={(event) =>
                resize(form.rows, Math.max(1, Math.min(40, Number(event.target.value) || 1)))
              }
            />
          </div>

          <p className="text-xs text-[var(--muted2)]">
            Нарисуйте схему — места создадутся автоматически.
          </p>
          {/* The editor scrolls sideways on its own, so a wide hall does not
              stretch the dialog. */}
          <HallGridEditor grid={form.grid} onChange={(grid) => setForm({ ...form, grid })} />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setForm(null)}>
              Отмена
            </Button>
            <Button loading={add.isPending} onClick={submit}>
              Создать зал
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() =>
            setForm({ ...EMPTY_HALL, grid: makeGrid(EMPTY_HALL.rows, EMPTY_HALL.cols) })
          }
        >
          <Plus size={14} />
          Добавить зал
        </Button>
      )}
    </div>
  )
}

/** Halls and staff of one venue, behind two tabs. */
function VenueModal({ venue, onClose }) {
  const [tab, setTab] = useState('halls')

  return (
    <Modal
      open={Boolean(venue)}
      onClose={onClose}
      size="md"
      title={venue?.name ?? ''}
      subtitle={
        venue
          ? [VENUE_TYPE_LABELS[venue.type] ?? venue.type, venue.address]
              .filter(Boolean)
              .join(' · ')
          : undefined
      }
    >
      {venue && (
        <>
          <div role="tablist" className="mb-5 flex gap-1">
            <Tab active={tab === 'halls'} onClick={() => setTab('halls')}>
              Залы
            </Tab>
            <Tab active={tab === 'staff'} onClick={() => setTab('staff')}>
              Персонал
            </Tab>
          </div>

          {/* Remounted per venue, so switching venues never shows the previous
              one's halls while the new request is in flight. */}
          {tab === 'halls' ? (
            <HallsTab key={venue.id} venueId={venue.id} />
          ) : (
            <VenueStaff key={venue.id} venueId={venue.id} bare />
          )}
        </>
      )}
    </Modal>
  )
}

export default function Venues() {
  const queryClient = useQueryClient()

  const { data: venues, isLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: getVenues,
  })

  const [venueForm, setVenueForm] = useState(null)
  const [detail, setDetail] = useState(null)

  const refreshVenues = () => queryClient.invalidateQueries({ queryKey: ['venues'] })

  const addVenue = useMutation({
    mutationFn: createVenue,
    onSuccess: () => {
      refreshVenues()
      setVenueForm(null)
      toast.success('Площадка создана')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось создать площадку')),
  })

  const removeVenue = useMutation({
    mutationFn: deleteVenue,
    onSuccess: (_, id) => {
      refreshVenues()
      if (detail?.id === id) setDetail(null)
      toast.success('Площадка удалена')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось удалить площадку')),
  })

  return (
    <AdminLayout
      title="Площадки"
      subtitle="Нажмите на площадку, чтобы открыть залы и персонал."
      action={
        <Button onClick={() => setVenueForm({ ...EMPTY_VENUE })}>
          <Plus size={15} />
          Новая площадка
        </Button>
      }
    >
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-[var(--radius)] bg-[var(--surface)]" />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Название</Th>
              <Th>Тип</Th>
              <Th>Адрес</Th>
              <Th className="text-right">Залов</Th>
              <Th className="text-right">Действия</Th>
            </tr>
          </thead>
          <tbody>
            {venues?.map((venue) => (
              <tr
                key={venue.id}
                onClick={() => setDetail(venue)}
                // Reachable without a mouse: the row is the only way in.
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setDetail(venue)
                  }
                }}
                className="cursor-pointer transition-colors hover:bg-[var(--surface)] focus:bg-[var(--surface)] focus:outline-none"
              >
                <Td>{venue.name}</Td>
                <Td className="text-[var(--muted)]">
                  {VENUE_TYPE_LABELS[venue.type] ?? venue.type}
                </Td>
                <Td className="text-[var(--muted)]">{venue.address || '—'}</Td>
                <Td className="text-right font-mono2 text-xs">{venue.halls_count}</Td>
                <Td>
                  {/* The buttons sit inside a clickable row, so their clicks
                      must not also open the dialog. */}
                  <div
                    className="flex justify-end gap-1.5"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <Button size="sm" variant="ghost" onClick={() => setDetail(venue)}>
                      <Plus size={13} /> Зал
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={`Удалить ${venue.name}`}
                      onClick={() => {
                        if (window.confirm(`Удалить "${venue.name}" со всеми залами?`)) {
                          removeVenue.mutate(venue.id)
                        }
                      }}
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </Td>
              </tr>
            ))}
            {venues?.length === 0 && (
              <tr>
                <Td className="text-center text-[var(--muted)]" colSpan={5}>
                  Площадок пока нет.
                </Td>
              </tr>
            )}
          </tbody>
        </TableShell>
      )}

      <VenueModal venue={detail} onClose={() => setDetail(null)} />

      <Modal
        open={Boolean(venueForm)}
        onClose={() => setVenueForm(null)}
        size="md"
        title="Новая площадка"
        footer={
          <>
            <Button variant="ghost" onClick={() => setVenueForm(null)}>
              Отмена
            </Button>
            <Button
              loading={addVenue.isPending}
              onClick={() => {
                if (!venueForm.name.trim()) {
                  toast.error('Укажите название')
                  return
                }
                addVenue.mutate({
                  name: venueForm.name.trim(),
                  type: venueForm.type,
                  address: venueForm.address.trim() || null,
                })
              }}
            >
              Создать
            </Button>
          </>
        }
      >
        {venueForm && (
          <div className="space-y-4">
            <Input
              label="Название"
              name="name"
              value={venueForm.name}
              onChange={(e) => setVenueForm({ ...venueForm, name: e.target.value })}
              placeholder="Большой театр"
              required
            />
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Тип
              </span>
              <Select
                value={venueForm.type}
                onChange={(type) => setVenueForm({ ...venueForm, type })}
                aria-label="Тип площадки"
                options={VENUE_TYPES.map((type) => ({
                  value: type,
                  label: VENUE_TYPE_LABELS[type] ?? type,
                }))}
              />
            </label>
            <Input
              label="Адрес"
              name="address"
              value={venueForm.address}
              onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })}
              placeholder="ул. Главная, 1"
            />
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}
