import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2, UserPlus } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  assignVenueStaff,
  getUsers,
  getVenueStaff,
  removeVenueStaff,
} from '../../api/admin'
import { apiError } from '../../api/client'
import Button from '../ui/Button'
import Select from '../ui/Select'

const ROLE_OPTIONS = [
  { value: 'venue_admin', label: 'Администратор площадки' },
  { value: 'scanner', label: 'Сканер' },
]

const ROLE_LABELS = {
  venue_admin: 'Администратор площадки',
  scanner: 'Сканер',
}

/**
 * Staff scoped to one venue.
 *
 * Assigning here also lifts the person's account-wide role, because the navbar
 * and the route guards read that column rather than this table -- a grant that
 * left the role alone would be invisible to the person who received it. The
 * badge shows the account role so the two can be seen to agree.
 */
export default function VenueStaff({ venueId }) {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('scanner')

  const key = ['admin', 'venue-staff', venueId]
  const { data: staff, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => getVenueStaff(venueId),
  })
  const { data: users } = useQuery({ queryKey: ['admin', 'users'], queryFn: getUsers })

  const done = (message) => {
    queryClient.invalidateQueries({ queryKey: key })
    // The account-wide role may have moved, so the user table is stale too.
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    toast.success(message)
  }

  const assign = useMutation({
    mutationFn: (payload) => assignVenueStaff(venueId, payload),
    onSuccess: () => {
      setUserId('')
      done('Сотрудник назначен')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось назначить')),
  })

  const remove = useMutation({
    mutationFn: (id) => removeVenueStaff(venueId, id),
    onSuccess: () => done('Назначение снято'),
    onError: (error) => toast.error(apiError(error, 'Не удалось снять назначение')),
  })

  const assigned = new Set((staff ?? []).map((person) => person.user_id))
  // A superadmin already manages every venue, and the API refuses to give one a
  // scoped grant, so offering them here would only produce an error.
  const candidates = (users ?? [])
    .filter((user) => user.role !== 'superadmin' && !assigned.has(user.id))
    .map((user) => ({ value: String(user.id), label: `${user.username} · ${user.email}` }))

  return (
    <div className="border-t border-[var(--border)] px-5 py-4">
      <p className="mb-3 font-mono2 text-[10px] uppercase tracking-[0.16em] text-[var(--muted2)]">
        Персонал
      </p>

      {isLoading ? (
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--surface2)]" />
      ) : staff?.length ? (
        <ul className="mb-4 space-y-1.5">
          {staff.map((person) => (
            <li
              key={person.user_id}
              className="flex flex-wrap items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--surface)] px-3 py-2 text-sm"
            >
              <span className="text-[var(--text)]">{person.username}</span>
              <span className="text-xs text-[var(--muted2)]">{person.email}</span>
              <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] text-[var(--muted)]">
                {ROLE_LABELS[person.role] ?? person.role}
              </span>
              {person.global_role !== person.role && (
                <span
                  title="Роль аккаунта выше, чем назначение на этой площадке"
                  className="rounded-full border border-[var(--warn)]/40 px-2 py-0.5 text-[10px] text-[var(--warn)]"
                >
                  аккаунт: {ROLE_LABELS[person.global_role] ?? person.global_role}
                </span>
              )}
              <Button
                size="sm"
                variant="danger"
                className="ml-auto"
                aria-label={`Снять ${person.username}`}
                loading={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Снять ${person.username} с этой площадки?`)) {
                    remove.mutate(person.user_id)
                  }
                }}
              >
                <Trash2 size={13} />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mb-4 text-sm text-[var(--muted)]">
          На эту площадку ещё никто не назначен.
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Select
            value={userId}
            onChange={setUserId}
            options={candidates}
            placeholder={
              candidates.length ? 'Выберите пользователя' : 'Свободных пользователей нет'
            }
            disabled={!candidates.length}
            aria-label="Пользователь"
          />
        </div>
        <div className="sm:w-[230px]">
          <Select value={role} onChange={setRole} options={ROLE_OPTIONS} aria-label="Роль" />
        </div>
        <Button
          loading={assign.isPending}
          disabled={!userId}
          onClick={() => assign.mutate({ user_id: Number(userId), role })}
        >
          <UserPlus size={14} />
          Назначить
        </Button>
      </div>
    </div>
  )
}
