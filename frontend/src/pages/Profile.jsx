import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Camera, Check, KeyRound, Pencil, X } from 'lucide-react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { apiError } from '../api/client'
import { getFriends } from '../api/friends'
import { changePassword, updateProfile, uploadAvatar } from '../api/profile'
import useAuth from '../hooks/useAuth'
import useTickets from '../hooks/useTickets'
import Avatar from '../components/ui/Avatar'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Input from '../components/ui/Input'
import Modal from '../components/ui/Modal'
import { CONTAINER } from '../components/ui/Page'
import { AnimatedNumber, Reveal } from '../components/motion/Motion'
import { formatDate } from '../utils/dates'
import { ticketStartsAt } from '../utils/eventState'
import { STATE_LABELS, ticketState } from '../utils/ticketGroups'

/** A block opened by a heading in capitals over a hairline; `action` hangs right. */
function Panel({ title, action, children }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-3 border-b border-[var(--border)] pb-3">
        <h2 className="font-display text-[22px] font-bold uppercase leading-none text-[var(--text)]">
          {title}
        </h2>
        {action}
      </div>
      <div className="pt-5">{children}</div>
    </section>
  )
}

/** A figure set large, the way a paper prints the number that matters. */
function Stat({ label, value }) {
  return (
    <div className="py-7 pr-4 [&:not(:first-child)]:border-l [&:not(:first-child)]:border-[var(--border)] [&:not(:first-child)]:pl-5 sm:py-9 sm:[&:not(:first-child)]:pl-8">
      <dd className="t-poster text-[clamp(48px,8vw,96px)] text-[var(--text)]">
        <AnimatedNumber value={value} />
      </dd>
      <dt className="t-label mt-3">{label}</dt>
    </div>
  )
}

/** The name, editable in place: click, type, Enter to keep, Escape to leave. */
function UsernameField() {
  const { user, setUser } = useAuth()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(user?.username ?? '')
  const input = useRef(null)

  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  const save = useMutation({
    mutationFn: (username) => updateProfile({ username }),
    onSuccess: (fresh) => {
      setUser(fresh)
      setEditing(false)
      toast.success('Никнейм изменён')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось изменить никнейм')),
  })

  const commit = () => {
    const name = value.trim()
    if (!name || name === user?.username) {
      setEditing(false)
      setValue(user?.username ?? '')
      return
    }
    save.mutate(name)
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(user?.username ?? '')
          setEditing(true)
        }}
        title="Изменить никнейм"
        className="group inline-flex max-w-full items-end gap-3 text-left"
      >
        <span className="t-poster truncate pb-[0.04em] text-[clamp(52px,8vw,104px)] text-[var(--text)]">
          {user?.username}
        </span>
        <Pencil
          size={18}
          strokeWidth={1.75}
          className="mb-[0.6em] shrink-0 text-[var(--muted2)] transition-colors duration-200 group-hover:text-[var(--accent)]"
        />
      </button>
    )
  }

  return (
    <div className="flex max-w-xl items-center gap-2">
      <input
        ref={input}
        value={value}
        maxLength={64}
        aria-label="Никнейм"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
          if (event.key === 'Escape') {
            setEditing(false)
            setValue(user?.username ?? '')
          }
        }}
        className="t-poster min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--accent)] bg-[var(--surface)] px-3 pb-1 pt-2 text-[44px] text-[var(--text)] shadow-[0_0_0_3px_var(--accent-dim)] outline-none"
      />
      <Button loading={save.isPending} onClick={commit} aria-label="Сохранить никнейм">
        <Check size={16} strokeWidth={2} />
      </Button>
      <Button
        variant="ghost"
        disabled={save.isPending}
        onClick={() => setEditing(false)}
        aria-label="Отменить"
      >
        <X size={16} strokeWidth={1.75} />
      </Button>
    </div>
  )
}

const EMPTY_PASSWORDS = { current: '', next: '', confirm: '' }

function PasswordModal({ open, onClose }) {
  const [form, setForm] = useState(EMPTY_PASSWORDS)
  const [problem, setProblem] = useState(null)

  useEffect(() => {
    if (!open) {
      setForm(EMPTY_PASSWORDS)
      setProblem(null)
    }
  }, [open])

  const save = useMutation({
    mutationFn: () => changePassword({ current_password: form.current, new_password: form.next }),
    onSuccess: () => {
      toast.success('Пароль изменён')
      onClose()
    },
    onError: (error) => setProblem(apiError(error, 'Не удалось изменить пароль')),
  })

  const submit = () => {
    if (!form.current) return setProblem('Введите текущий пароль')
    if (form.next.length < 6) return setProblem('Новый пароль — от 6 символов')
    if (form.next !== form.confirm) return setProblem('Пароли не совпадают')
    setProblem(null)
    return save.mutate()
  }

  const field = (key) => (event) => setForm({ ...form, [key]: event.target.value })

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="md"
      title="Изменить пароль"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button loading={save.isPending} onClick={submit}>
            Сохранить
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input label="Текущий пароль" name="current-password" type="password" autoComplete="current-password" value={form.current} onChange={field('current')} />
        <Input label="Новый пароль" name="new-password" type="password" autoComplete="new-password" value={form.next} onChange={field('next')} />
        <Input label="Повторите новый пароль" name="confirm-password" type="password" autoComplete="new-password" value={form.confirm} onChange={field('confirm')} />
        {problem && (
          <p role="alert" className="text-[14px] text-[var(--err)]">
            {problem}
          </p>
        )}
      </div>
    </Modal>
  )
}

