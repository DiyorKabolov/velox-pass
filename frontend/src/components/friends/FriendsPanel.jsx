import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Gift, UserMinus, UserPlus, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { apiError } from '../../api/client'
import {
  acceptRequest,
  declineRequest,
  getFriends,
  getPendingRequests,
  removeFriend,
  sendFriendRequest,
} from '../../api/friends'
import { formatDate } from '../../utils/dates'
import { pluralize } from '../../utils/plural'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Input from '../ui/Input'
import GiftModal from '../tickets/GiftModal'

/** A block of the panel: a heading in capitals on a hairline, then its content. */
function Section({ title, aside, children }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] pb-3">
        <h2 className="font-display text-[22px] font-bold uppercase leading-none text-[var(--text)]">
          {title}
        </h2>
        {aside && <span className="t-num text-[13px] text-[var(--muted)]">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

/**
 * Friends, the requests waiting for an answer, and the form that sends a new
 * one. A tab of the cabinet rather than a page of its own, so it carries no
 * heading or page padding: whatever renders it supplies those.
 */
export default function FriendsPanel() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const [username, setUsername] = useState('')
  // The outcome of the last request, shown under the form: { tone, text }.
  const [notice, setNotice] = useState(null)
  // The friend a ticket is being given to, or null when the dialog is closed.
  const [gifting, setGifting] = useState(null)
  // The friend last shown in the gift window -- kept while it closes.
  const [giftFor, setGiftFor] = useState(null)
  if (gifting && gifting !== giftFor) setGiftFor(gifting)

  // Arriving from an answered e-mail invitation: say so once, then tidy the
  // address so a reload does not say it again. Only those two keys go: the
  // tab this is showing in is in the address too, and must survive.
  useEffect(() => {
    const accepted = searchParams.get('accepted')
    const declined = searchParams.get('declined')
    if (!accepted && !declined) return
    if (accepted) toast.success('Запрос в друзья принят')
    else toast('Запрос в друзья отклонён')
    const next = new URLSearchParams(searchParams)
    next.delete('accepted')
    next.delete('declined')
    setSearchParams(next, { replace: true })
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
    <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16">
      <div className="min-w-0 space-y-14">
        <Section
          title="Мои друзья"
          aside={friends?.length ? pluralize(friends.length, 'друг', 'друга', 'друзей') : null}
        >
          {isLoading ? (
            <div className="skeleton mt-4 h-20 rounded-[var(--radius-sm)]" />
          ) : friends?.length ? (
            <ul>
              {friends.map((friend) => (
                <li
                  key={friend.user_id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--border)] py-4"
                >
                  <Avatar username={friend.username} src={friend.avatar_url} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] text-[var(--text)]">{friend.username}</p>
                    <p className="mt-0.5 text-[13px] text-[var(--muted2)]">
                      Друзья с {formatDate(friend.since)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setGifting(friend)}>
                      <Gift size={14} strokeWidth={1.75} />
                      Подарить билет
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      loading={remove.isPending && remove.variables === friend.user_id}
                      onClick={() => {
                        if (window.confirm(`Удалить ${friend.username} из друзей?`)) {
                          remove.mutate(friend.user_id)
                        }
                      }}
                    >
                      <UserMinus size={14} strokeWidth={1.75} />
                      Удалить из друзей
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-[15px] text-[var(--muted)]">
              У вас пока нет друзей · Добавьте друзей по никнейму
            </p>
          )}
        </Section>

        {pending?.length > 0 && (
          <Section title="Входящие запросы" aside={pending.length}>
            <ul>
              {pending.map((request) => {
                const busy = answer.isPending && answer.variables?.id === request.friendship_id
                return (
                  <li
                    key={request.friendship_id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-[var(--border)] py-4"
                  >
                    <Avatar
                      username={request.requester.username}
                      src={request.requester.avatar_url}
                      size={44}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[16px] text-[var(--text)]">
                        {request.requester.username}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[var(--muted2)]">
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
                        <Check size={14} strokeWidth={2} />
                        Принять
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={busy && !answer.variables?.accept}
                        disabled={busy}
                        onClick={() => answer.mutate({ id: request.friendship_id, accept: false })}
                      >
                        <X size={14} strokeWidth={1.75} />
                        Отклонить
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
            <p className="mt-4 text-[13px] text-[var(--muted2)]">
              Принять или отклонить запрос можно и по ссылке из письма.
            </p>
          </Section>
        )}
      </div>

      <aside className="lg:sticky lg:top-24 lg:self-start">
        <Section title="Добавить друга">
          <form onSubmit={submit} className="mt-5 space-y-3">
            <Input
              name="friend-username"
              aria-label="Никнейм пользователя"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Введите никнейм пользователя"
              autoComplete="off"
            />
            <Button
              type="submit"
              className="w-full"
              loading={send.isPending}
              disabled={!username.trim()}
            >
              <UserPlus size={15} strokeWidth={1.75} />
              Отправить запрос
            </Button>
          </form>
          {notice && (
            <p
              role="status"
              className="mt-4 text-[14px] leading-relaxed"
              style={{ color: notice.tone === 'err' ? 'var(--err)' : 'var(--ok)' }}
            >
              {notice.text}
            </p>
          )}
        </Section>
      </aside>

      {/* Mounted for good once used, and only opened and closed: unmounted
          with its friend, the window vanished instead of animating out. */}
      {giftFor && (
        <GiftModal friend={giftFor} open={Boolean(gifting)} onClose={() => setGifting(null)} />
      )}
    </div>
  )
}
