"""Read-only figures for the venue administrator's own panel.

Everything here is narrowed to the venues the caller actually holds a grant
for; a superadmin sees the whole system, since they hold every venue anyway.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import require_staff, user_venue_ids
from app.models.event import Event
from app.models.hall import Hall
from app.models.session import Session
from app.models.seat import Seat
from app.models.ticket import Ticket
from app.models.user import User
from app.models.user_venue_role import UserVenueRole
from app.models.venue import Venue
from app.schemas.ticket import TicketOut
from app.schemas.user import VenueStaffOut
from app.services import ticket_service

router = APIRouter(prefix="/venue-admin", tags=["venue-admin"])


async def _scope(db: AsyncSession, user: User) -> list[int] | None:
    """Venue ids to count over, or None meaning "everything"."""
    if user.role == "superadmin":
        return None
    return await user_venue_ids(db, user, role="venue_admin")


def _narrow(query, venue_ids: list[int] | None):
    """Restrict a query already joined to Event down to the caller's venues.

    Matched through the halls its showings run in as well as the event's own
    venue_id: events are created without a venue and only acquire one when a
    session is scheduled, so venue_id alone matches nothing in practice.
    """
    if venue_ids is None:
        return query
    in_my_halls = (
        select(Session.id)
        .join(Hall, Hall.id == Session.hall_id)
        .where(Session.event_id == Event.id, Hall.venue_id.in_(venue_ids))
        .exists()
    )
    return query.where(or_(Event.venue_id.in_(venue_ids), in_my_halls))


@router.get("/stats")
async def venue_stats(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    venue_ids = await _scope(db, user)
    if venue_ids is not None and not venue_ids:
        return {
            "venues": 0,
            "total_tickets": 0,
            "used_tickets": 0,
            "active_events": 0,
            "revenue": 0.0,
        }

    tickets_q = _narrow(
        select(func.count(Ticket.id)).join(Event, Event.id == Ticket.event_id), venue_ids
    )
    used_q = tickets_q.where(Ticket.used.is_(True))
    revenue_q = _narrow(
        select(func.coalesce(func.sum(Ticket.price_paid), 0)).join(
            Event, Event.id == Ticket.event_id
        ),
        venue_ids,
    )
    # "Active" means still ahead: a finished event is not something to act on.
    active_q = _narrow(
        select(func.count(Event.id)).where(Event.date >= datetime.now(timezone.utc)),
        venue_ids,
    )

    return {
        "venues": len(venue_ids) if venue_ids is not None else 0,
        "total_tickets": await db.scalar(tickets_q) or 0,
        "used_tickets": await db.scalar(used_q) or 0,
        "active_events": await db.scalar(active_q) or 0,
        "revenue": float(await db.scalar(revenue_q) or 0),
    }


@router.get("/tickets", response_model=list[TicketOut])
async def recent_tickets(
    limit: int = 20,
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Latest tickets issued for this administrator's events."""
    venue_ids = await _scope(db, user)
    if venue_ids is not None and not venue_ids:
        return []

    query = (
        select(Ticket)
        .join(Event, Event.id == Ticket.event_id)
        .options(
            selectinload(Ticket.event),
            # serialize_ticket reads the hall name; a lazy load of it inside
            # async code raises MissingGreenlet.
            selectinload(Ticket.seat).selectinload(Seat.hall),
        )
        .order_by(Ticket.created_at.desc())
        .limit(max(1, min(limit, 100)))
    )
    query = _narrow(query, venue_ids)

    result = await db.execute(query)
    return [ticket_service.serialize_ticket(t) for t in result.scalars().all()]


@router.get("/staff", response_model=list[VenueStaffOut])
async def my_staff(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Scanners on this administrator's venues.

    A separate endpoint rather than the admin one: /api/admin/* is gated on
    superadmin as a whole, so a venue administrator asking it for their own
    staff is turned away. Read-only here -- assigning is the superadmin's job.
    """
    venue_ids = await _scope(db, user)
    query = (
        select(
            UserVenueRole.user_id,
            UserVenueRole.role,
            UserVenueRole.created_at,
            User.username,
            User.email,
            User.role.label("global_role"),
            Venue.name.label("venue_name"),
        )
        .join(User, User.id == UserVenueRole.user_id)
        .join(Venue, Venue.id == UserVenueRole.venue_id)
        .where(UserVenueRole.role == "scanner")
        .order_by(Venue.name, User.username)
    )
    if venue_ids is not None:
        if not venue_ids:
            return []
        query = query.where(UserVenueRole.venue_id.in_(venue_ids))

    return [
        VenueStaffOut(
            user_id=user_id,
            username=username,
            email=email,
            role=role,
            assigned_at=created_at,
            global_role=global_role,
            venue_name=venue_name,
        )
        for user_id, role, created_at, username, email, global_role, venue_name in (
            await db.execute(query)
        ).all()
    ]
