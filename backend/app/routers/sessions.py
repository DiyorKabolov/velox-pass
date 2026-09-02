from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_staff, user_venue_ids
from app.models.user import User
from app.core.websocket_manager import manager
from app.models.event import Event
from app.models.hall import Hall
from app.models.seat import Seat
from app.models.seat_price import SeatPrice
from app.models.session import Session
from app.models.ticket import Ticket
from app.models.venue import Venue
from fastapi import Query
from app.schemas.session import (
    MAX_RECURRING_SESSIONS,
    SeatMapOut,
    SeatMapSeat,
    SeatPriceOut,
    SessionCreate,
    SessionGroupOut,
    SessionOut,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])


async def build_session_out(db: AsyncSession, session: Session) -> SessionOut:
    """One session enriched with the names and counters the UI shows."""
    # Built by hand: SessionOut.prices collides with the lazy Session.prices
    # relationship, and touching it on an async session raises MissingGreenlet.
    item = SessionOut(
        id=session.id,
        event_id=session.event_id,
        hall_id=session.hall_id,
        datetime=session.datetime,
        status=session.status,
        recurring_group_id=session.recurring_group_id,
    )

    event = await db.get(Event, session.event_id)
    item.event_title = event.title if event else None

    if session.hall_id:
        hall = await db.get(Hall, session.hall_id)
        if hall:
            item.hall_name = hall.name
            venue = await db.get(Venue, hall.venue_id)
            item.venue_name = venue.name if venue else None
            # Aisles are structural, never on sale.
            item.seats_total = await db.scalar(
                select(func.count(Seat.id)).where(
                    Seat.hall_id == hall.id, Seat.is_aisle.is_(False)
                )
            )

    item.seats_taken = await db.scalar(
        select(func.count(Ticket.id)).where(
            Ticket.session_id == session.id, Ticket.seat_id.is_not(None)
        )
    )
    item.seats_free = max(item.seats_total - item.seats_taken, 0)

    prices = await db.execute(
        select(SeatPrice).where(SeatPrice.session_id == session.id)
    )
    item.prices = [
        SeatPriceOut(category=p.category, price=float(p.price))
        for p in prices.scalars().all()
    ]
    return item


async def _allowed_venue_ids(db: AsyncSession, user: User) -> list[int] | None:
    """Venues the caller may schedule in, or None for "any"."""
    if user.role == "superadmin":
        return None
    return await user_venue_ids(db, user, role="venue_admin")


