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
  deleteVenueImage,
  getVenueHalls,
  getVenues,
  uploadVenueImage,
} from '../../api/venues'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Modal from '../../components/ui/Modal'
import Select from '../../components/ui/Select'
import VenueStaff from '../../components/admin/VenueStaff'
import EventImageUpload from '../../components/admin/EventImageUpload'
import HallGridEditor, { gridToLayout, makeGrid } from '../../components/seats/HallGridEditor'
// Shared with the public catalogue, so a venue keeps one name and one colour.
import { VENUE_TYPES, VENUE_TYPE_LABELS } from '../../utils/venueTypes'
import AdminLayout, { TableShell, Td, Th } from './AdminLayout'

const EMPTY_VENUE = { name: '', type: 'theater', address: '', description: '' }
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

/**
 * The venue's photo, sent the moment it is chosen.
 *
 * Unlike an event, which may still be unsaved when its artwork is picked, a
 * venue always exists by the time this is on screen -- so there is nothing to
 * hold the file for, and the upload happens straight away.
 */
function PhotoTab({ venue }) {
  const queryClient = useQueryClient()
  const [stored, setStored] = useState(venue.image_url ?? null)
  const [pending, setPending] = useState(null)

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['venues'] })
    queryClient.invalidateQueries({ queryKey: ['venues', 'public'] })
  }

  const upload = useMutation({
    mutationFn: (file) => uploadVenueImage(venue.id, file),
    onSuccess: (updated) => {
      setStored(updated.image_url)
      setPending(null)
      refresh()
      toast.success('Фото обновлено')
    },
    onError: (error) => {
      setPending(null)
      toast.error(apiError(error, 'Не удалось загрузить фото'))
    },
  })

  const remove = useMutation({
    mutationFn: () => deleteVenueImage(venue.id),
    onSuccess: () => {
      setStored(null)
      refresh()
      toast.success('Фото удалено')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось удалить фото')),
  })

  return (
    <div className="space-y-3">
      <EventImageUpload
        alt={`Фото площадки ${venue.name}`}
        value={stored}
        // Shown from the local file while the upload is in flight, so the new
        // photo appears at once instead of after the round trip.
        file={pending}
        busy={upload.isPending || remove.isPending}
        onPick={(file) => {
          setPending(file)
          upload.mutate(file)
        }}
        onRemove={() => remove.mutate()}
      />
      <p className="text-xs text-[var(--muted2)]">
        Показывается в списке площадок. Лучше горизонтальное фото — его видно
        полосой 200×88.
      </p>
    </div>
  )
}

/** Halls, staff and photo of one venue, behind three tabs. */
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
            <Tab active={tab === 'photo'} onClick={() => setTab('photo')}>
              Фото
            </Tab>
          </div>

          {/* Remounted per venue, so switching venues never shows the previous
              one's halls while the new request is in flight. */}
          {tab === 'halls' && <HallsTab key={venue.id} venueId={venue.id} />}
          {tab === 'staff' && <VenueStaff key={venue.id} venueId={venue.id} bare />}
          {tab === 'photo' && <PhotoTab key={venue.id} venue={venue} />}
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
                  description: venueForm.description.trim() || null,
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
            <label className="block" htmlFor="venue-description">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Описание
              </span>
              <textarea
                id="venue-description"
                rows={3}
                value={venueForm.description}
                onChange={(e) =>
                  setVenueForm({ ...venueForm, description: e.target.value })
                }
                placeholder="Что стоит знать посетителю — залы, парковка, как добраться."
                className="w-full resize-y rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] px-3.5 py-2.5 text-[var(--text)] outline-none transition-all duration-150 placeholder:text-[var(--muted2)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/25"
              />
              <span className="mt-1.5 block text-xs text-[var(--muted2)]">
                Показывается на публичной странице площадки.
              </span>
            </label>
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}
