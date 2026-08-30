import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, UserPlus, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { getUsers } from '../../api/admin'
import { addVenueStaff, getVenueStaff, removeVenueStaff } from '../../api/venues'
import { apiError } from '../../api/client'
import { formatDateTime } from '../../utils/dates'
import Button from '../ui/Button'
import Select from '../ui/Select'

// A grid, not a <table>. This block lives inside a cell of the venues table,
// and TableShell's inner table carries min-w-[640px], which forced the outer
// table wider than its container -- the columns slid out of line and the page
// grew a horizontal scrollbar. A grid makes no such demand on its parent.
// Floors on the two text columns so a long email cannot squeeze the name down
// to an ellipsis. The whole block sits in a scroll container below, so these
// minimums can never push the venues table wider -- a scroll container
// contributes nothing to its parent's minimum width.
const COLS =
  'grid grid-cols-[minmax(120px,1fr)_minmax(180px,1.4fr)_max-content_auto] items-center gap-3'

export const VENUE_ROLES = [
  { value: 'venue_admin', label: 'Админ площадки' },
  { value: 'scanner', label: 'Сканер' },
]

/** Amber for the administrator, blue for the scanner. Exported so the users
    table can tint its venue pills by the same rule. */
export const ROLE_STYLE = {
  venue_admin: { color: '#fbbf24', background: 'rgba(251,191,36,0.12)', borderColor: 'rgba(251,191,36,0.4)' },
  scanner: { color: '#60a5fa', background: 'rgba(96,165,250,0.12)', borderColor: 'rgba(96,165,250,0.4)' },
}

export const ROLE_LABELS = Object.fromEntries(VENUE_ROLES.map((r) => [r.value, r.label]))

export function RoleBadge({ role }) {
  return (
    <span
      style={ROLE_STYLE[role] ?? ROLE_STYLE.scanner}
      className="inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px]"
    >
      {ROLE_LABELS[role] ?? role}
    </span>
  )
}

/**
 * Staff attached to one venue.
 *
 * Assigning here also lifts the person's account-wide role, because the navbar
 * and the route guards read that column rather than this table -- a grant that
 * left the role alone would be invisible to the person who received it.
 */
export default function VenueStaff({ venueId, bare = false }) {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState('scanner')

  const key = ['admin', 'venue-staff', venueId]
  const { data: staff, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => getVenueStaff(venueId),
  })
  // Only loaded once the form is open: the list is otherwise never read.
  const { data: users } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: getUsers,
    enabled: adding,
  })

  const refresh = (message) => {
    queryClient.invalidateQueries({ queryKey: key })
    // The account-wide role may have moved with it, so the user table is stale.
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
    toast.success(message)
  }

  const closeForm = () => {
    setAdding(false)
    setUserId('')
    setRole('scanner')
  }

  const add = useMutation({
    mutationFn: () => addVenueStaff(venueId, Number(userId), role),
    onSuccess: () => {
      closeForm()
      refresh('Сотрудник назначен')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось назначить')),
  })

  const remove = useMutation({
    mutationFn: (id) => removeVenueStaff(venueId, id),
    onSuccess: () => refresh('Назначение снято'),
    onError: (error) => toast.error(apiError(error, 'Не удалось снять назначение')),
  })

  const assigned = new Set((staff ?? []).map((person) => person.user_id))
  // Superadmins already manage every venue and the API refuses them a scoped
  // grant, so offering them here would only produce an error.
  const candidates = (users ?? [])
    .filter((user) => user.role !== 'superadmin' && !assigned.has(user.id))
    .map((user) => ({ value: String(user.id), label: `${user.username} — ${user.email}` }))

  return (
    // `bare` drops the padding and the caption for use inside a dialog, which
    // supplies its own and is already headed by a "Персонал" tab.
    <div className={bare ? '' : 'px-5 py-5'}>
      <div
        className={`flex items-center gap-3 ${
          bare ? 'mb-3 justify-end' : 'mb-3 justify-between'
        }`}
      >
        {!bare && (
          <p className="font-mono2 text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Персонал
          </p>
        )}
        {!adding && (
          <Button size="sm" variant="ghost" onClick={() => setAdding(true)}>
            <Plus size={13} />
            Добавить сотрудника
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="h-10 animate-pulse rounded bg-[var(--surface2)]" />
      ) : staff?.length ? (
        <div className="overflow-x-auto rounded-[var(--radius-sm)] border border-[var(--border)]">
          <div
            className={`${COLS} border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2 font-mono2 text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]`}
          >
            <span className="truncate">Имя пользователя</span>
            <span className="truncate">Email</span>
            <span>Роль</span>
            <span className="text-right">Действия</span>
          </div>

          {staff.map((person) => (
            <div
              key={person.user_id}
              title={
                person.assigned_at
                  ? `Назначен: ${formatDateTime(person.assigned_at)}`
                  : undefined
              }
              className={`${COLS} border-b border-[var(--border)] px-3 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-[var(--surface)]`}
            >
              <span className="truncate">{person.username}</span>
              <span className="truncate text-xs text-[var(--muted)]">{person.email}</span>
              <span className="flex items-center gap-2">
                <RoleBadge role={person.role} />
                {person.global_role !== person.role && (
                  <span
                    title="Роль аккаунта отличается от назначения на этой площадке"
                    className="hidden whitespace-nowrap rounded-full border border-[var(--border2)] px-2 py-0.5 text-[10px] text-[var(--muted2)] lg:inline"
                  >
                    аккаунт: {ROLE_LABELS[person.global_role] ?? person.global_role}
                  </span>
                )}
              </span>
              <span className="flex justify-end">
                <Button
                  size="sm"
                  variant="danger"
                  aria-label={`Снять ${person.username}`}
                  loading={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Снять ${person.username} с этой площадки?`)) {
                      remove.mutate(person.user_id)
                    }
                  }}
                >
                  <X size={13} />
                </Button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-[var(--muted)]">
          На эту площадку ещё никто не назначен.
        </p>
      )}

      {adding && (
        <div className="mt-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <Select
                value={userId}
                onChange={setUserId}
                options={candidates}
                placeholder={
                  users
                    ? candidates.length
                      ? 'Выберите пользователя'
                      : 'Свободных пользователей нет'
                    : 'Загрузка…'
                }
                disabled={!candidates.length}
                aria-label="Пользователь"
              />
            </div>
            <div className="sm:w-[210px]">
              <Select
                value={role}
                onChange={setRole}
                options={VENUE_ROLES}
                aria-label="Роль на площадке"
              />
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                loading={add.isPending}
                disabled={!userId}
                onClick={() => add.mutate()}
              >
                <UserPlus size={14} />
                Добавить
              </Button>
              <Button variant="ghost" onClick={closeForm}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
