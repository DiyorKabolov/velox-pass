import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, UserMinus, UserPlus, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { apiError } from '../api/client'
import {
  acceptRequest,
  declineRequest,
  getFriends,
  getPendingRequests,
  removeFriend,
  sendFriendRequest,
} from '../api/friends'
import { deleteAvatar, uploadAvatar } from '../api/users'
import useAuth from '../hooks/useAuth'
import { formatDate } from '../utils/dates'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'

function Section({ title, children, aside }) {
  return (
    <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base tracking-tight">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** The signed-in user's own picture: it is what friends see next to the name. */
function ProfileCard() {
  const { user, setUser } = useAuth()
  const queryClient = useQueryClient()
  const input = useRef(null)

  const change = useMutation({
    mutationFn: (file) => (file ? uploadAvatar(file) : deleteAvatar()),
    onSuccess: (fresh) => {
      setUser(fresh)
      queryClient.invalidateQueries({ queryKey: ['friends'] })
      toast.success(fresh.avatar_url ? 'Фото обновлено' : 'Фото убрано')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось сохранить фото')),
  })

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5">
      <Avatar username={user?.username} src={user?.avatar_url} size={56} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base">{user?.username}</p>
        <p className="mt-0.5 text-xs text-[var(--muted2)]">Так вас видят друзья</p>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          // Cleared at once, so choosing the same file again still fires.
          event.target.value = ''
          if (file) change.mutate(file)
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="ghost" loading={change.isPending} onClick={() => input.current?.click()}>
          {user?.avatar_url ? 'Сменить фото' : 'Загрузить фото'}
        </Button>
        {user?.avatar_url && (
          <Button size="sm" variant="ghost" disabled={change.isPending} onClick={() => change.mutate(null)}>
            Убрать
          </Button>
        )}
      </div>
    </div>
  )
}

export default function Friends() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  // The outcome of the last request, shown under the form: { tone, text }.
  const [notice, setNotice] = useState(null)

  // Arriving from an answered e-mail invitation: say so once, then tidy the
  // address so a reload does not say it again.
  useEffect(() => {
    if (searchParams.get('accepted')) toast.success('Запрос в друзья принят')
    else if (searchParams.get('declined')) toast('Запрос в друзья отклонён')
    else return
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const { data: friends, isLoading } = useQuery({ queryKey: ['friends'], queryFn: getFriends })
  const { data: pending } = useQuery({
    queryKey: ['friends', 'pending'],
    queryFn: getPendingRequests,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['friends'] })

  const send = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: (result, name) => {
      refresh()
      setUsername('')
      if (result.status === 'accepted') {
        setNotice({ tone: 'ok', text: result.message })
      } else if (result.mail_sent === false) {
        setNotice({
          tone: 'ok',
          text: `Запрос отправлен ${name}. Письмо не ушло, но запрос появится у него в разделе «Друзья».`,
        })
      } else {
        setNotice({ tone: 'ok', text: `Запрос отправлен на email ${name}` })
      }
    },
    onError: (error) => setNotice({ tone: 'err', text: apiError(error, 'Не удалось отправить запрос') }),
  })

  const answer = useMutation({
    mutationFn: ({ id, accept }) => (accept ? acceptRequest(id) : declineRequest(id)),
    onSuccess: (_, { accept }) => {
      refresh()
      toast.success(accept ? 'Запрос принят' : 'Запрос отклонён')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось ответить на запрос')),
  })

  const remove = useMutation({
    mutationFn: removeFriend,
    onSuccess: () => {
      refresh()
      toast.success('Удалён из друзей')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось удалить из друзей')),
  })

  const submit = (event) => {
    event.preventDefault()
    const name = username.trim()
    if (!name) return
    setNotice(null)
    send.mutate(name)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-5 py-12">
      <header>
        <h1 className="font-display text-2xl tracking-tight">Друзья</h1>
      </header>

      <ProfileCard />

      <Section title="Мои друзья">
        {isLoading ? (
          <div className="h-20 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface2)]" />
        ) : friends?.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {friends.map((friend) => (
              <li key={friend.user_id} className="flex flex-wrap items-center gap-3 py-3">
                <Avatar username={friend.username} src={friend.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{friend.username}</p>
                  <p className="mt-0.5 text-xs text-[var(--muted2)]">
                    Друзья с {formatDate(friend.since)}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={remove.isPending && remove.variables === friend.user_id}
                  onClick={() => {
                    if (window.confirm(`Удалить ${friend.username} из друзей?`)) {
                      remove.mutate(friend.user_id)
                    }
                  }}
                >
                  <UserMinus size={13} />
                  Удалить из друзей
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-6 text-center text-sm text-[var(--muted)]">
            У вас пока нет друзей · Добавьте друзей по никнейму
          </p>
        )}
      </Section>

      {pending?.length > 0 && (
        <Section title="Входящие запросы">
          <ul className="divide-y divide-[var(--border)]">
            {pending.map((request) => {
              const busy = answer.isPending && answer.variables?.id === request.friendship_id
              return (
                <li key={request.friendship_id} className="flex flex-wrap items-center gap-3 py-3">
                  <Avatar username={request.requester.username} src={request.requester.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{request.requester.username}</p>
                    <p className="mt-0.5 text-xs text-[var(--muted2)]">
                      {formatDate(request.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      loading={busy && answer.variables?.accept}
                      disabled={busy}
                      onClick={() => answer.mutate({ id: request.friendship_id, accept: true })}
                    >
                      <Check size={13} />
                      Принять
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy && !answer.variables?.accept}
                      disabled={busy}
                      onClick={() => answer.mutate({ id: request.friendship_id, accept: false })}
                    >
                      <X size={13} />
                      Отклонить
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
          <p className="mt-3 text-xs text-[var(--muted2)]">
            Принять или отклонить запрос можно и по ссылке из письма.
          </p>
        </Section>
      )}

      <Section title="Добавить друга">
        <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              name="friend-username"
              aria-label="Никнейм пользователя"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Введите никнейм пользователя"
              autoComplete="off"
            />
          </div>
          <Button type="submit" loading={send.isPending} disabled={!username.trim()}>
            <UserPlus size={15} />
            Отправить запрос
          </Button>
        </form>
        {notice && (
          <p
            role="status"
            className="mt-3 text-sm"
            style={{ color: notice.tone === 'err' ? 'var(--err)' : 'var(--ok)' }}
          >
            {notice.text}
          </p>
        )}
      </Section>
    </div>
  )
}
