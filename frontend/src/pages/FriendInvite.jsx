import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiError } from '../api/client'
import { getInvite, respondToInvite } from '../api/friends'
import useAuth from '../hooks/useAuth'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import { CONTAINER } from '../components/ui/Page'
import { Reveal } from '../components/motion/Motion'

function Card({ children }) {
  return (
    <div className={`${CONTAINER} grid min-h-[72vh] place-items-center py-16`}>
      <Reveal className="w-full max-w-md rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-7 py-9 text-center sm:px-9">
        {children}
      </Reveal>
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
        <p className="text-[15px] text-[var(--err)]">В ссылке нет приглашения.</p>
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card>
        <div className="skeleton mx-auto h-24 rounded-[var(--radius-sm)]" />
      </Card>
    )
  }

  if (error || !invite) {
    return (
      <Card>
        <h1 className="font-display text-[30px] font-bold uppercase leading-[1.02] text-[var(--text)]">Приглашение не найдено</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
          Ссылка неверна или устарела — например, запрос отправили заново.
        </p>
      </Card>
    )
  }

  const name = invite.requester.username

  if (done) {
    return (
      <Card>
        <h1 className="font-display text-[30px] font-bold uppercase leading-[1.02] text-[var(--text)]">
          {done === 'accepted' ? `Вы теперь друзья с ${name}` : 'Запрос отклонён'}
        </h1>
        <Link
          to="/login"
          state={done === 'accepted' ? { from: '/cabinet?tab=friends' } : undefined}
          className="t-link mt-6 inline-block text-[15px] text-[var(--text)]"
        >
          Войти в Velox Pass
        </Link>
      </Card>
    )
  }

  if (invite.status !== 'pending') {
    return (
      <Card>
        <Avatar username={name} src={invite.requester.avatar_url} size={72} className="mx-auto" />
        <h1 className="mt-6 font-display text-[30px] font-bold uppercase leading-[1.02] text-[var(--text)]">На это приглашение уже ответили</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
          {invite.status === 'accepted' ? `Вы уже друзья с ${name}.` : 'Запрос был отклонён.'}
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <Avatar username={name} src={invite.requester.avatar_url} size={72} className="mx-auto" />
      <h1 className="mt-6 font-display text-[30px] font-bold uppercase leading-[1.02] text-[var(--text)]">
        {name} приглашает вас в друзья
      </h1>
      <p className="mt-3 text-[15px] text-[var(--muted)]">для {invite.addressee_username} на Velox Pass</p>

      <div className="mt-8 flex justify-center gap-3">
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
        <p className="mt-5 text-[14px] text-[var(--err)]">
          {apiError(answer.error, 'Не удалось ответить на приглашение')}
        </p>
      )}
    </Card>
  )
}
