import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { apiError } from '../../api/client'
import { getEventSessions } from '../../api/events'
import { deleteSession } from '../../api/sessions'
import { formatSessionStamp } from '../../utils/dates'
import { pluralize } from '../../utils/plural'
import Button from '../ui/Button'

/** How the three states are drawn, so the badge and nothing else decides. */
const STATES = {
  active: { label: 'Активен', color: 'var(--ok)', bg: 'var(--ok-bg)' },
  finished: { label: 'Завершён', color: 'var(--muted)', bg: 'var(--accent-dim)' },
  cancelled: { label: 'Отменён', color: 'var(--err)', bg: 'var(--err-bg)' },
}

/**
 * Free seats are the number an operator acts on, so they carry the warning:
 * green while there is room, amber once a showing is nearly full, red when it
 * is gone.
 */
function freeColor(free) {
  if (free <= 0) return 'var(--err)'
  if (free < 10) return 'var(--warn)'
  return 'var(--ok)'
}

function Cell({ children, className = '' }) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>
}

export default function EventSessions({ eventId }) {
  const queryClient = useQueryClient()

  // Loaded when the row is opened, not with the table: an event can hold a
  // couple of hundred showings and most rows are never expanded.
  const { data: sessions, isLoading } = useQuery({
    queryKey: ['admin', 'events', eventId, 'sessions'],
    queryFn: () => getEventSessions(eventId, { includeInactive: true }),
  })

  const cancel = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      // The event's capacity is the sum over its live showings, so cancelling
      // one changes the row above as well as this table.
      queryClient.invalidateQueries({ queryKey: ['admin', 'events', eventId, 'sessions'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      toast.success('Сеанс отменён')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось отменить сеанс')),
  })

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface2)]" />
  }

  if (!sessions?.length) {
    return (
      <p className="py-3 text-center text-xs text-[var(--muted)]">
        У этого мероприятия ещё нет сеансов.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)]">
      <table className="w-full min-w-[620px] text-left text-xs">
        <thead>
          <tr className="text-[var(--muted)]">
            {['Дата и время', 'Зал', 'Продано', 'Свободно', 'Статус', ''].map(
              (title, index) => (
                <th
                  key={title || index}
                  className={`border-b border-[var(--border)] px-3 py-2 font-mono2 text-[10px] uppercase tracking-[0.14em] ${
                    index >= 2 && index <= 3 ? 'text-right' : ''
                  } ${index === 5 ? 'text-right' : ''}`}
                >
                  {title}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {sessions.map((session) => {
            const state = STATES[session.state] ?? STATES.active
            return (
              <tr
                key={session.id}
                className="border-b border-[var(--border)] last:border-0"
              >
                <Cell className="font-mono2 whitespace-nowrap">
                  {formatSessionStamp(session.datetime)}
                </Cell>
                <Cell className="text-[var(--muted)]">{session.hall_name || '—'}</Cell>
                <Cell className="text-right font-mono2 whitespace-nowrap">
                  {pluralize(session.seats_taken, 'место', 'места', 'мест')}
                </Cell>
                <Cell className="text-right font-mono2 whitespace-nowrap">
                  <span style={{ color: freeColor(session.seats_free) }}>
                    {pluralize(session.seats_free, 'место', 'места', 'мест')}
                  </span>
                </Cell>
                <Cell>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] whitespace-nowrap"
                    style={{ background: state.bg, color: state.color }}
                  >
                    {state.label}
                  </span>
                </Cell>
                <Cell className="text-right">
                  {/* Only a showing that can still sell is worth cancelling;
                      one already over or already cancelled has nothing to undo. */}
                  {session.state === 'active' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={cancel.isPending && cancel.variables === session.id}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Отменить сеанс ${formatSessionStamp(session.datetime)}?`,
                          )
                        ) {
                          cancel.mutate(session.id)
                        }
                      }}
                    >
                      Отменить
                    </Button>
                  )}
                </Cell>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
