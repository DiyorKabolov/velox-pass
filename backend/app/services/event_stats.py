"""How full an event is.

An unseated event carries its own capacity; a seated one does not -- its seats
belong to the halls its showings are scheduled in, so "capacity" is the sum over
those showings and changes whenever a session is added or cancelled. Both
answers are computed here so the public listing, the event page and the admin
tables cannot drift apart, which is exactly what happened while each of them
counted for itself.

Everything is written in bulk: given a page of events it is a fixed handful of
queries rather than a pair per event. The catalogue is unpaginated and a cinema
season can hold a couple of hundred showings, so a per-row round trip grows
without bound.
"""
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.event import Event
from app.models.hall import Hall
from app.models.seat import Seat
from app.models.seat_price import SeatPrice
from app.models.session import Session
from app.models.ticket import Ticket
from app.schemas.event import EventOut

# A showing in one of these no longer sells anything, so it contributes neither
# seats nor sales to what an event has on offer.
DEAD_SESSION_STATUSES = ("cancelled", "finished")


@dataclass
class SessionStat:
    """One showing with its own capacity and sales."""

    session_id: int
    event_id: int
    datetime: datetime
    hall_id: int | None
    hall_name: str | None
    venue_name: str | None
    status: str
    recurring_group_id: str | None
    capacity: int = 0
    sold: int = 0
    min_price: float | None = None

    @property
    def available(self) -> int:
        return max(self.capacity - self.sold, 0)

    @property
    def state(self) -> str:
        """"active" / "finished" / "cancelled", which is what a reader wants.

        The stored status has five values and says nothing about the clock: a
        showing left at "scheduled" is over once its time has passed, and every
        table that drew the raw status called last week's showing active.
        """
        if self.status == "cancelled":
            return "cancelled"
        if self.status == "finished" or self.datetime < _now():
            return "finished"
        return "active"


@dataclass
class EventStat:
    """What one event has on sale, whichever kind of event it is."""

    capacity: int = 0
    sold: int = 0
    # Every ticket ever issued for the event, including ones belonging to a
    # showing that has since been cancelled. `sold` counts only what is on
    # offer now, so the two differ and both are worth reporting.
    tickets_total: int = 0
    sessions_count: int = 0
    has_active_session: bool = False
    sessions: list[SessionStat] = field(default_factory=list)

    @property
    def available(self) -> int:
        # No live showing means nothing is on sale, however many seats the
        # halls happen to hold.
        if self.sessions_count and not self.has_active_session:
            return 0
        return max(self.capacity - self.sold, 0)


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def sold_by_event(db: AsyncSession, event_ids: list[int]) -> dict[int, int]:
    """Tickets issued per event, counting every showing and every seat."""
    if not event_ids:
        return {}
    rows = await db.execute(
        select(Ticket.event_id, func.count(Ticket.id))
        .where(Ticket.event_id.in_(event_ids))
        .group_by(Ticket.event_id)
    )
    return {event_id: count for event_id, count in rows.all()}


