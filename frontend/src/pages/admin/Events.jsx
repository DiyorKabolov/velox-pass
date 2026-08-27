import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getAdminEvents } from '../../api/admin'
import { deleteEvent, updateEvent } from '../../api/events'
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
    mutationFn: ({ id, payload }) => updateEvent(id, payload),
    onSuccess: () => {
      invalidate()
      setEditing(null)
      toast.success('Event updated')
    },
    onError: (error) => toast.error(apiError(error, 'Could not update the event')),
  })

  const remove = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => {
      invalidate()
      toast.success('Event deleted')
    },
    onError: (error) => toast.error(apiError(error, 'Could not delete the event')),
  })

  const handleSave = () => {
    const problem = validate(editing.form)
    if (problem) {
      toast.error(problem)
      return
    }
    save.mutate({ id: editing.id, payload: toPayload(editing.form) })
  }

  const handleDelete = (event) => {
    if (window.confirm(`Delete "${event.title}"? Its tickets go with it.`)) {
      remove.mutate(event.id)
    }
  }

  return (
    <AdminLayout
      title="Events"
      subtitle="Create, edit and remove what appears on the афиша."
      action={
        <Button onClick={() => navigate('/admin/events/new')} className="shrink-0">
          <Plus size={15} />
          New Event
        </Button>
      }
    >
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-[var(--radius)] bg-[var(--surface)]" />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>Date</Th>
              <Th>Location</Th>
              <Th className="text-right">Capacity</Th>
              <Th className="text-right">Sold</Th>
              <Th className="text-right">Actions</Th>
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
                      aria-label={`Edit ${event.title}`}
                      onClick={() => setEditing({ id: event.id, form: toFormValue(event) })}
                    >
                      <Pencil size={13} />
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={`Delete ${event.title}`}
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
                  No events yet — create the first one.
                </Td>
              </tr>
            )}
          </tbody>
        </TableShell>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit event"
        subtitle={editing?.form.title}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} loading={save.isPending}>
              Save changes
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
