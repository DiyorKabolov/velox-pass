import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { apiError } from '../api/client'
import { getGiftInvite, respondToGift } from '../api/gifts'
import useAuth from '../hooks/useAuth'
import { Gift } from 'lucide-react'
import Button from '../components/ui/Button'
import { CONTAINER } from '../components/ui/Page'
import { Reveal } from '../components/motion/Motion'
import { formatDateTime } from '../utils/dates'

const GOLD = '#e8b54a'

function Card({ children }) {
  return (
    <div className={`${CONTAINER} grid min-h-[72vh] place-items-center py-16`}>
      <Reveal
        className="w-full max-w-md rounded-[var(--radius)] border bg-[var(--surface)] px-7 py-9 text-center sm:px-9"
        style={{ borderColor: `${GOLD}55` }}
      >
        {children}
      </Reveal>
    </div>
  )
}

/** The gift's mark: a ribboned box in gold, drawn rather than an emoji. */
function GiftMark() {
  return (
    <span
      aria-hidden
      className="mx-auto grid h-16 w-16 place-items-center rounded-full"
      style={{ background: `${GOLD}1f`, color: GOLD }}
    >
      <Gift size={28} strokeWidth={1.5} />
    </span>
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
        <div className="skeleton mx-auto h-24 rounded-[var(--radius-sm)]" />
      </Card>
    )
  }

  if (!token || error || !gift) {
    return (
      <Card>
        <h1 className="font-display text-[30px] font-bold uppercase leading-[1.02] text-[var(--text)]">Подарок не найден</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
          Ссылка неверна или устарела — например, подарок уже отклонили.
        </p>
      </Card>
    )
  }

  if (done) {
    return (
      <Card>
        {done === 'accepted' && <GiftMark />}
        <h1 className="mt-6 font-display text-[30px] font-bold uppercase leading-[1.02] text-[var(--text)]">
          {done === 'accepted' ? 'Подарок принят' : 'Подарок отклонён'}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
          {done === 'accepted'
            ? 'Билет ждёт вас в личном кабинете.'
            : `Билет вернулся к ${gift.sender_username}.`}
        </p>
        <Link
          to="/login"
          state={done === 'accepted' ? { from: '/cabinet' } : undefined}
          className="t-link mt-6 inline-block text-[15px] text-[var(--text)]"
        >
          Войти в Velox Pass
        </Link>
      </Card>
    )
  }

  if (gift.status !== 'pending') {
    return (
      <Card>
        <h1 className="font-display text-[30px] font-bold uppercase leading-[1.02] text-[var(--text)]">На этот подарок уже ответили</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--muted)]">
          {gift.status === 'accepted' ? 'Билет уже в вашем кабинете.' : 'Подарок был отклонён.'}
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <GiftMark />
      <h1 className="mt-6 font-display text-[30px] font-bold uppercase leading-[1.02] text-[var(--text)]">
        {gift.sender_username} дарит вам билет
      </h1>
      <p className="mt-2 text-[13px] text-[var(--muted2)]">для {gift.recipient_username}</p>

      {gift.message && (
        <blockquote className="mt-6 whitespace-pre-line text-[16px] leading-relaxed text-[var(--text)]">
          <span aria-hidden className="mr-1 font-display text-[24px] leading-none" style={{ color: GOLD }}>
            «
          </span>
          {gift.message}
          <span aria-hidden className="ml-1 font-display text-[24px] leading-none" style={{ color: GOLD }}>
            »
          </span>
        </blockquote>
      )}

      <div className="mt-6 border-y border-dashed border-[var(--border2)] py-4 text-left">
        <p className="t-poster text-[28px] text-[var(--text)]">{gift.event_title}</p>
        <p className="t-num mt-2 text-[13px] text-[var(--muted)]">
          {[formatDateTime(gift.starts_at), gift.location, gift.seat_label].filter(Boolean).join(' · ')}
        </p>
      </div>

      <div className="mt-7 flex justify-center gap-3">
        {['accept', 'decline'].map((action) => (
          <Button
            key={action}
            variant={action === suggested ? undefined : 'ghost'}
            loading={answer.isPending && answer.variables === action}
            disabled={answer.isPending}
            onClick={() => answer.mutate(action)}
            style={
              action === suggested && action === 'accept'
                ? { background: GOLD, borderColor: GOLD, color: '#14110f' }
                : undefined
            }
          >
            {action === 'accept' ? 'Принять подарок' : 'Отклонить'}
          </Button>
        ))}
      </div>

      {answer.error && (
        <p className="mt-5 text-[14px] text-[var(--err)]">
          {apiError(answer.error, 'Не удалось ответить на подарок')}
        </p>
      )}
    </Card>
  )
}
