import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Pencil, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { deleteEvent, getAdminEvents, updateEvent } from '../../api/admin'
import { apiError } from '../../api/client'
import { formatShortDate } from '../../utils/dates'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import AdminLayout, { TableShell, Td, Th } from './AdminLayout'

export default function Events() {
  const queryClient = useQueryClient()
  const { data: events, isLoading } = useQuery({
    queryKey: ['admin', 'events'],
    queryFn: getAdminEvents,
  })

  const [editingId, setEditingId] = useState(null)
  const [draft, setDraft] = useState({ title: '', location: '', capacity: 0 })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
    queryClient.invalidateQueries({ queryKey: ['events'] })
  }

  const save = useMutation({
    mutationFn: ({ id, payload }) => updateEvent(id, payload),
    onSuccess: () => {
      invalidate()
      setEditingId(null)
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

  const startEdit = (event) => {
    setEditingId(event.id)
    setDraft({
      title: event.title,
      location: event.location ?? '',
      capacity: event.capacity ?? 0,
    })
  }

  const handleDelete = (event) => {
    if (window.confirm(`Delete "${event.title}" and all of its tickets?`)) {
      remove.mutate(event.id)
    }
  }

  return (
    <AdminLayout title="Events" subtitle="Edit the афиша inline.">
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
            {events?.map((event) =>
              editingId === event.id ? (
                <tr key={event.id} className="bg-[var(--surface)]">
                  <Td>
                    <Input
                      name="title"
                      value={draft.title}
                      onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                    />
                  </Td>
                  <Td className="font-mono2 text-xs text-[var(--muted)]">
                    {formatShortDate(event.date)}
                  </Td>
                  <Td>
                    <Input
                      name="location"
                      value={draft.location}
                      onChange={(e) => setDraft({ ...draft, location: e.target.value })}
                    />
                  </Td>
                  <Td>
                    <Input
                      name="capacity"
                      type="number"
                      min={0}
                      value={draft.capacity}
                      onChange={(e) =>
                        setDraft({ ...draft, capacity: Number(e.target.value) })
                      }
                    />
                  </Td>
                  <Td className="text-right font-mono2 text-xs">{event.tickets_sold}</Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Button
                        size="sm"
                        loading={save.isPending}
                        onClick={() =>
                          save.mutate({
                            id: event.id,
                            payload: {
                              title: draft.title,
                              location: draft.location || null,
                              capacity: draft.capacity,
                            },
                          })
                        }
                      >
                        <Check size={13} />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X size={13} />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ) : (
                <tr key={event.id} className="hover:bg-[var(--surface)]">
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
                  <Td className="text-right font-mono2 text-xs">
                    {event.capacity || '∞'}
                  </Td>
                  <Td className="text-right font-mono2 text-xs">{event.tickets_sold}</Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(event)}>
                        <Pencil size={13} />
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleDelete(event)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </Td>
                </tr>
              ),
            )}
            {events?.length === 0 && (
              <tr>
                <Td className="text-center text-[var(--muted)]" colSpan={6}>
                  No events yet.
                </Td>
              </tr>
            )}
          </tbody>
        </TableShell>
      )}
    </AdminLayout>
  )
}
