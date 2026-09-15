import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiError } from '../api/client'
import { getInvite, respondToInvite } from '../api/friends'
import useAuth from '../hooks/useAuth'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'

function Card({ children }) {
  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-8 text-center">
        {children}
      </div>
    </div>
  )
}

/**
 * Where the links in a friend-request e-mail land.
 *
 * Opening a link answers nothing. Mail scanners follow every link in a message
 * before its reader does, so an invitation that changed on a GET would be
 * accepted and then declined by a robot. The answer is this page's button.
 */
export default function FriendInvite() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const suggested = searchParams.get('action') === 'decline' ? 'decline' : 'accept'
  const [done, setDone] = useState(null)

  const { data: invite, isLoading, error } = useQuery({
    queryKey: ['friends', 'invite', token],
    queryFn: () => getInvite(token),
    enabled: Boolean(token),
    retry: false,
  })

  const answer = useMutation({
    mutationFn: (action) => respondToInvite(token, action),
    onSuccess: ({ status }) => {
      const flag = status === 'accepted' ? 'accepted' : 'declined'
      // Signed in: the friends page says it. Otherwise it is said here, since
      // that page would only send them to the login screen.
      if (isAuthenticated) navigate(`/friends?${flag}=true`, { replace: true })
      else setDone(flag)
    },
  })

  if (!token) {
    return (
      <Card>
        <p className="text-sm text-[var(--err)]">В ссылке нет приглашения.</p>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <div className="mx-auto h-24 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface2)]" />
      </Card>
    )
  }

  if (error || !invite) {
    return (
      <Card>
        <h1 className="font-display text-lg">Приглашение не найдено</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Ссылка неверна или устарела — например, запрос отправили заново.
        </p>
      </Card>
    )
  }

  const name = invite.requester.username

  if (done) {
    return (
      <Card>
        <h1 className="font-display text-lg">
          {done === 'accepted' ? `Вы теперь друзья с ${name}` : 'Запрос отклонён'}
        </h1>
        <Link to="/login" className="mt-5 inline-block text-sm text-[var(--accent)]">
          Войти в Velox Pass
        </Link>
      </Card>
    )
  }

  if (invite.status !== 'pending') {
    return (
      <Card>
        <Avatar username={name} src={invite.requester.avatar_url} size={64} className="mx-auto" />
        <h1 className="mt-4 font-display text-lg">На это приглашение уже ответили</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {invite.status === 'accepted' ? `Вы уже друзья с ${name}.` : 'Запрос был отклонён.'}
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <Avatar username={name} src={invite.requester.avatar_url} size={64} className="mx-auto" />
      <h1 className="mt-4 font-display text-lg">{name} приглашает вас в друзья</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">для {invite.addressee_username} на Velox Pass</p>

      <div className="mt-6 flex justify-center gap-3">
        {['accept', 'decline'].map((action) => (
          <Button
            key={action}
            // The button the e-mail link named is the prominent one.
            variant={action === suggested ? undefined : 'ghost'}
            loading={answer.isPending && answer.variables === action}
            disabled={answer.isPending}
            onClick={() => answer.mutate(action)}
          >
            {action === 'accept' ? 'Принять' : 'Отклонить'}
          </Button>
        ))}
      </div>

      {answer.error && (
        <p className="mt-4 text-sm text-[var(--err)]">
          {apiError(answer.error, 'Не удалось ответить на приглашение')}
        </p>
      )}
    </Card>
  )
}
