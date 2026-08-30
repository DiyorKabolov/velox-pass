from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import bearer_scheme, user_venue_ids
from app.core.security import verify_token
from app.core.tags import clean_tags, unknown_tags
from app.models.event import Event
from app.models.hall import Hall
from app.models.seat import Seat
from app.models.session import Session
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.event import EventOut
from app.schemas.session import SessionOut

router = APIRouter(prefix="/events", tags=["events"])


async def get_optional_user(
    db: AsyncSession = Depends(get_db),
    credentials=Depends(bearer_scheme),
) -> User | None:
    """The signed-in user, or None. The listing stays public, so a missing or
    stale token must not turn into a 401 for an anonymous visitor."""
    if credentials is None:
        return None
    user_id = verify_token(credentials.credentials)
    return await db.get(User, user_id) if user_id else None

# A showing that no longer sells seats contributes nothing to what is on offer.
DEAD_SESSION_STATUSES = ("cancelled", "finished")


async def _sold_by_event(db: AsyncSession, event_ids: list[int]) -> dict[int, int]:
    if not event_ids:
        return {}
    result = await db.execute(
        select(Ticket.event_id, func.count(Ticket.id))
        .where(Ticket.event_id.in_(event_ids))
        .group_by(Ticket.event_id)
    )
    return {event_id: count for event_id, count in result.all()}


async def _seat_stats(
    db: AsyncSession, event_ids: list[int]
) -> dict[int, tuple[int, int, bool]]:
    """Seats on sale and seats still free, per seated event.

    Three queries for the whole page rather than a pair per event: the listing
    is public and unpaginated, so a per-event round trip would grow with the
    catalogue.

    Returns {event_id: (total_seats, taken_seats, has_active_session)}.
    """
    if not event_ids:
        return {}

    sessions = (
        await db.execute(
            select(Session.id, Session.event_id, Session.hall_id).where(
                Session.event_id.in_(event_ids),
                Session.status.not_in(DEAD_SESSION_STATUSES),
            )
        )
    ).all()
    if not sessions:
        return {}

    hall_ids = {hall_id for _, _, hall_id in sessions if hall_id is not None}
    session_ids = [session_id for session_id, _, _ in sessions]

    # Aisles are grid spacers, not seats, and can never be sold.
    seats_per_hall = {
        hall_id: count
        for hall_id, count in (
            await db.execute(
                select(Seat.hall_id, func.count(Seat.id))
                .where(Seat.hall_id.in_(hall_ids), Seat.is_aisle.is_(False))
                .group_by(Seat.hall_id)
            )
        ).all()
    } if hall_ids else {}

    # Every ticket holding a seat occupies it, scanned or not. Counting only
    # unscanned ones would hand seats back as the audience walked in.
    taken_per_session = {
        session_id: count
        for session_id, count in (
            await db.execute(
                select(Ticket.session_id, func.count(Ticket.id))
                .where(Ticket.session_id.in_(session_ids), Ticket.seat_id.is_not(None))
                .group_by(Ticket.session_id)
            )
        ).all()
    }

    stats: dict[int, tuple[int, int, bool]] = {}
    for session_id, event_id, hall_id in sessions:
        total, taken, _ = stats.get(event_id, (0, 0, False))
        stats[event_id] = (
            total + seats_per_hall.get(hall_id, 0),
            taken + taken_per_session.get(session_id, 0),
            True,
        )
    return stats


def _build(
    event: Event,
    sold: int,
    seat_stats: tuple[int, int, bool] | None,
) -> EventOut:
    payload = EventOut.model_validate(event)
    payload.tickets_sold = sold
    payload.seats_left = max(event.capacity - sold, 0) if event.capacity else 0

    if event.has_seats:
        total, taken, active = seat_stats or (0, 0, False)
        payload.has_active_session = active
        payload.total_seats = total
        # No live showing means nothing is on sale, however many seats the hall
        # happens to hold.
        payload.available_seats = max(total - taken, 0) if active else 0
    else:
        payload.has_active_session = True
        payload.total_seats = event.capacity or 0
        payload.available_seats = payload.seats_left

    return payload


async def _serialize(db: AsyncSession, events: list[Event]) -> list[EventOut]:
    ids = [event.id for event in events]
    sold = await _sold_by_event(db, ids)
    stats = await _seat_stats(db, [e.id for e in events if e.has_seats])
    return [_build(e, sold.get(e.id, 0), stats.get(e.id)) for e in events]


@router.get("", response_model=list[EventOut])
async def list_events(
    upcoming_only: bool = False,
    my_venues: bool = Query(
        False,
        description="Только события площадок, закреплённых за текущим пользователем",
    ),
    tags: str | None = Query(
        None, description="Через запятую; вернутся события с любым из тегов"
    ),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Public event listing used by the home page.

    Narrowing to the caller's own venues is opt-in through `my_venues`, never
    automatic. A venue administrator is also an ordinary customer, and silently
    hiding every other venue's events would leave them browsing a catalogue
    with most of it missing.
    """
    query = select(Event).order_by(Event.date.asc())
    if upcoming_only:
        query = query.where(Event.date >= func.now())

    if my_venues:
        if user is None:
            raise HTTPException(status_code=401, detail="Необходима авторизация")
        if user.role == "superadmin":
            pass  # every venue, so no narrowing
        else:
            venue_ids = await user_venue_ids(db, user)
            if not venue_ids:
                return []
            # An event reaches a venue two ways: its own venue_id, or a showing
            # scheduled in one of that venue's halls. Only the second is set in
            # practice -- events are created without a venue and bound to one
            # later by their sessions -- so filtering on venue_id alone would
            # return nothing at all.
            in_my_halls = (
                select(Session.id)
                .join(Hall, Hall.id == Session.hall_id)
                .where(Session.event_id == Event.id, Hall.venue_id.in_(venue_ids))
                .exists()
            )
            query = query.where(
                or_(Event.venue_id.in_(venue_ids), in_my_halls)
            )

    if tags:
        wanted = [part.strip() for part in tags.split(",")]
        strays = unknown_tags(wanted)
        if strays:
            raise HTTPException(
                status_code=400, detail=f"Неизвестные теги: {', '.join(strays)}"
            )
        wanted = clean_tags(wanted)
        if wanted:
            # && is "arrays overlap": keep events carrying any of the tags.
            query = query.where(Event.tags.overlap(wanted))

    result = await db.execute(query)
    return await _serialize(db, list(result.scalars().all()))


@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: int, db: AsyncSession = Depends(get_db)):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")
    return (await _serialize(db, [event]))[0]


@router.get("/{event_id}/sessions", response_model=list[SessionOut])
async def event_sessions(event_id: int, db: AsyncSession = Depends(get_db)):
    """Showings of one event, soonest first. Cancelled ones are kept out."""
    from app.routers.sessions import build_session_out

    if not await db.get(Event, event_id):
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")

    result = await db.execute(
        select(Session)
        .where(Session.event_id == event_id, Session.status != "cancelled")
        .order_by(Session.datetime.asc())
    )
    return [await build_session_out(db, s) for s in result.scalars().all()]
