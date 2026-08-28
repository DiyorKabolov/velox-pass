import useTickets from '../hooks/useTickets'
import TicketCard from '../components/tickets/TicketCard'
import { pluralize } from '../utils/plural'

export default function Cabinet() {
  const { data: tickets, isLoading, isError } = useTickets()

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <header className="mb-12 text-center">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.28em] text-[var(--muted2)]">
          Личный кабинет
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
          Мои билеты
        </h1>
        {tickets?.length > 0 && (
          <p className="mt-3 text-sm text-[var(--muted)]">
            {pluralize(tickets.length, 'билет', 'билета', 'билетов')} получено
          </p>
        )}
      </header>

      {isLoading && (
        <div className="flex flex-wrap justify-center gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-[268px] w-full max-w-[540px] animate-pulse rounded-[18px] bg-[var(--surface)]"
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-center text-sm text-[var(--err)]">
          Не удалось загрузить билеты.
        </p>
      )}

      {!isLoading && !isError && tickets?.length === 0 && (
        <p className="text-center text-sm text-[var(--muted)]">
          Билетов пока нет. Выберите что-нибудь в афише.
        </p>
      )}

      <div className="flex flex-wrap justify-center gap-6">
        {tickets?.map((ticket) => (
          <TicketCard key={ticket.id} ticket={ticket} />
        ))}
      </div>
    </div>
  )
}
