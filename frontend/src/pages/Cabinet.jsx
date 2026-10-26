import { useEffect } from 'react'
import { ArrowRight, Gift, Ticket as TicketIcon, Users } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import useGifts from '../hooks/useGifts'
import useTickets from '../hooks/useTickets'
import FriendsPanel from '../components/friends/FriendsPanel'
import ReceivedGiftCard from '../components/tickets/ReceivedGiftCard'
import TicketCard from '../components/tickets/TicketCard'
import { ButtonLink } from '../components/ui/Button'
import { CONTAINER, EmptyState, PageHeader } from '../components/ui/Page'
import { Tabs } from '../components/ui/Tabs'
import { Reveal } from '../components/motion/Motion'
import { pluralize } from '../utils/plural'

const TABS = [
  { key: 'tickets', label: 'Мои билеты', icon: TicketIcon },
  { key: 'gifts', label: 'Подарки', icon: Gift },
  { key: 'friends', label: 'Друзья', icon: Users },
]

const DEFAULT_TAB = TABS[0].key

/** Ticket cards arrive one after another, like tickets dealt onto a table. */
const dealt = (index) => ({ '--delay': `${Math.min(index, 8) * 60}ms` })

/** Two columns of ticket-shaped blocks, while the list loads. */
function CardSkeletons({ height }) {
  return (
    <div className="grid gap-x-8 gap-y-6 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          aria-hidden
          style={{ animationDelay: `${index * 90}ms`, height }}
          className="skeleton mx-2 my-6 max-w-[540px] rounded-[14px]"
        />
      ))}
    </div>
  )
}

export default function Cabinet() {
  const { data: tickets, isLoading, isError } = useTickets()
  const { data: gifts, isLoading: giftsLoading, isError: giftsError } = useGifts()
  const [searchParams, setSearchParams] = useSearchParams()

  const requested = searchParams.get('tab')
  const active = TABS.some((tab) => tab.key === requested) ? requested : DEFAULT_TAB

  const selectTab = (key) => {
    const next = new URLSearchParams(searchParams)
    // The default tab needs no parameter, so a plain /cabinet stays plain.
    if (key === DEFAULT_TAB) next.delete('tab')
    else next.set('tab', key)
    setSearchParams(next, { replace: true })
  }

  // Arriving from a gift answered by its e-mailed link: say so once, open the
  // gifts tab, then tidy the address so a reload does not say it again.
  useEffect(() => {
    const outcome = searchParams.get('gift')
    if (!outcome) return
    if (outcome === 'accepted') toast.success('Подарок принят')
    else if (outcome === 'declined') toast('Подарок отклонён')
    const next = new URLSearchParams(searchParams)
    next.delete('gift')
    next.set('tab', 'gifts')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  // A gift waiting for an answer already sits with its recipient but is not
  // theirs yet, so it belongs in the gifts tab and nowhere else.
  const owned = (tickets ?? []).filter((ticket) => ticket.gift_status !== 'pending')
  const waiting = (gifts ?? []).filter((gift) => gift.gift_status === 'pending').length

  return (
    <div className={`${CONTAINER} pt-10 sm:pt-14`}>
      <PageHeader
        kicker="Кабинет"
        title={TABS.find((tab) => tab.key === active).label}
        meta={
          active === 'tickets' && owned.length > 0 ? (
            <span className="t-num">
              {pluralize(owned.length, 'билет', 'билета', 'билетов')} получено
            </span>
          ) : null
        }
        rule={false}
      />

      <Reveal delay={0.15} distance={8}>
        <Tabs
          className="mt-8"
          layoutId="cabinet-tab"
          value={active}
          onChange={selectTab}
          items={TABS.map((tab) => ({
            ...tab,
            badge: tab.key === 'gifts' ? waiting : 0,
          }))}
        />
      </Reveal>

      {/* Keyed by the tab, so each one arrives afresh when picked. */}
      <div key={active} className="anim-rise pt-10" style={{ '--rise': '12px' }}>
        {active === 'tickets' && (
          <>
            {isLoading && <CardSkeletons height={244} />}

            {isError && (
              <EmptyState title="Не загрузилось">Не удалось загрузить билеты.</EmptyState>
            )}

            {!isLoading && !isError && owned.length === 0 && (
              <EmptyState
                title="Билетов пока нет"
                action={
                  <ButtonLink to="/">
                    Открыть афишу
                    <ArrowRight size={15} strokeWidth={1.75} />
                  </ButtonLink>
                }
              >
                Выберите что-нибудь в афише — билет с QR-кодом появится здесь сразу после
                покупки.
              </EmptyState>
            )}

            <div className="-mx-2 grid gap-x-6 lg:grid-cols-2">
              {owned.map((ticket, index) => (
                <div key={ticket.id} className="anim-deal" style={dealt(index)}>
                  <TicketCard ticket={ticket} />
                </div>
              ))}
            </div>
          </>
        )}

        {active === 'gifts' &&
          (giftsLoading ? (
            <CardSkeletons height={220} />
          ) : giftsError ? (
            <EmptyState title="Не загрузилось">Не удалось загрузить подарки.</EmptyState>
          ) : gifts?.length ? (
            <div className="grid gap-6 lg:grid-cols-2">
              {gifts.map((gift, index) => (
                <div key={gift.id} className="anim-deal" style={dealt(index)}>
                  <ReceivedGiftCard gift={gift} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Подарков пока нет">
              Когда друг подарит вам билет, он появится здесь — его нужно будет принять.
            </EmptyState>
          ))}

        {active === 'friends' && <FriendsPanel />}
      </div>
    </div>
  )
}
