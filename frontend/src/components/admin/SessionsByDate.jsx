import { Fragment, useMemo } from 'react'
import { useMutation, useQueries, useQueryClient } from '@tanstack/react-query'
import { Repeat, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { apiError } from '../../api/client'
import { getEventSessions } from '../../api/events'
import { cancelSessionGroup, deleteSession } from '../../api/sessions'
import { formatDateTime } from '../../utils/dates'
import { pluralize } from '../../utils/plural'
import { groupSessions } from '../../utils/sessionGroups'
import Button from '../ui/Button'
import { TableShell, Td, Th } from '../../pages/admin/AdminLayout'

const STATUS_LABELS = {
  active: 'активен',
  scheduled: 'запланирован',
  cancelled: 'отменён',
  sold_out: 'мест нет',
  finished: 'завершён',
}

/**
 * Every showing there is, in one chronological list, with a series kept
 * together under a header of its own.
 *
 * The counterpart to the event-by-event table: the same rows arranged for the
 * question "what is on this week" rather than "what is this event doing".
 */
export default function SessionsByDate({ events }) {
  const queryClient = useQueryClient()

  const sessionQueries = useQueries({
    queries: (events ?? []).map((event) => ({
      queryKey: ['events', event.id, 'sessions'],
      queryFn: () => getEventSessions(event.id),
    })),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['events'] })
    queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
    queryClient.invalidateQueries({ queryKey: ['venues'] })
  }

  const cancel = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => {
      invalidate()
      toast.success('Сеанс отменён')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось отменить сеанс')),
  })

  const cancelSeries = useMutation({
    mutationFn: cancelSessionGroup,
    onSuccess: (result) => {
      invalidate()
      toast.success(
        `Отменено ${pluralize(result?.cancelled ?? 0, 'сеанс', 'сеанса', 'сеансов')}`,
      )
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось отменить серию')),
  })

  const blocks = useMemo(() => {
    const titles = new Map((events ?? []).map((event) => [event.id, event.title]))
    const all = (events ?? []).flatMap(
      (event, index) => sessionQueries[index]?.data ?? [],
    )
    return groupSessions(all).map((block) => ({
      ...block,
      title: titles.get(block.sessions[0].event_id) ?? '—',
    }))
    // sessionQueries is a new array on every render; its contents are what matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, sessionQueries.map((query) => query.dataUpdatedAt).join()])

  const row = (session, inSeries) => (
    <tr key={session.id} className="transition-colors hover:bg-[var(--surface)]">
      <Td className={inSeries ? 'pl-8 text-[var(--muted)]' : undefined}>
        {inSeries ? '↳' : session.event_title}
      </Td>
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
        {STATUS_LABELS[session.state] ?? STATUS_LABELS[session.status] ?? session.status}
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
  )

  return (
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
        {blocks.map((block) =>
          block.kind === 'single' ? (
            row(block.sessions[0], false)
          ) : (
            // A series gets a header of its own: the showings under it are one
            // act of scheduling and are cancelled as one. The rows stay
            // siblings in this same table rather than a table of their own, or
            // their columns would not line up with everything above.
            <Fragment key={block.key}>
              <tr>
                <Td colSpan={6} className="!px-0 !py-0">
                  <div className="flex flex-wrap items-center gap-3 bg-[var(--surface)] px-4 py-2.5">
                    <Repeat size={14} className="shrink-0 text-[var(--accent)]" />
                    <span className="min-w-0 flex-1 truncate text-sm">{block.title}</span>
                    <span className="shrink-0 rounded-full border border-[var(--border2)] px-2.5 py-1 font-mono2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                      Серия: {pluralize(block.sessions.length, 'сеанс', 'сеанса', 'сеансов')}
                    </span>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={
                        cancelSeries.isPending && cancelSeries.variables === block.groupId
                      }
                      onClick={() => {
                        if (
                          window.confirm(
                            `Отменить все ${block.sessions.length} сеансов серии «${block.title}»?`,
                          )
                        ) {
                          cancelSeries.mutate(block.groupId)
                        }
                      }}
                    >
                      Отменить серию
                    </Button>
                  </div>
                </Td>
              </tr>
              {block.sessions.map((session) => row(session, true))}
            </Fragment>
          ),
        )}
        {blocks.length === 0 && (
          <tr>
            <Td className="text-center text-[var(--muted)]" colSpan={6}>
              Сеансов пока нет. Создайте площадку и зал, затем сеанс.
            </Td>
          </tr>
        )}
      </tbody>
    </TableShell>
  )
}
