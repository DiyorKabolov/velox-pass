import useTickets from '../hooks/useTickets'
import TicketCard from '../components/tickets/TicketCard'

export default function Cabinet() {
  const { data: tickets, isLoading, isError } = useTickets()

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <header className="mb-12 text-center">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.28em] text-[var(--muted2)]">
          Personal cabinet
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">
          My tickets
        </h1>
        {tickets?.length > 0 && (
          <p className="mt-3 text-sm text-[var(--muted)]">
            {tickets.length} ticket{tickets.length === 1 ? '' : 's'} issued
          </p>
        )}
      </header>

      {isLoading && (
        <div className="flex flex-wrap justify-center gap-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-[210px] w-full max-w-[520px] animate-pulse rounded-[18px] bg-[var(--surface)]"
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-center text-sm text-[var(--err)]">
          Could not load your tickets.
        </p>
      )}

      {!isLoading && !isError && tickets?.length === 0 && (
        <p className="text-center text-sm text-[var(--muted)]">
          You have no tickets yet. Pick something from the афиша.
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
