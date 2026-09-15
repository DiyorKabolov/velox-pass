import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiError } from '../api/client'
import { getGiftInvite, respondToGift } from '../api/gifts'
import useAuth from '../hooks/useAuth'
import Button from '../components/ui/Button'
import { formatDateTime } from '../utils/dates'

const GOLD = '#fbbf24'

function Card({ children }) {
  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <div
        className="rounded-[var(--radius)] border bg-[var(--surface)] p-8 text-center"
        style={{ borderColor: `${GOLD}55` }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Where the links in a gift e-mail land.
 *
 * Opening a link answers nothing. Mail scanners follow every link in a message
 * before its reader does; a gift that changed on a GET would be accepted and
 * then handed back by a robot. The answer is this page's button.
 */
export default function GiftRespond() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const suggested = searchParams.get('action') === 'decline' ? 'decline' : 'accept'
  const [done, setDone] = useState(null)

  const { data: gift, isLoading, error } = useQuery({
    queryKey: ['gifts', 'invite', token],
    queryFn: () => getGiftInvite(token),
    enabled: Boolean(token),
    retry: false,
  })

  const answer = useMutation({
    mutationFn: (action) => respondToGift(token, action),
    onSuccess: ({ status }) => {
      if (isAuthenticated) navigate(`/cabinet?gift=${status}`, { replace: true })
      else setDone(status)
    },
  })

  if (isLoading) {
    return (
      <Card>
        <div className="mx-auto h-24 animate-pulse rounded-[var(--radius-sm)] bg-[var(--surface2)]" />
      </Card>
    )
  }

  if (!token || error || !gift) {
    return (
      <Card>
        <h1 className="font-display text-lg">Подарок не найден</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Ссылка неверна или устарела — например, подарок уже отклонили.
        </p>
      </Card>
    )
  }

  if (done) {
    return (
      <Card>
        <h1 className="font-display text-lg">
          {done === 'accepted' ? 'Подарок принят 🎁' : 'Подарок отклонён'}
        </h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {done === 'accepted'
            ? 'Билет ждёт вас в личном кабинете.'
            : `Билет вернулся к ${gift.sender_username}.`}
        </p>
        <Link to="/login" className="mt-5 inline-block text-sm text-[var(--accent)]">
          Войти в Velox Pass
        </Link>
      </Card>
    )
  }

  if (gift.status !== 'pending') {
    return (
      <Card>
        <h1 className="font-display text-lg">На этот подарок уже ответили</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">
          {gift.status === 'accepted' ? 'Билет уже в вашем кабинете.' : 'Подарок был отклонён.'}
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <p className="text-4xl" aria-hidden>
        🎁
      </p>
      <h1 className="mt-3 font-display text-lg">{gift.sender_username} дарит вам билет</h1>
      <p className="mt-1 text-xs text-[var(--muted2)]">для {gift.recipient_username}</p>

      {gift.message && (
        <blockquote
          className="mt-5 whitespace-pre-line rounded-[var(--radius-sm)] border-l-2 px-3 py-2 text-left text-sm"
          style={{ borderColor: GOLD, background: `${GOLD}0d` }}
        >
          {gift.message}
        </blockquote>
      )}

      <div className="mt-5 rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-3 text-left">
        <p className="font-medium">{gift.event_title}</p>
        <p className="mt-1 text-xs text-[var(--muted)]">
          {[formatDateTime(gift.starts_at), gift.location, gift.seat_label].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="mt-6 flex justify-center gap-3">
        {['accept', 'decline'].map((action) => (
          <Button
            key={action}
            variant={action === suggested ? undefined : 'ghost'}
            loading={answer.isPending && answer.variables === action}
            disabled={answer.isPending}
            onClick={() => answer.mutate(action)}
            style={
              action === suggested && action === 'accept'
                ? { background: GOLD, borderColor: GOLD, color: '#1a1c1e' }
                : undefined
            }
          >
            {action === 'accept' ? 'Принять подарок' : 'Отклонить'}
          </Button>
        ))}
      </div>

      {answer.error && (
        <p className="mt-4 text-sm text-[var(--err)]">
          {apiError(answer.error, 'Не удалось ответить на подарок')}
        </p>
      )}
    </Card>
  )
}