export default function Profile() {
  const { user, setUser } = useAuth()
  const fileInput = useRef(null)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const { data: tickets } = useTickets()
  const { data: friends } = useQuery({ queryKey: ['friends'], queryFn: getFriends })

  const avatar = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (fresh) => {
      setUser(fresh)
      toast.success('Фото обновлено')
    },
    onError: (error) => toast.error(apiError(error, 'Не удалось загрузить фото')),
  })

  // The same tickets the cabinet shows: a gift still waiting for an answer
  // sits with its recipient but is not theirs yet, so it is not counted here,
  // listed among the recent ones, or taken as a visit.
  const owned = (tickets ?? []).filter((ticket) => ticket.gift_status !== 'pending')
  const visited = new Set(owned.filter((ticket) => ticket.used).map((ticket) => ticket.event_id))
  const recent = [...owned]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  return (
    <div className={`${CONTAINER} pt-10 sm:pt-14`}>
      <Reveal
        as="header"
        distance={12}
        className="grid gap-x-10 gap-y-6 border-b border-[var(--border)] pb-10 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-end"
      >
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={avatar.isPending}
          title="Загрузить фото"
          aria-label="Загрузить фото"
          className="group relative w-fit shrink-0 rounded-full"
        >
          <Avatar username={user?.username} src={user?.avatar_url} size={120} />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            <Camera size={22} strokeWidth={1.75} />
          </span>
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) avatar.mutate(file)
          }}
        />

        <div className="min-w-0">
          <p className="t-label mb-3">Профиль</p>
          <UsernameField />
          <p className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-[var(--muted)]">
            <span className="truncate">{user?.email}</span>
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="t-link inline-flex items-center gap-1.5 text-[var(--text)]"
            >
              <KeyRound size={14} strokeWidth={1.75} /> Изменить пароль
            </button>
          </p>
        </div>
      </Reveal>

      <Reveal as="dl" delay={0.12} className="grid grid-cols-3 border-b border-[var(--border)]">
        <Stat label="Билетов получено" value={owned.length} />
        <Stat label="Друзей" value={friends?.length ?? 0} />
        <Stat label="Мероприятий посещено" value={visited.size} />
      </Reveal>

      <Reveal delay={0.22} className="mt-14 grid gap-14 md:grid-cols-2 md:gap-12">
        <Panel
          title="Друзья"
          action={
            <Link
              to="/cabinet?tab=friends"
              className="t-link text-[14px] text-[var(--muted)] hover:text-[var(--text)]"
            >
              Все друзья
            </Link>
          }
        >
          {friends?.length ? (
            <div className="flex flex-wrap gap-4">
              {friends.slice(0, 6).map((friend) => (
                <div
                  key={friend.user_id}
                  className="flex w-[72px] flex-col items-center gap-2"
                  title={friend.username}
                >
                  <Avatar username={friend.username} src={friend.avatar_url} size={56} />
                  <span className="w-full truncate text-center text-[12px] text-[var(--muted)]">
                    {friend.username}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[15px] text-[var(--muted)]">Друзей пока нет.</p>
          )}
        </Panel>

        <Panel
          title="Последние билеты"
          action={
            <Link
              to="/cabinet"
              className="t-link text-[14px] text-[var(--muted)] hover:text-[var(--text)]"
            >
              Все билеты
            </Link>
          }
        >
          {recent.length ? (
            <ul className="-mt-2">
              {recent.map((ticket) => {
                const state = ticketState(ticket)
                return (
                  <li
                    key={ticket.id}
                    className="flex items-center gap-4 border-b border-[var(--border)] py-3 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] text-[var(--text)]">{ticket.event_title}</p>
                      <p className="t-num mt-0.5 text-[13px] text-[var(--muted2)]">
                        {formatDate(ticketStartsAt(ticket))}
                      </p>
                    </div>
                    <Badge tone={state}>{STATE_LABELS[state]}</Badge>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-[15px] text-[var(--muted)]">Билетов пока нет.</p>
          )}
        </Panel>
      </Reveal>

      <PasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  )
}
