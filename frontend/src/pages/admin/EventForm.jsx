import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { createEvent } from '../../api/events'
import { apiError } from '../../api/client'
import Button from '../../components/ui/Button'
import EventEditor from '../../components/admin/EventEditor'
import { EMPTY_EVENT, toPayload, validate } from '../../components/admin/eventForm'

function Crumb({ to, children }) {
  return to ? (
    <Link
      to={to}
      className="transition-colors duration-150 hover:text-[var(--text)]"
    >
      {children}
    </Link>
  ) : (
    <span className="text-[var(--text)]">{children}</span>
  )
}

export default function EventForm() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ ...EMPTY_EVENT })

  const create = useMutation({
    mutationFn: createEvent,
    onSuccess: (event) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'events'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      toast.success(`"${event.title}" created`)
      navigate('/admin/events')
    },
    onError: (error) => toast.error(apiError(error, 'Could not create the event')),
  })

  const handleSubmit = (submitEvent) => {
    submitEvent.preventDefault()
    const problem = validate(form)
    if (problem) {
      toast.error(problem)
      return
    }
    create.mutate(toPayload(form))
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-1.5 text-sm text-[var(--muted)]"
      >
        <Crumb to="/admin">Admin</Crumb>
        <ChevronRight size={14} className="opacity-50" />
        <Crumb to="/admin/events">Events</Crumb>
        <ChevronRight size={14} className="opacity-50" />
        <Crumb>New Event</Crumb>
      </nav>

      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl tracking-tight">New event</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Colours picked here are baked into every ticket for this event.
          </p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/admin/events')}>
          <ArrowLeft size={15} />
          Back
        </Button>
      </header>

      <form onSubmit={handleSubmit}>
        <EventEditor form={form} onChange={setForm} />

        <div className="mt-8 flex items-center justify-end gap-3 border-t border-[var(--border)] pt-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate('/admin/events')}
          >
            Cancel
          </Button>
          <Button type="submit" loading={create.isPending}>
            Create event
          </Button>
        </div>
      </form>
    </div>
  )
}
