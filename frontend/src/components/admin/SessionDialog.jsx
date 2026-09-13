import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { apiError } from '../../api/client'
import { createSessions } from '../../api/sessions'
import { creationMessage } from '../../utils/sessionGroups'
import Button from '../ui/Button'
import Modal from '../ui/Modal'
import Select from '../ui/Select'
import SessionFields from './SessionFields'
import { sessionPayload, validateSessionForm } from './sessionForm'

/**
 * Schedule a showing, or a whole series of them.
 *
 * `form.eventId` may be fixed by the caller -- opened from an event's own row
 * there is nothing to choose, and the picker is replaced by the title. Opened
 * from the toolbar it is a select over every event.
 */
export default function SessionDialog({ form, onChange, onClose, events, lockedEvent }) {
  const queryClient = useQueryClient()

  const create = useMutation({
    mutationFn: createSessions,
    onSuccess: (result) => {
      // A new showing changes the event's capacity, the venue's schedule and
      // the public listing, so none of them can keep what they cached.
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
      queryClient.invalidateQueries({ queryKey: ['venues'] })
      onClose()
      toast.success(creationMessage(result))
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось создать сеанс')),
  })

  const submit = () => {
    const problem = validateSessionForm(form, { requireEvent: !lockedEvent })
    if (problem) {
      toast.error(problem)
      return
    }
    create.mutate(sessionPayload(form, lockedEvent?.id ?? form.eventId))
  }

  return (
    <Modal
      open={Boolean(form)}
      onClose={onClose}
      title={form?.mode === 'series' ? 'Повторяющиеся сеансы' : 'Новый сеанс'}
      subtitle={lockedEvent?.title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button loading={create.isPending} onClick={submit}>
            Создать
          </Button>
        </>
      }
    >
      {form && (
        <div className="space-y-4">
          {!lockedEvent && (
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                Мероприятие
              </span>
              <Select
                value={form.eventId}
                onChange={(eventId) => onChange({ ...form, eventId })}
                placeholder="— выберите —"
                aria-label="Мероприятие"
                options={(events ?? []).map((event) => ({
                  value: String(event.id),
                  label: event.title,
                }))}
              />
            </label>
          )}

          <SessionFields value={form} onChange={onChange} />
        </div>
      )}
    </Modal>
  )
}
