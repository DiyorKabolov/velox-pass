"""Event management for everyone who runs a venue.

Split off from the superadmin router, which gates all of /admin on superadmin
and so turned venue administrators away from their own events. Users, staff
assignment and ticket templates stay behind that gate; only these endpoints
moved, and every one of them narrows to the caller's venues. A superadmin holds
every venue, so for them nothing is narrowed.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import VenueScope, get_current_venue_admin
from app.models.event import Event
from app.models.ticket import Ticket
from app.models.user import User
from app.models.venue import Venue
from app.schemas.event import EventCreate, EventOut, EventUpdate
from app.services.access import (
    require_event_access,
    scoped_tickets,
    visible_events_clause,
)
from app.services.event_stats import serialize_events
from app.services.uploads import drop_event_image, store_event_image

router = APIRouter(prefix="/admin", tags=["admin: events"])


async def _event_or_404(db: AsyncSession, event_id: int) -> Event:
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")
    return event


async def _check_venue(db: AsyncSession, scope: VenueScope, venue_id: int) -> None:
    """The venue exists, and the caller holds it."""
    if not await db.get(Venue, venue_id):
        raise HTTPException(status_code=404, detail="Площадка не найдена")
    scope.require(venue_id)


async def _one(db: AsyncSession, event: Event) -> EventOut:
    return (await serialize_events(db, [event]))[0]


@router.get("/stats")
async def stats(
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Counters for the dashboard cards, for whatever the caller may see.

    The user count is the superadmin's alone: how many people use the whole
    system is not a venue's business.
    """
    events_query = select(func.count(Event.id))
    clause = visible_events_clause(scope)
    if clause is not None:
        events_query = events_query.where(clause)

    tickets = scoped_tickets(select(func.count(Ticket.id)), scope)
    used = tickets.where(Ticket.used.is_(True))
    revenue = scoped_tickets(
        select(func.coalesce(func.sum(Ticket.price_paid), 0)), scope
    )

    payload = {
        "events": await db.scalar(events_query) or 0,
        "tickets": await db.scalar(tickets) or 0,
        "tickets_used": await db.scalar(used) or 0,
        "revenue": float(await db.scalar(revenue) or 0),
    }
    if scope.is_superadmin:
        payload["users"] = await db.scalar(select(func.count(User.id))) or 0
    return payload


@router.get("/events", response_model=list[EventOut])
async def list_events(
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Events newest first -- every one for a superadmin, their own otherwise."""
    query = select(Event).order_by(Event.date.desc())
    clause = visible_events_clause(scope)
    if clause is not None:
        query = query.where(clause)
    result = await db.execute(query)
    return await serialize_events(db, list(result.scalars().all()))


@router.post("/events", response_model=EventOut, status_code=201)
async def create_event(
    data: EventCreate,
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Create an event, owned by whoever created it.

    A venue administrator's event must sit at one of their venues. With only
    one venue there is nothing to choose, so it is filled in rather than
    refused; with several, they have to say which.
    """
    fields = data.model_dump()

    if fields["venue_id"] is not None:
        await _check_venue(db, scope, fields["venue_id"])
    elif not scope.is_superadmin:
        if len(scope.ids) != 1:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
                detail="Укажите, на какой из ваших площадок проходит мероприятие",
            )
        fields["venue_id"] = scope.ids[0]

    event = Event(**fields, created_by=scope.user.id)
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return await _one(db, event)


@router.patch("/events/{event_id}", response_model=EventOut)
async def update_event(
    event_id: int,
    data: EventUpdate,
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    event = await _event_or_404(db, event_id)
    await require_event_access(db, scope, event)

    fields = data.model_dump(exclude_unset=True)
    if "venue_id" in fields:
        if fields["venue_id"] is not None:
            # Moving it is checked against the destination too, or an event
            # could be handed to a venue the caller does not hold.
            await _check_venue(db, scope, fields["venue_id"])
        elif not scope.is_superadmin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Мероприятие должно оставаться на одной из ваших площадок",
            )

    for field, value in fields.items():
        setattr(event, field, value)
    await db.flush()
    await db.refresh(event)
    return await _one(db, event)


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(
    event_id: int,
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    event = await _event_or_404(db, event_id)
    await require_event_access(db, scope, event)
    cover = event.image_url
    await db.delete(event)
    await db.flush()
    # After the row is gone, so a failed delete never leaves an event pointing
    # at a missing file.
    drop_event_image(cover)


@router.post("/events/{event_id}/image", response_model=EventOut)
async def upload_event_image(
    event_id: int,
    file: UploadFile = File(...),
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Replace an event's cover. The old file goes once the new one is in place."""
    event = await _event_or_404(db, event_id)
    await require_event_access(db, scope, event)

    previous = event.image_url
    event.image_url = store_event_image(await file.read())
    await db.flush()
    drop_event_image(previous)

    await db.refresh(event)
    return await _one(db, event)


@router.delete("/events/{event_id}/image", response_model=EventOut)
async def delete_event_image(
    event_id: int,
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    event = await _event_or_404(db, event_id)
    await require_event_access(db, scope, event)

    previous = event.image_url
    event.image_url = None
    await db.flush()
    drop_event_image(previous)

    await db.refresh(event)
    return await _one(db, event)
