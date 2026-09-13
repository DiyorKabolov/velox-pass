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
from app.core.deps import VenueScope, get_current_venue_admin, require_staff, user_venue_ids
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
from app.services.access import scoped_tickets, ticket_venue_expr, visible_events_clause
from app.services.event_stats import DEAD_SESSION_STATUSES

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
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Totals across the caller's venues, and the same figures per venue.

    Tickets are attributed to the venue they are checked in at -- the hall of
    their showing, else their event's own venue -- so an event running at two
    venues splits its sales between them instead of counting twice.
    """
    now = datetime.now(timezone.utc)
    venues = list(
        (
            await db.execute(
                select(Venue.id, Venue.name)
                .where(Venue.id.in_(scope.ids))
                .order_by(Venue.name)
            )
        ).all()
    )
    ids = [venue_id for venue_id, _ in venues]

    def blank(venue_id=None, name=None):
        row = {
            "events_count": 0,
            "tickets_sold": 0,
            "scanned": 0,
            "revenue": 0.0,
            "upcoming_sessions": 0,
        }
        if venue_id is not None:
            row.update(venue_id=venue_id, venue_name=name)
        return row

    per_venue = {venue_id: blank(venue_id, name) for venue_id, name in venues}

    if ids:
        venue = ticket_venue_expr()
        ticket_rows = await db.execute(
            scoped_tickets(
                select(
                    venue,
                    func.count(Ticket.id),
                    func.count(Ticket.id).filter(Ticket.used.is_(True)),
                    func.coalesce(func.sum(Ticket.price_paid), 0),
                ),
                scope,
            )
            .where(venue.in_(ids))
            .group_by(venue)
        )
        for venue_id, sold, scanned, revenue in ticket_rows.all():
            per_venue[venue_id].update(
                tickets_sold=sold, scanned=scanned, revenue=float(revenue)
            )

        # An event counts at every venue it touches: its own, and each hall its
        # showings use. The union keeps one event from counting twice at one
        # venue when both routes lead there.
        touches = (
            select(Event.venue_id.label("venue_id"), Event.id.label("event_id"))
            .where(Event.venue_id.in_(ids))
            .union(
                select(Hall.venue_id, Session.event_id)
                .join(Session, Session.hall_id == Hall.id)
                .where(Hall.venue_id.in_(ids))
            )
            .subquery()
        )
        for venue_id, count in (
            await db.execute(
                select(touches.c.venue_id, func.count(touches.c.event_id)).group_by(
                    touches.c.venue_id
                )
            )
        ).all():
            per_venue[venue_id]["events_count"] = count

        for venue_id, count in (
            await db.execute(
                select(Hall.venue_id, func.count(Session.id))
                .join(Session, Session.hall_id == Hall.id)
                .where(
                    Hall.venue_id.in_(ids),
                    Session.datetime >= now,
                    Session.status.not_in(DEAD_SESSION_STATUSES),
                )
                .group_by(Hall.venue_id)
            )
        ).all():
            per_venue[venue_id]["upcoming_sessions"] = count

    rows = list(per_venue.values())
    totals = blank()
    for key in ("tickets_sold", "scanned", "revenue", "upcoming_sessions"):
        totals[key] = sum(row[key] for row in rows)

    # Counted afresh rather than summed: an event at two of the caller's venues
    # is one event, not two.
    events_query = select(func.count(Event.id))
    clause = visible_events_clause(scope)
    if clause is not None:
        events_query = events_query.where(clause)
    totals["events_count"] = await db.scalar(events_query) or 0

    return {"totals": totals, "venues": rows}


@router.get("/tickets", response_model=list[TicketOut])
async def recent_tickets(
    limit: int = 20,
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Latest tickets checked in at this administrator's venues.

    Narrowed ticket by ticket, not event by event: an event that also runs at
    another venue would otherwise show its buyers there as well.
    """
    query = (
        scoped_tickets(select(Ticket), scope)
        .options(
            selectinload(Ticket.event),
            # serialize_ticket reads the hall name; a lazy load of it inside
            # async code raises MissingGreenlet.
            selectinload(Ticket.seat).selectinload(Seat.hall),
        )
        .order_by(Ticket.created_at.desc())
        .limit(max(1, min(limit, 100)))
    )

    result = await db.execute(query)
    return [ticket_service.serialize_ticket(t) for t in result.scalars().all()]


@router.get("/staff", response_model=list[VenueStaffOut])
async def my_staff(
    user: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db, scope="function"),
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
