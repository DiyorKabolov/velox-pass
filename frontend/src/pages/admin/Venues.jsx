import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Grid3x3, Plus, Trash2 } from 'lucide-react'
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

function HallRows({ venueId, onDeleted }) {
  const { data: halls, isLoading } = useQuery({
    queryKey: ['venues', venueId, 'halls'],
    queryFn: () => getVenueHalls(venueId),
  })

  if (isLoading) {
    return <p className="px-4 py-3 text-sm text-[var(--muted)]">Загрузка залов…</p>
  }
  if (!halls?.length) {
    return <p className="px-4 py-3 text-sm text-[var(--muted)]">Залов пока нет.</p>
  }

  return (
    <ul className="divide-y divide-[var(--border)]">
      {halls.map((hall) => (
        <li key={hall.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <Grid3x3 size={14} className="shrink-0 text-[var(--accent)]" />
            <span className="truncate">{hall.name}</span>
            <span className="font-mono2 text-xs text-[var(--muted2)]">
              {hall.rows}×{hall.cols} · {hall.seats_count} мест
            </span>
          </span>
          <Button
            size="sm"
            variant="danger"
            aria-label={`Удалить ${hall.name}`}
            onClick={() => {
              if (window.confirm(`Удалить зал "${hall.name}"?`)) onDeleted(hall.id)
            }}
          >
            <Trash2 size={13} />
          </Button>
        </li>
      ))}
    </ul>
  )
}

const EMPTY_VENUE = { name: '', type: 'theater', address: '' }
const EMPTY_HALL = { name: '', rows: 5, cols: 8 }

export default function Venues() {
  const queryClient = useQueryClient()

  const { data: venues, isLoading } = useQuery({
    queryKey: ['venues'],
    queryFn: getVenues,
  })

  const [expanded, setExpanded] = useState(null)
  const [venueForm, setVenueForm] = useState(null)
  // { venueId, form, grid } while the hall dialog is open.
  const [hallForm, setHallForm] = useState(null)

  const refreshVenues = () => queryClient.invalidateQueries({ queryKey: ['venues'] })
  const refreshHalls = (venueId) =>
    queryClient.invalidateQueries({ queryKey: ['venues', venueId, 'halls'] })

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
    onSuccess: () => {
      refreshVenues()
      toast.success('Площадка удалена')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось удалить площадку')),
  })

  const addHall = useMutation({
    mutationFn: createHall,
    onSuccess: (hall) => {
      refreshHalls(hall.venue_id)
      refreshVenues()
      setHallForm(null)
      toast.success(`Зал создан, мест: ${hall.seats_count}`)
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось создать зал')),
  })

  const removeHall = useMutation({
    mutationFn: deleteHall,
    onSuccess: () => {
      refreshHalls(expanded)
      refreshVenues()
      toast.success('Зал удалён')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось удалить зал')),
  })

  const openHallDialog = (venueId) =>
    setHallForm({
      venueId,
      form: { ...EMPTY_HALL },
      grid: makeGrid(EMPTY_HALL.rows, EMPTY_HALL.cols),
    })

  const resizeGrid = (rows, cols) =>
    setHallForm((current) => ({
      ...current,
      form: { ...current.form, rows, cols },
      // Keep whatever the person already painted inside the new bounds.
      grid: makeGrid(rows, cols, current.grid),
    }))

  const submitHall = () => {
    if (!hallForm.form.name.trim()) {
      toast.error('Укажите название зала')
      return
    }
    addHall.mutate({
      venue_id: hallForm.venueId,
      name: hallForm.form.name.trim(),
      rows: hallForm.form.rows,
      cols: hallForm.form.cols,
      layout_json: gridToLayout(hallForm.grid),
    })
  }

  return (
    <AdminLayout
      title="Площадки"
      subtitle="Площадки, залы и схемы рассадки."
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
              <Th className="w-10" />
              <Th>Название</Th>
              <Th>Тип</Th>
              <Th>Адрес</Th>
              <Th className="text-right">Залов</Th>
              <Th className="text-right">Действия</Th>
            </tr>
          </thead>
          <tbody>
            {venues?.map((venue) => {
              const isOpen = expanded === venue.id
              return [
                <tr key={venue.id} className="transition-colors hover:bg-[var(--surface)]">
                  <Td>
                    <button
                      type="button"
                      aria-label={isOpen ? 'Свернуть залы' : 'Показать залы'}
                      onClick={() => setExpanded(isOpen ? null : venue.id)}
                      className="rounded p-1 text-[var(--muted)] transition-colors hover:text-[var(--text)]"
                    >
                      {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                    </button>
                  </Td>
                  <Td>{venue.name}</Td>
                  <Td className="text-[var(--muted)]">
                    {VENUE_TYPE_LABELS[venue.type] ?? venue.type}
                  </Td>
                  <Td className="text-[var(--muted)]">{venue.address || '—'}</Td>
                  <Td className="text-right font-mono2 text-xs">{venue.halls_count}</Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => openHallDialog(venue.id)}>
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
                </tr>,
                isOpen && (
                  <tr key={`${venue.id}-halls`}>
                    <Td colSpan={6} className="bg-[var(--bg)] p-0">
                      <HallRows venueId={venue.id} onDeleted={(id) => removeHall.mutate(id)} />
                      {/* Mounted only while the row is expanded, so the staff
                          list is fetched for one venue at a time. */}
                      <VenueStaff venueId={venue.id} />
                    </Td>
                  </tr>
                ),
              ]
            })}
            {venues?.length === 0 && (
              <tr>
                <Td className="text-center text-[var(--muted)]" colSpan={6}>
                  Площадок пока нет.
                </Td>
              </tr>
            )}
          </tbody>
        </TableShell>
      )}

      <Modal
        open={Boolean(venueForm)}
        onClose={() => setVenueForm(null)}
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
              placeholder="Большой концертный зал"
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

      <Modal
        open={Boolean(hallForm)}
        onClose={() => setHallForm(null)}
        title="Новый зал"
        subtitle="Нарисуйте схему — места создадутся автоматически"
        footer={
          <>
            <Button variant="ghost" onClick={() => setHallForm(null)}>
              Отмена
            </Button>
            <Button loading={addHall.isPending} onClick={submitHall}>
              Создать зал
            </Button>
          </>
        }
      >
        {hallForm && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Название зала"
                name="hallName"
                value={hallForm.form.name}
                onChange={(e) =>
                  setHallForm({
                    ...hallForm,
                    form: { ...hallForm.form, name: e.target.value },
                  })
                }
                placeholder="Большой зал"
                required
              />
              <Input
                label="Рядов"
                name="rows"
                type="number"
                min={1}
                max={40}
                value={hallForm.form.rows}
                onChange={(e) =>
                  resizeGrid(
                    Math.max(1, Math.min(40, Number(e.target.value) || 1)),
                    hallForm.form.cols,
                  )
                }
              />
              <Input
                label="Мест в ряду"
                name="cols"
                type="number"
                min={1}
                max={40}
                value={hallForm.form.cols}
                onChange={(e) =>
                  resizeGrid(
                    hallForm.form.rows,
                    Math.max(1, Math.min(40, Number(e.target.value) || 1)),
                  )
                }
              />
            </div>

            <HallGridEditor
              grid={hallForm.grid}
              onChange={(grid) => setHallForm({ ...hallForm, grid })}
            />
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}
