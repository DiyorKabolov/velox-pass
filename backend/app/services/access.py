"""Who may see and change an event, and which venue a ticket belongs to.

An event is tied to venues two ways: its own venue_id, and the halls its
showings run in. In practice the second is what is set -- every event created
before this module existed has venue_id NULL and reaches its venue only through
a hall -- so anything that asked about venue_id alone would find that a venue
administrator owns nothing at all.
"""
from fastapi import HTTPException, status
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import VenueScope
from app.models.event import Event
from app.models.hall import Hall
from app.models.session import Session
from app.models.ticket import Ticket


def visible_events_clause(scope: VenueScope):
    """SQL condition for the events a caller may list, or None for all of them.

    Wider than what they may change: an event running in one of their halls is
    visible even if it also runs somewhere else, since the showing in their hall
    is theirs to know about. Changing it is decided by `require_event_access`.
    """
    if scope.is_superadmin:
        return None
    in_my_halls = (
        select(Session.id)
        .join(Hall, Hall.id == Session.hall_id)
        .where(Session.event_id == Event.id, Hall.venue_id.in_(scope.ids))
        .exists()
    )
    return or_(
        Event.venue_id.in_(scope.ids),
        Event.created_by == scope.user.id,
        in_my_halls,
    )


async def event_venue_ids(db: AsyncSession, event: Event) -> set[int]:
    """Every venue an event touches: its own, plus each hall its showings use."""
    venues: set[int] = set()
    if event.venue_id is not None:
        venues.add(event.venue_id)
    rows = await db.execute(
        select(Hall.venue_id)
        .join(Session, Session.hall_id == Hall.id)
        .where(Session.event_id == event.id)
        .distinct()
    )
    venues.update(venue_id for (venue_id,) in rows.all() if venue_id is not None)
    return venues


async def require_event_access(db: AsyncSession, scope: VenueScope, event: Event) -> None:
    """Refuse unless this caller may change or delete the event.

    A venue administrator may act on an event that touches only their venues,
    or one they created that touches no venue yet. An event that also runs at a
    venue they do not hold is refused even if it runs at theirs too: deleting it
    would take the other venue's showings and tickets with it.
    """
    if scope.is_superadmin:
        return

    venues = await event_venue_ids(db, event)
    if venues - set(scope.ids):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Мероприятие проходит и на чужой площадке — изменить его может только суперадмин",
        )
    if venues or event.created_by == scope.user.id:
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Это мероприятие вам не назначено",
    )


async def ticket_venue_id(db: AsyncSession, ticket: Ticket) -> int | None:
    """The venue a ticket is checked in at, or None when nothing says.

    The showing's hall decides when there is one: that is where the holder
    actually walks in, whatever the event row carries. Without a showing only
    the event's own venue is left to go on.
    """
    if ticket.session_id is not None:
        venue_id = await db.scalar(
            select(Hall.venue_id)
            .join(Session, Session.hall_id == Hall.id)
            .where(Session.id == ticket.session_id)
        )
        if venue_id is not None:
            return venue_id
    event = await db.get(Event, ticket.event_id)
    return event.venue_id if event else None


def ticket_venue_expr():
    """SQL for the venue a ticket belongs to: its showing's hall, else its event.

    Needs the ticket joined to Event and outer-joined to Session and Hall; see
    `scoped_tickets`.
    """
    return func.coalesce(Hall.venue_id, Event.venue_id)


def scoped_tickets(query, scope: VenueScope):
    """Join a ticket query to what decides its venue, and narrow it to the caller.

    Tickets are attributed one by one rather than through their event. An event
    running at two venues would otherwise hand each administrator the other's
    sales and buyers along with their own.

    A ticket that belongs to no venue at all counts for the administrator who
    created its event, and for nobody else.
    """
    query = (
        query.join(Event, Event.id == Ticket.event_id)
        .outerjoin(Session, Session.id == Ticket.session_id)
        .outerjoin(Hall, Hall.id == Session.hall_id)
    )
    if scope.is_superadmin:
        return query
    venue = ticket_venue_expr()
    return query.where(
        or_(
            venue.in_(scope.ids),
            and_(venue.is_(None), Event.created_by == scope.user.id),
        )
    )
