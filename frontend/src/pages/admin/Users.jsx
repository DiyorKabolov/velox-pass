import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { deleteUser, getUsers, updateUserRole } from '../../api/admin'
import { apiError } from '../../api/client'
import { formatShortDate } from '../../utils/dates'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import useAuth from '../../hooks/useAuth'
import AdminLayout, { TableShell, Td, Th } from './AdminLayout'

const ROLES = ['user', 'scanner', 'venue_admin', 'superadmin']

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
      toast.success(`${updated.username} is now ${updated.role}`)
    },
    onError: (error) => toast.error(apiError(error, 'Could not change the role')),
  })

  const remove = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      invalidate()
      toast.success('User deleted')
    },
    onError: (error) => toast.error(apiError(error, 'Could not delete the user')),
  })

  const handleDelete = (user) => {
    if (window.confirm(`Delete ${user.username}? Their tickets go with them.`)) {
      remove.mutate(user.id)
    }
  }

  return (
    <AdminLayout title="Users" subtitle="Promote, demote or remove accounts.">
      {isLoading ? (
        <div className="h-48 animate-pulse rounded-[var(--radius)] bg-[var(--surface)]" />
      ) : (
        <TableShell>
          <thead>
            <tr>
              <Th>Username</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th>Registered</Th>
              <Th>Role</Th>
              <Th className="text-right">Actions</Th>
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
                        you
                      </span>
                    )}
                  </Td>
                  <Td className="text-[var(--muted)]">{user.email}</Td>
                  <Td>
                    <Badge tone={user.is_verified ? 'ok' : 'warn'}>
                      {user.is_verified ? 'verified' : 'pending'}
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
                      <select
                        value={user.role}
                        disabled={isSelf || changeRole.isPending}
                        onChange={(event) =>
                          changeRole.mutate({ id: user.id, role: event.target.value })
                        }
                        style={{ color: ROLE_COLOR[user.role] ?? 'var(--text)' }}
                        className="rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--surface2)] px-2.5 py-1.5 text-xs outline-none transition-colors focus:border-[var(--accent)] disabled:opacity-45"
                      >
                        {ROLES.map((role) => (
                          <option key={role} value={role} style={{ color: 'var(--text)' }}>
                            {role}
                          </option>
                        ))}
                      </select>
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