@router.get("", response_model=list[SessionOut])
async def list_sessions(
    my_venues: bool = Query(
        False, description="Только сеансы площадок, закреплённых за пользователем"
    ),
    event_id: int | None = None,
    include_cancelled: bool = False,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Sessions for the staff screens, newest showing last."""
    query = (
        select(Session)
        .join(Event, Event.id == Session.event_id)
        .outerjoin(Hall, Hall.id == Session.hall_id)
        .order_by(Session.datetime.asc())
    )
    if not include_cancelled:
        query = query.where(Session.status != "cancelled")
    if event_id is not None:
        query = query.where(Session.event_id == event_id)

    if my_venues:
        allowed = await _allowed_venue_ids(db, user)
        if allowed is not None:
            if not allowed:
                return []
            # The hall is what actually ties a showing to a venue: events
            # are created without a venue_id and only reach one through the
            # hall their session runs in. The event's own venue_id is honoured
            # too, for the events that do carry one.
            query = query.where(
                or_(Hall.venue_id.in_(allowed), Event.venue_id.in_(allowed))
            )

    result = await db.execute(query)
    return [await build_session_out(db, s) for s in result.scalars().all()]


@router.post("", response_model=None, status_code=201)
async def create_session(
    data: SessionCreate,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
) -> SessionOut | SessionGroupOut:
    """Create a showing plus its per-category prices, or a whole series of them.

    Which one is asked for is decided by `is_recurring`; the reply differs to
    match, a single session for one and a summary of the series for the other.
    """
    event = await db.get(Event, data.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")
    hall = await db.get(Hall, data.hall_id)
    if not hall:
        raise HTTPException(status_code=404, detail="Зал не найден")

    # Being staff is not enough: without this any venue administrator could
    # schedule a showing in somebody else's hall.
    allowed = await _allowed_venue_ids(db, user)
    if allowed is not None and hall.venue_id not in allowed:
        raise HTTPException(status_code=403, detail="Этот зал вам не назначен")

    # Last value wins if a category is listed twice.
    prices = {price.category: price.price for price in data.prices}

    # A session only makes sense for a seated event.
    if not event.has_seats:
        event.has_seats = True

    if data.is_recurring:
        return await _create_series(db, data, prices)

    session = Session(
        event_id=data.event_id,
        hall_id=data.hall_id,
        datetime=data.datetime,
        status="active",
    )
    db.add(session)
    await db.flush()

    for category, price in prices.items():
        db.add(SeatPrice(session_id=session.id, category=category, price=price))

    await db.flush()
    await db.refresh(session)
    return await build_session_out(db, session)


async def _create_series(
    db: AsyncSession, data: SessionCreate, prices: dict[str, float]
) -> SessionGroupOut:
    """Turn a recurrence rule into sessions, sharing one group id."""
    moments = data.recurring.expand()
    if not moments:
        raise HTTPException(
            status_code=400, detail="По этим правилам не выпадает ни одного сеанса"
        )
    if len(moments) > MAX_RECURRING_SESSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Получается сеансов: {len(moments)}. "
                f"За один раз можно создать не больше {MAX_RECURRING_SESSIONS}"
            ),
        )

    # A hall cannot hold two showings at once, so a moment the rule lands on an
    # existing showing is skipped instead of double-booked. Postgres hands these
    # back in UTC while the rule works in the admin's offset; comparing aware
    # datetimes compares the instant, so the two still meet.
    busy = set(
        (
            await db.execute(
                select(Session.datetime).where(
                    Session.hall_id == data.hall_id,
                    Session.status != "cancelled",
                    Session.datetime.in_(moments),
                )
            )
        )
        .scalars()
        .all()
    )

    group_id = str(uuid4())
    sessions = [
        Session(
            event_id=data.event_id,
            hall_id=data.hall_id,
            datetime=moment,
            status="active",
            recurring_group_id=group_id,
        )
        for moment in moments
        if moment not in busy
    ]
    if not sessions:
        raise HTTPException(
            status_code=409,
            detail="Все сеансы этой серии в зале уже назначены",
        )

    # Added in bulk: flushing once per session would mean hundreds of round
    # trips, and the ids the prices need are all assigned by the first flush.
    db.add_all(sessions)
    await db.flush()
    db.add_all(
        [
            SeatPrice(session_id=session.id, category=category, price=price)
            for session in sessions
            for category, price in prices.items()
        ]
    )
    await db.flush()

    return SessionGroupOut(
        group_id=group_id,
        created=len(sessions),
        skipped=len(moments) - len(sessions),
        sessions=[await build_session_out(db, session) for session in sessions[:5]],
    )


@router.get("/{session_id}", response_model=SessionOut)
async def get_session(session_id: int, db: AsyncSession = Depends(get_db)):
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Сеанс не найден")
    return await build_session_out(db, session)


@router.get("/{session_id}/seats", response_model=SeatMapOut)
async def get_session_seats(session_id: int, db: AsyncSession = Depends(get_db)):
    """Seat map with live availability and the price of each seat."""
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Сеанс не найден")

    hall = await db.get(Hall, session.hall_id) if session.hall_id else None

    prices_rows = (
        await db.execute(select(SeatPrice).where(SeatPrice.session_id == session_id))
    ).scalars().all()
    price_by_category = {p.category: float(p.price) for p in prices_rows}

    taken = dict(
        (
            await db.execute(
                select(Ticket.seat_id, Ticket.ticket_id).where(
                    Ticket.session_id == session_id, Ticket.seat_id.is_not(None)
                )
            )
        ).all()
    )

    seats: list[SeatMapSeat] = []
    if hall:
        rows = (
            await db.execute(
                select(Seat).where(Seat.hall_id == hall.id).order_by(Seat.row, Seat.col)
            )
        ).scalars().all()
        for seat in rows:
            item = SeatMapSeat.model_validate(seat)
            item.is_taken = seat.id in taken
            item.ticket_id = taken.get(seat.id)
            item.price = price_by_category.get(seat.category, 0.0)
            seats.append(item)

    return SeatMapOut(
        session_id=session.id,
        hall_id=session.hall_id,
        hall_name=hall.name if hall else None,
        rows=hall.rows if hall else 0,
        cols=hall.cols if hall else 0,
        seats=seats,
        prices=[
            SeatPriceOut(category=c, price=p) for c, p in price_by_category.items()
        ],
    )


@router.delete("/{session_id}", status_code=200)
async def cancel_session(
    session_id: int,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a showing and tell every open seat map about it."""
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Сеанс не найден")

    allowed = await _allowed_venue_ids(db, user)
    if allowed is not None:
        # The hall first, exactly as the listing does: an event usually carries
        # no venue_id of its own, and checking that alone refused the caller
        # their own showing.
        hall = await db.get(Hall, session.hall_id) if session.hall_id else None
        event = await db.get(Event, session.event_id)
        venue_id = (hall.venue_id if hall else None) or (event.venue_id if event else None)
        if venue_id not in allowed:
            raise HTTPException(status_code=403, detail="Этот сеанс вам не назначен")

    session.status = "cancelled"
    await db.flush()
    await manager.broadcast_to_session(session_id, {"type": "session_cancelled"})
    return {"status": "cancelled", "session_id": session_id}


@router.delete("/group/{group_id}", status_code=200)
async def cancel_session_group(
    group_id: str,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Cancel every remaining showing of one series."""
    sessions = list(
        (
            await db.execute(
                select(Session).where(
                    Session.recurring_group_id == group_id,
                    Session.status != "cancelled",
                )
            )
        )
        .scalars()
        .all()
    )
    if not sessions:
        raise HTTPException(status_code=404, detail="Серия не найдена")

    allowed = await _allowed_venue_ids(db, user)
    if allowed is not None:
        # Every showing of a series shares one hall, so one check settles it --
        # but the hall is read per distinct id rather than assumed, the same way
        # cancelling a single showing does.
        for hall_id in {session.hall_id for session in sessions}:
            hall = await db.get(Hall, hall_id) if hall_id else None
            event = await db.get(Event, sessions[0].event_id)
            venue_id = (hall.venue_id if hall else None) or (
                event.venue_id if event else None
            )
            if venue_id not in allowed:
                raise HTTPException(status_code=403, detail="Эта серия вам не назначена")

    for session in sessions:
        session.status = "cancelled"
    await db.flush()

    # Every open seat map of the series is told, not just the first.
    for session in sessions:
        await manager.broadcast_to_session(session.id, {"type": "session_cancelled"})

    return {"status": "cancelled", "group_id": group_id, "cancelled": len(sessions)}
