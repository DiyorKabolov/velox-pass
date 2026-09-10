import { Fragment, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronRight, Pencil, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getAdminEvents } from '../../api/admin'
import {
  deleteEvent,
  deleteEventImage,
  updateEvent,
  uploadEventImage,
} from '../../api/events'
import { setEventTemplate } from '../../api/pdfTemplates'
import { apiError } from '../../api/client'
import { formatShortDate } from '../../utils/dates'
import { availableLabel, capacityLabel, sessionsLabel } from '../../utils/capacity'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import EventEditor from '../../components/admin/EventEditor'
import EventSessions from '../../components/admin/EventSessions'
import { toFormValue, toPayload, validate } from '../../components/admin/eventForm'
import AdminLayout, { TableShell, Td, Th } from './AdminLayout'

export default function Events() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const { data: events, isLoading } = useQuery({
    queryKey: ['admin', 'events'],
    queryFn: getAdminEvents,
  })

  // null = closed. Otherwise { id, form } for the event being edited.
  const [editing, setEditing] = useState(null)
  // Ids of the rows showing their sessions. A set rather than a single id, so
  // two events can be compared side by side.
  const [expanded, setExpanded] = useState(() => new Set())

  const toggle = (eventId) =>
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(eventId)) next.add(eventId)
      return next
    })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
    queryClient.invalidateQueries({ queryKey: ['events'] })
  }

  const save = useMutation({
    mutationFn: async ({ id, payload, templateId, imageFile, imageCleared }) => {
      const event = await updateEvent(id, payload)
      // Its own endpoint, per the API: the event schemas do not carry it.
      await setEventTemplate(id, templateId ?? null)
      // A newly chosen file wins; clearing without choosing one removes it.
      if (imageFile) await uploadEventImage(id, imageFile)
      else if (imageCleared) await deleteEventImage(id)
      return event
    },
    onSuccess: () => {
      invalidate()
      setEditing(null)
      toast.success('Мероприятие обновлено')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось обновить мероприятие')),
  })

  const remove = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      invalidate()
      toast.success('Мероприятие удалено')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось удалить мероприятие')),
  })

  const handleSave = () => {
    const problem = validate(editing.form)
    if (problem) {
      toast.error(problem)
      return
    }
    save.mutate({
      id: editing.id,
      payload: toPayload(editing.form),
      templateId: editing.form.template_id,
      imageFile: editing.form.image_file,
      // Was there a picture when the dialog opened, and is it gone now?
      imageCleared: Boolean(editing.original?.image_url) && !editing.form.image_url,
    })
  }

  const handleDelete = (event) => {
    if (window.confirm(`Удалить «${event.title}»? Это действие нельзя отменить.`)) {
      remove.mutate(event.id)
    }
  }

  return (
    <AdminLayout
      title="Мероприятия"
      subtitle="Создание, редактирование и удаление мероприятий афиши."
      action={
        <Button onClick={() => navigate('/admin/events/new')} className="shrink-0">
          <Plus size={15} />
          Новое мероприятие
        </Button>
      }
    >
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-[var(--radius)] bg-[var(--surface)]" />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th className="w-8" />
              <Th>Название</Th>
              <Th>Дата</Th>
              <Th>Место</Th>
              <Th className="text-right">Продано / всего</Th>
              <Th className="text-right">Свободно</Th>
              <Th className="text-right">Действия</Th>
            </tr>
          </thead>
          <tbody>
            {events?.map((event) => {
              const open = expanded.has(event.id)
              return (
                <Fragment key={event.id}>
                  <tr className="transition-colors hover:bg-[var(--surface)]">
                    <Td className="pr-0">
                      <button
                        type="button"
                        aria-expanded={open}
                        aria-label={`Сеансы: ${event.title}`}
                        onClick={() => toggle(event.id)}
                        className="flex h-6 w-6 items-center justify-center rounded text-[var(--muted)] transition-colors hover:bg-[var(--surface2)] hover:text-[var(--text)]"
                      >
                        <ChevronRight
                          size={14}
                          className={`transition-transform duration-150 ${open ? 'rotate-90' : ''}`}
                        />
                      </button>
                    </Td>
                    <Td>
                      <span className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: event.card_accent }}
                        />
                        {event.title}
                      </span>
                    </Td>
                    <Td className="font-mono2 text-xs text-[var(--muted)]">
                      {formatShortDate(event.date)}
                    </Td>
                    <Td className="text-[var(--muted)]">{event.location || '—'}</Td>
                    <Td className="text-right font-mono2 text-xs whitespace-nowrap">
                      {capacityLabel(event)}
                      {/* Seated events keep no capacity of their own; it is the sum
                          over their showings, which is worth stating. */}
                      {event.has_seats && sessionsLabel(event) && (
                        <span className="ml-1.5 text-[10px] text-[var(--muted2)]">
                          ({sessionsLabel(event)})
                        </span>
                      )}
                    </Td>
                    <Td className="text-right font-mono2 text-xs">
                      {availableLabel(event)}
                    </Td>
                    <Td>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          aria-label={`Редактировать ${event.title}`}
                          onClick={() =>
                            // The untouched event is kept alongside the form so the
                            // save can tell a removed picture from one that was
                            // never there.
                            setEditing({
                              id: event.id,
                              original: event,
                              form: toFormValue(event),
                            })
                          }
                        >
                          <Pencil size={13} />
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          aria-label={`Удалить ${event.title}`}
                          loading={remove.isPending && remove.variables === event.id}
                          onClick={() => handleDelete(event)}
                        >
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </Td>
                  </tr>

                  {open && (
                    <tr>
                      {/* One cell across the whole table rather than a row that
                          tries to line up with the columns above: the breakdown has
                          columns of its own and would not fit theirs. */}
                      <Td colSpan={7} className="bg-[var(--bg)] p-3">
                        <EventSessions eventId={event.id} />
                      </Td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
            {events?.length === 0 && (
              <tr>
                <Td className="text-center text-[var(--muted)]" colSpan={7}>
                  Мероприятий пока нет — создайте первое.
                </Td>
              </tr>
            )}
          </tbody>
        </TableShell>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Редактировать мероприятие"
        subtitle={editing?.form.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Отмена
            </Button>
            <Button onClick={handleSave} loading={save.isPending}>
              Сохранить
            </Button>
          </>
        }
      >
        {editing && (
          <EventEditor
            form={editing.form}
            onChange={(form) => setEditing((current) => ({ ...current, form }))}
          />
        )}
      </Modal>
    </AdminLayout>
  )
}
