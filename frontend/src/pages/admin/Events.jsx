import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getAdminEvents } from '../../api/admin'
import { deleteEvent, updateEvent } from '../../api/events'
import { setEventTemplate } from '../../api/pdfTemplates'
import { apiError } from '../../api/client'
import { formatShortDate } from '../../utils/dates'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import EventEditor from '../../components/admin/EventEditor'
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
    queryClient.invalidateQueries({ queryKey: ['events'] })
  }

  const save = useMutation({
    mutationFn: async ({ id, payload, templateId }) => {
      const event = await updateEvent(id, payload)
      // Its own endpoint, per the API: the event schemas do not carry it.
      await setEventTemplate(id, templateId ?? null)
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
              <Th>Название</Th>
              <Th>Дата</Th>
              <Th>Место</Th>
              <Th className="text-right">Вместимость</Th>
              <Th className="text-right">Продано</Th>
              <Th className="text-right">Действия</Th>
            </tr>
          </thead>
          <tbody>
            {events?.map((event) => (
              <tr key={event.id} className="transition-colors hover:bg-[var(--surface)]">
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
                <Td className="text-right font-mono2 text-xs">{event.capacity || '∞'}</Td>
                <Td className="text-right font-mono2 text-xs">{event.tickets_sold}</Td>
                <Td>
                  <div className="flex justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Редактировать ${event.title}`}
                      onClick={() => setEditing({ id: event.id, form: toFormValue(event) })}
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
            ))}
            {events?.length === 0 && (
              <tr>
                <Td className="text-center text-[var(--muted)]" colSpan={6}>
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
