from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_staff
from app.core.websocket_manager import manager
from app.models.event import Event
from app.models.hall import Hall
from app.models.seat import Seat
from app.models.seat_price import SeatPrice
from app.models.session import Session
from app.models.ticket import Ticket
from app.models.venue import Venue
from app.schemas.session import (
    SeatMapOut,
    SeatMapSeat,
    SeatPriceOut,
    SessionCreate,
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


@router.post("", response_model=SessionOut, status_code=201)
async def create_session(
    data: SessionCreate,
    _=Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Create a showing plus its per-category prices."""
    event = await db.get(Event, data.event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")
    if not await db.get(Hall, data.hall_id):
        raise HTTPException(status_code=404, detail="Зал не найден")

    session = Session(
        event_id=data.event_id,
        hall_id=data.hall_id,
        datetime=data.datetime,
        status="active",
    )
    db.add(session)
    await db.flush()

    # Last value wins if a category is listed twice.
    for price in {p.category: p for p in data.prices}.values():
        db.add(
            SeatPrice(
                session_id=session.id, category=price.category, price=price.price
            )
        )

    # A session only makes sense for a seated event.
    if not event.has_seats:
        event.has_seats = True

    await db.flush()
    await db.refresh(session)
    return await build_session_out(db, session)


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
    _=Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a showing and tell every open seat map about it."""
    session = await db.get(Session, session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Сеанс не найден")

    session.status = "cancelled"
    await db.flush()
    await manager.broadcast_to_session(session_id, {"type": "session_cancelled"})
    return {"status": "cancelled", "session_id": session_id}
