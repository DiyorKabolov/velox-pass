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
import { formatDate } from '../utils/dates'
import { ticketStartsAt } from '../utils/eventState'
import { STATE_LABELS, ticketState } from '../utils/ticketGroups'

function Panel({ title, action, children }) {
  return (
    <section className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-base tracking-tight">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Stat({ label, value }) {
  return (
    <div className="rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 text-center">
      <p className="font-display text-2xl tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-[var(--muted)]">{label}</p>
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
        className="group inline-flex max-w-full items-center gap-2 text-left"
      >
        <span className="truncate font-display text-2xl tracking-tight">{user?.username}</span>
        <Pencil size={15} className="shrink-0 text-[var(--muted2)] transition-colors group-hover:text-[var(--accent)]" />
      </button>
    )
  }

  return (
    <div className="flex max-w-sm items-center gap-2">
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
        className="min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--accent)] bg-[var(--surface2)] px-3 py-1.5 font-display text-xl text-[var(--text)] outline-none"
      />
      <Button size="sm" loading={save.isPending} onClick={commit} aria-label="Сохранить никнейм">
        <Check size={14} />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={save.isPending}
        onClick={() => setEditing(false)}
        aria-label="Отменить"
      >
        <X size={14} />
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
          <p role="alert" className="text-sm text-[var(--err)]">
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

  const visited = new Set((tickets ?? []).filter((ticket) => ticket.used).map((ticket) => ticket.event_id))
  const recent = [...(tickets ?? [])]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-12">
      <header className="flex flex-wrap items-center gap-5 rounded-[var(--radius)] border border-[var(--border)] bg-[var(--surface)] p-6">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          disabled={avatar.isPending}
          title="Загрузить фото"
          aria-label="Загрузить фото"
          className="group relative shrink-0 rounded-full"
        >
          <Avatar username={user?.username} src={user?.avatar_url} size={80} />
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size={20} />
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

        <div className="min-w-0 flex-1">
          <UsernameField />
          <p className="mt-1 truncate text-sm text-[var(--muted)]">{user?.email}</p>
          <button
            type="button"
            onClick={() => setPasswordOpen(true)}
            className="mt-2 inline-flex items-center gap-1.5 text-sm text-[var(--accent)] hover:underline"
          >
            <KeyRound size={14} /> Изменить пароль
          </button>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Билетов получено" value={tickets?.length ?? 0} />
        <Stat label="Друзей" value={friends?.length ?? 0} />
        <Stat label="Мероприятий посещено" value={visited.size} />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel
          title="Друзья"
          action={
            <Link to="/friends" className="text-sm text-[var(--accent)] hover:underline">
              Все друзья →
            </Link>
          }
        >
          {friends?.length ? (
            <div className="flex flex-wrap gap-3">
              {friends.slice(0, 6).map((friend) => (
                <div key={friend.user_id} className="flex w-16 flex-col items-center gap-1.5" title={friend.username}>
                  <Avatar username={friend.username} src={friend.avatar_url} size={48} />
                  <span className="w-full truncate text-center text-[11px] text-[var(--muted)]">
                    {friend.username}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Друзей пока нет.</p>
          )}
        </Panel>

        <Panel
          title="Последние билеты"
          action={
            <Link to="/cabinet" className="text-sm text-[var(--accent)] hover:underline">
              Все билеты →
            </Link>
          }
        >
          {recent.length ? (
            <ul className="divide-y divide-[var(--border)]">
              {recent.map((ticket) => {
                const state = ticketState(ticket)
                return (
                  <li key={ticket.id} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{ticket.event_title}</p>
                      <p className="text-xs text-[var(--muted2)]">{formatDate(ticketStartsAt(ticket))}</p>
                    </div>
                    <Badge tone={state}>{STATE_LABELS[state]}</Badge>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-sm text-[var(--muted)]">Билетов пока нет.</p>
          )}
        </Panel>
      </div>

      <PasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  )
}
