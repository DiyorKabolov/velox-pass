import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { deleteUser, getUsers, updateUserRole } from '../../api/admin'
import { apiError } from '../../api/client'
import { formatShortDate } from '../../utils/dates'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Select from '../../components/ui/Select'
import useAuth from '../../hooks/useAuth'
import AdminLayout, { TableShell, Td, Th } from './AdminLayout'

const ROLES = ['user', 'scanner', 'venue_admin', 'superadmin']
const ROLE_LABELS = {
  user: 'пользователь',
  scanner: 'сканер',
  venue_admin: 'админ площадки',
  superadmin: 'суперадмин',
}

// Colour per role so scanners stand out in a long table.
const ROLE_COLOR = {
  user: 'var(--muted)',
  scanner: 'var(--warn)',
  venue_admin: 'var(--accent)',
  superadmin: 'var(--ok)',
}

export default function Users() {
  const queryClient = useQueryClient()
  const { user: currentUser } = useAuth()

  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: getUsers,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })

  const changeRole = useMutation({
    mutationFn: ({ id, role }) => updateUserRole(id, role),
    onSuccess: (updated) => {
      invalidate()
      toast.success(`${updated.username} — теперь ${ROLE_LABELS[updated.role] ?? updated.role}`)
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось изменить роль')),
  })

  const remove = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      invalidate()
      toast.success('Пользователь удалён')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось удалить пользователя')),
  })

  const handleDelete = (user) => {
    if (window.confirm(`Удалить ${user.username}? Его билеты будут удалены.`)) {
      remove.mutate(user.id)
    }
  }

  return (
    <AdminLayout title="Пользователи" subtitle="Роли и удаление учётных записей.">
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-[var(--radius)] bg-[var(--surface)]" />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Имя пользователя</Th>
              <Th>Email</Th>
              <Th>Статус</Th>
              <Th>Регистрация</Th>
              <Th>Роль</Th>
              <Th className="text-right">Действия</Th>
            </tr>
          </thead>
          <tbody>
            {users?.map((user) => {
              const isSelf = user.id === currentUser?.id
              return (
                <tr key={user.id} className="hover:bg-[var(--surface)]">
                  <Td>
                    {user.username}
                    {isSelf && (
                      <span className="ml-2 font-mono2 text-[10px] text-[var(--muted2)]">
                        вы
                      </span>
                    )}
                  </Td>
                  <Td className="text-[var(--muted)]">{user.email}</Td>
                  <Td>
                    <Badge tone={user.is_verified ? 'ok' : 'warn'}>
                      {user.is_verified ? 'подтверждён' : 'ожидает'}
                    </Badge>
                  </Td>
                  <Td className="font-mono2 text-xs text-[var(--muted)]">
                    {formatShortDate(user.created_at)}
                  </Td>
                  <Td>
                    <span className="flex items-center gap-2">
                      {user.role === 'scanner' && (
                        <Camera size={14} style={{ color: ROLE_COLOR.scanner }} />
                      )}
                      <Select
                        value={user.role}
                        disabled={isSelf || changeRole.isPending}
                        onChange={(role) => changeRole.mutate({ id: user.id, role })}
                        aria-label={`Роль: ${user.username}`}
                        className="!w-[150px] !px-2.5 !py-1.5 !text-xs"
                        options={ROLES.map((role) => ({
                          value: role,
                          label: ROLE_LABELS[role] ?? role,
                        }))}
                      />
                    </span>
                  </Td>
                  <Td>
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="danger"
                        disabled={isSelf || user.role === 'superadmin'}
                        onClick={() => handleDelete(user)}
                      >
                        <Trash2 size={13} />
                      </Button>
                    </div>
                  </Td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
      )}
    </AdminLayout>
  )
}
