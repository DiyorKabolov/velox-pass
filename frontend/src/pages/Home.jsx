import { motion } from 'framer-motion'
import { useEvents } from '../hooks/useEvents'
import EventCard from '../components/events/EventCard'

export default function Home() {
  const { data: events, isLoading, isError } = useEvents()

  return (
    <div className="mx-auto max-w-6xl px-5 py-14">
      <header className="mb-12 text-center">
        <p className="font-mono2 text-[11px] uppercase tracking-[0.28em] text-[var(--muted2)]">
          Now on sale
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight sm:text-4xl">Афиша</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-[var(--muted)]">
          Pick an event, choose your seat and get a QR ticket instantly.
        </p>
      </header>

      {isLoading && (
        <div className="flex flex-wrap justify-center gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-[218px] w-[290px] animate-pulse rounded-[var(--radius)] bg-[var(--surface)]"
            />
          ))}
        </div>
      )}

      {isError && (
        <p className="text-center text-sm text-[var(--err)]">
          Could not load events. Is the API running?
        </p>
      )}

      {!isLoading && !isError && events?.length === 0 && (
        <p className="text-center text-sm text-[var(--muted)]">
          No events published yet — check back soon.
        </p>
      )}

      <motion.div
        className="flex flex-wrap justify-center gap-6"
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.07 } } }}
      >
        {events?.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </motion.div>
    </div>
  )
}
