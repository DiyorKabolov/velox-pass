from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tags import clean_tags, unknown_tags
from app.models.event import Event
from app.models.seat import Seat
from app.models.session import Session
from app.models.ticket import Ticket
from app.schemas.event import EventOut
from app.schemas.session import SessionOut

router = APIRouter(prefix="/events", tags=["events"])

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
    tags: str | None = Query(
        None, description="Через запятую; вернутся события с любым из тегов"
    ),
    db: AsyncSession = Depends(get_db),
):
    """Public event listing used by the home page."""
    query = select(Event).order_by(Event.date.asc())
    if upcoming_only:
        query = query.where(Event.date >= func.now())

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