async def session_stats(
    db: AsyncSession,
    event_ids: list[int],
    *,
    include_inactive: bool = False,
) -> dict[int, list[SessionStat]]:
    """Every showing of the given events, chronological, with its numbers.

    `include_inactive` decides whether cancelled and finished showings come
    along: the admin tables want the whole history, the public listing wants
    only what can still be sold.
    """
    if not event_ids:
        return {}

    query = select(
        Session.id,
        Session.event_id,
        Session.hall_id,
        Session.datetime,
        Session.status,
        Session.recurring_group_id,
    ).where(Session.event_id.in_(event_ids))
    if not include_inactive:
        query = query.where(Session.status.not_in(DEAD_SESSION_STATUSES))
    rows = (await db.execute(query.order_by(Session.datetime.asc()))).all()
    if not rows:
        return {}

    session_ids = [row[0] for row in rows]
    hall_ids = {row[2] for row in rows if row[2] is not None}

    halls: dict[int, tuple[str, str | None]] = {}
    seats_per_hall: dict[int, int] = {}
    if hall_ids:
        halls = {
            hall_id: (hall_name, venue_name)
            for hall_id, hall_name, venue_name in (
                await db.execute(
                    select(Hall.id, Hall.name, Hall.venue_id)
                    .where(Hall.id.in_(hall_ids))
                )
            ).all()
        }
        # Aisles keep the grid aligned but can never be sold, so they are not
        # capacity.
        seats_per_hall = {
            hall_id: count
            for hall_id, count in (
                await db.execute(
                    select(Seat.hall_id, func.count(Seat.id))
                    .where(Seat.hall_id.in_(hall_ids), Seat.is_aisle.is_(False))
                    .group_by(Seat.hall_id)
                )
            ).all()
        }

    # Venue names come from a second pass rather than a join, so a hall whose
    # venue was deleted still reports its own name.
    venue_ids = {value for _, value in halls.values() if value is not None}
    venue_names: dict[int, str] = {}
    if venue_ids:
        from app.models.venue import Venue

        venue_names = {
            venue_id: name
            for venue_id, name in (
                await db.execute(
                    select(Venue.id, Venue.name).where(Venue.id.in_(venue_ids))
                )
            ).all()
        }

    # Every ticket sold for a showing occupies a seat in it, scanned or not.
    # Counting only unscanned ones would hand seats back as the audience walked
    # in. For a seated event a ticket always carries a seat, so this is the same
    # number as counting seat-bearing tickets, without depending on that.
    sold_per_session = {
        session_id: count
        for session_id, count in (
            await db.execute(
                select(Ticket.session_id, func.count(Ticket.id))
                .where(Ticket.session_id.in_(session_ids))
                .group_by(Ticket.session_id)
            )
        ).all()
    }

    min_price_per_session = {
        session_id: float(price)
        for session_id, price in (
            await db.execute(
                select(SeatPrice.session_id, func.min(SeatPrice.price))
                .where(SeatPrice.session_id.in_(session_ids))
                .group_by(SeatPrice.session_id)
            )
        ).all()
        if price is not None
    }

    grouped: dict[int, list[SessionStat]] = {}
    for session_id, event_id, hall_id, moment, status, group_id in rows:
        hall_name, venue_id = halls.get(hall_id, (None, None))
        grouped.setdefault(event_id, []).append(
            SessionStat(
                session_id=session_id,
                event_id=event_id,
                datetime=moment,
                hall_id=hall_id,
                hall_name=hall_name,
                venue_name=venue_names.get(venue_id) if venue_id else None,
                status=status,
                recurring_group_id=group_id,
                capacity=seats_per_hall.get(hall_id, 0),
                sold=sold_per_session.get(session_id, 0),
                min_price=min_price_per_session.get(session_id),
            )
        )
    return grouped


async def event_stats(db: AsyncSession, events: list[Event]) -> dict[int, EventStat]:
    """Capacity and sales for a whole page of events, in a fixed set of queries."""
    if not events:
        return {}

    sold = await sold_by_event(db, [event.id for event in events])
    seated_ids = [event.id for event in events if event.has_seats]
    # Only live showings count towards what is on offer; the admin breakdown
    # asks for the rest separately.
    per_event = await session_stats(db, seated_ids)

    stats: dict[int, EventStat] = {}
    for event in events:
        event_sold = sold.get(event.id, 0)
        if not event.has_seats:
            stats[event.id] = EventStat(
                capacity=event.capacity or 0,
                sold=event_sold,
                tickets_total=event_sold,
                sessions_count=0,
                has_active_session=True,
            )
            continue

        rows = per_event.get(event.id, [])
        stats[event.id] = EventStat(
            capacity=sum(row.capacity for row in rows),
            # Summed over the showings rather than taken from the ticket count:
            # the two agree for a seated event, and this one stays right if a
            # showing is later moved to another event.
            sold=sum(row.sold for row in rows),
            tickets_total=event_sold,
            sessions_count=len(rows),
            has_active_session=any(row.state == "active" for row in rows),
            sessions=rows,
        )
    return stats


async def get_event_stats(event_id: int, db: AsyncSession) -> EventStat | None:
    """The same numbers for a single event. None when there is no such event."""
    event = await db.get(Event, event_id)
    if event is None:
        return None
    return (await event_stats(db, [event]))[event_id]


def build_event_out(event: Event, stat: EventStat) -> EventOut:
    """One event as the API reports it, capacity included."""
    payload = EventOut.model_validate(event)
    payload.tickets_sold = stat.tickets_total
    # Only an unseated event has a capacity of its own to subtract from.
    payload.seats_left = (
        max(event.capacity - stat.tickets_total, 0) if event.capacity else 0
    )
    payload.total_seats = stat.capacity
    payload.available_seats = stat.available
    payload.has_active_session = stat.has_active_session
    payload.sessions_count = stat.sessions_count
    return payload


async def serialize_events(db: AsyncSession, events: list[Event]) -> list[EventOut]:
    """A page of events with their real capacity.

    Used by the public listing and by the admin tables alike: counted
    separately, the two disagreed, and the admin side showed a seated event as
    having no capacity at all.
    """
    stats = await event_stats(db, events)
    return [build_event_out(event, stats[event.id]) for event in events]
