from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.event import Event
from app.models.ticket import Ticket
from app.schemas.event import EventOut

router = APIRouter(prefix="/events", tags=["events"])


async def _with_counts(db: AsyncSession, event: Event) -> EventOut:
    sold = await db.scalar(
        select(func.count(Ticket.id)).where(Ticket.event_id == event.id)
    )
    sold = sold or 0
    payload = EventOut.model_validate(event)
    payload.tickets_sold = sold
    payload.seats_left = max(event.capacity - sold, 0) if event.capacity else 0
    return payload


@router.get("", response_model=list[EventOut])
async def list_events(
    upcoming_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """Public event listing used by the home page."""
    query = select(Event).order_by(Event.date.asc())
    if upcoming_only:
        query = query.where(Event.date >= func.now())
    result = await db.execute(query)
    return [await _with_counts(db, event) for event in result.scalars().all()]


@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: int, db: AsyncSession = Depends(get_db)):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return await _with_counts(db, event)
