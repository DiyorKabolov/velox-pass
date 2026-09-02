from collections import defaultdict
from datetime import date as date_type
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import VenueScope, get_current_venue_admin, require_superadmin
from app.models.event import Event
from app.models.hall import Hall
from app.models.seat import Seat
from app.models.seat_price import SeatPrice
from app.models.session import Session
from app.models.ticket import Ticket
from app.models.venue import Venue
from app.schemas.venue import (
    HallCreate,
    HallOut,
    HallUpdate,
    SeatOut,
    VenueCreate,
    VenueOut,
    VenueSessionOut,
    VenueUpdate,
)

router = APIRouter(prefix="/venues", tags=["venues"])

VALID_CATEGORIES = {"standard", "vip", "balcony", "disabled"}


def row_letter(row: int) -> str:
    """1 -> A, 26 -> Z, 27 -> AA. Used for human-facing seat labels."""
    label = ""
    while row > 0:
        row, rest = divmod(row - 1, 26)
        label = chr(ord("A") + rest) + label
    return label


def hall_out(hall: Hall, seats_count: int = 0, seats: list | None = None) -> HallOut:
    """Build HallOut by hand.

    model_validate(hall) would try to read hall.seats, and touching a lazy
    relationship on an async session raises MissingGreenlet.
    """
    return HallOut(
        id=hall.id,
        venue_id=hall.venue_id,
        name=hall.name,
        rows=hall.rows,
        cols=hall.cols,
        layout_json=hall.layout_json,
        seats_count=seats_count,
        seats=seats or [],
    )


def seats_for_layout(hall: Hall) -> list[Seat]:
    """Build Seat rows from layout_json, falling back to a plain rows x cols grid.

    layout_json shape: {"seats": [[{"category": ..., "is_aisle": ...}, ...], ...]}
    """
    grid = (hall.layout_json or {}).get("seats") if hall.layout_json else None
    seats: list[Seat] = []

    if grid:
        for row_index, row_cells in enumerate(grid, start=1):
            # Seat numbers run consecutively along the row and an aisle takes
            # none, so a row of [seat][seat][aisle][seat] reads A1, A2, A3 --
            # not A1, A2, A4 with a number nobody can find.
            number = 0
            for col_index, cell in enumerate(row_cells, start=1):
                cell = cell or {}
                category = str(cell.get("category", "standard"))
                if category not in VALID_CATEGORIES:
                    category = "standard"
                is_aisle = bool(cell.get("is_aisle", False))
                if not is_aisle:
                    number += 1
                seats.append(
                    Seat(
                        hall_id=hall.id,
                        # col stays the grid coordinate: the map is drawn from
                        # it, so the gap keeps its place on screen.
                        row=row_index,
                        col=col_index,
                        label=None if is_aisle else f"{row_letter(row_index)}{number}",
                        category=category,
                        is_aisle=is_aisle,
                    )
                )
        return seats

    for row_index in range(1, hall.rows + 1):
        for col_index in range(1, hall.cols + 1):
            seats.append(
                Seat(
                    hall_id=hall.id,
                    row=row_index,
                    col=col_index,
                    label=f"{row_letter(row_index)}{col_index}",
                    category="standard",
                    is_aisle=False,
                )
            )
    return seats


@router.get("", response_model=list[VenueOut])
async def list_venues(
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db),
):
    """Venues the caller manages, with a hall count so the admin table needs
    one call. No longer public: it is only ever read by the admin screens, and
    a venue_admin must not learn about venues that are not theirs."""
    query = select(Venue).order_by(Venue.name)
    if not scope.is_superadmin:
        query = query.where(Venue.id.in_(scope.ids))
    result = await db.execute(query)
    venues = list(result.scalars().all())

    counts = dict(
        (
            await db.execute(
                select(Hall.venue_id, func.count(Hall.id)).group_by(Hall.venue_id)
            )
        ).all()
    )
    payload = []
    for venue in venues:
        item = VenueOut.model_validate(venue)
        item.halls_count = counts.get(venue.id, 0)
        payload.append(item)
    return payload


@router.post("", response_model=VenueOut, status_code=201)
async def create_venue(
    data: VenueCreate,
    _=Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    venue = Venue(**data.model_dump())
    db.add(venue)
    await db.flush()
    await db.refresh(venue)
    return VenueOut.model_validate(venue)


# --- public -----------------------------------------------------------------
# These have to be declared above the routes taking a {venue_id}, or "public"
# would be read as a venue id and never reach them.
#
# The listing above is deliberately not the public one: it is scoped, so a venue
# administrator sees only their own venues there, and opening it up would undo
# that. The visitor-facing catalogue is its own endpoint, needs no sign-in, and
# returns every venue.


async def _upcoming_event_counts(db: AsyncSession) -> dict[int, int]:
    """Distinct events per venue that still have a showing to come.

    Counted through both links a showing can reach a venue by: the hall it runs
    in, and the event's own venue_id for the events that carry one. The venue
    schedule below matches on exactly the same pair, so the number on the card
    and the schedule behind it cannot disagree.
    """
    now = datetime.now(timezone.utc)
    live = (Session.datetime > now, Session.status != "cancelled")

    by_hall = await db.execute(
        select(Hall.venue_id, Session.event_id)
        .select_from(Session)
        .join(Hall, Hall.id == Session.hall_id)
        .where(*live)
    )
    by_event = await db.execute(
        select(Event.venue_id, Session.event_id)
        .select_from(Session)
        .join(Event, Event.id == Session.event_id)
        .where(*live, Event.venue_id.is_not(None))
    )

    events: dict[int, set[int]] = defaultdict(set)
    for venue_id, event_id in list(by_hall.all()) + list(by_event.all()):
        events[venue_id].add(event_id)
    return {venue_id: len(ids) for venue_id, ids in events.items()}


@router.get("/public", response_model=list[VenueOut])
async def list_public_venues(db: AsyncSession = Depends(get_db)):
    """Every venue, for the visitor-facing catalogue. No sign-in required."""
    venues = list((await db.execute(select(Venue).order_by(Venue.name))).scalars().all())

    halls = dict(
        (
            await db.execute(
                select(Hall.venue_id, func.count(Hall.id)).group_by(Hall.venue_id)
            )
        ).all()
    )
    events = await _upcoming_event_counts(db)

    payload = []
    for venue in venues:
        item = VenueOut.model_validate(venue)
        item.halls_count = halls.get(venue.id, 0)
        item.active_events_count = events.get(venue.id, 0)
        payload.append(item)
    return payload


@router.get("/public/{venue_id}", response_model=VenueOut)
async def get_public_venue(venue_id: int, db: AsyncSession = Depends(get_db)):
    """One venue, for its public page."""
    venue = await db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Площадка не найдена")

    item = VenueOut.model_validate(venue)
    item.halls_count = await db.scalar(
        select(func.count(Hall.id)).where(Hall.venue_id == venue_id)
    )
    item.active_events_count = (await _upcoming_event_counts(db)).get(venue_id, 0)
    return item


@router.get("/{venue_id}/sessions", response_model=list[VenueSessionOut])
async def venue_sessions(
    venue_id: int,
    date: date_type | None = Query(
        None, description="Только сеансы этого дня, ГГГГ-ММ-ДД"
    ),
    tz_offset_minutes: int = Query(
        0,
        ge=-840,
        le=840,
        description="Часовой пояс, в котором понимать date: минуты к востоку от UTC",
    ),
    db: AsyncSession = Depends(get_db),
):
    """Upcoming showings at a venue, for its public schedule.

    Public: this is the timetable on the door. Past and cancelled showings are
    left out, since nothing can be bought for them.
    """
    if not await db.get(Venue, venue_id):
        raise HTTPException(status_code=404, detail="Площадка не найдена")

    now = datetime.now(timezone.utc)
    query = (
        select(Session, Event, Hall)
        .select_from(Session)
        .join(Event, Event.id == Session.event_id)
        .outerjoin(Hall, Hall.id == Session.hall_id)
        .where(
            Session.datetime > now,
            Session.status != "cancelled",
            # A showing reaches a venue through its hall; the event's own
            # venue_id is honoured too, for the events that carry one.
            or_(Hall.venue_id == venue_id, Event.venue_id == venue_id),
        )
        .order_by(Session.datetime.asc())
    )

    if date is not None:
        # A calendar day is a day somewhere: with no zone the window would be
        # the UTC one, which is the wrong day for anyone far enough east.
        zone = timezone(timedelta(minutes=tz_offset_minutes))
        start = datetime.combine(date, datetime.min.time(), tzinfo=zone)
        query = query.where(
            Session.datetime >= start, Session.datetime < start + timedelta(days=1)
        )

    rows = list((await db.execute(query)).all())
    if not rows:
        return []

    session_ids = [session.id for session, _, _ in rows]
    hall_ids = {hall.id for _, _, hall in rows if hall is not None}

    # Three bulk queries rather than three per row: a busy cinema puts hundreds
    # of showings on this page.
    seats_total = (
        dict(
            (
                await db.execute(
                    select(Seat.hall_id, func.count(Seat.id))
                    .where(Seat.hall_id.in_(hall_ids), Seat.is_aisle.is_(False))
                    .group_by(Seat.hall_id)
                )
            ).all()
        )
        if hall_ids
        else {}
    )
    seats_taken = dict(
        (
            await db.execute(
                select(Ticket.session_id, func.count(Ticket.id))
                .where(Ticket.session_id.in_(session_ids), Ticket.seat_id.is_not(None))
                .group_by(Ticket.session_id)
            )
        ).all()
    )
    cheapest = dict(
        (
            await db.execute(
                select(SeatPrice.session_id, func.min(SeatPrice.price))
                .where(SeatPrice.session_id.in_(session_ids))
                .group_by(SeatPrice.session_id)
            )
        ).all()
    )

    payload = []
    for session, event, hall in rows:
        total = seats_total.get(hall.id, 0) if hall else 0
        price = cheapest.get(session.id)
        payload.append(
            VenueSessionOut(
                session_id=session.id,
                event_id=event.id,
                event_title=event.title,
                event_image_url=event.image_url,
                card_accent=event.card_accent,
                hall_name=hall.name if hall else None,
                datetime=session.datetime,
                available_seats=max(total - seats_taken.get(session.id, 0), 0),
                min_price=float(price) if price is not None else None,
            )
        )
    return payload


@router.get("/{venue_id}", response_model=VenueOut)
async def get_venue(
    venue_id: int,
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db),
):
    venue = await db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Площадка не найдена")
    scope.require(venue_id)
    item = VenueOut.model_validate(venue)
    item.halls_count = await db.scalar(
        select(func.count(Hall.id)).where(Hall.venue_id == venue_id)
    )
    return item


@router.patch("/{venue_id}", response_model=VenueOut)
async def update_venue(
    venue_id: int,
    data: VenueUpdate,
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db),
):
    venue = await db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Площадка не найдена")
    scope.require(venue_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(venue, field, value)
    await db.flush()
    await db.refresh(venue)
    return VenueOut.model_validate(venue)


@router.delete("/{venue_id}", status_code=204)
async def delete_venue(
    venue_id: int,
    _=Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    venue = await db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Площадка не найдена")
    await db.delete(venue)


@router.get("/{venue_id}/halls", response_model=list[HallOut])
async def list_halls(
    venue_id: int,
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db),
):
    scope.require(venue_id)
    result = await db.execute(
        select(Hall).where(Hall.venue_id == venue_id).order_by(Hall.name)
    )
    halls = list(result.scalars().all())

    payload = []
    for hall in halls:
        count = await db.scalar(
            select(func.count(Seat.id)).where(Seat.hall_id == hall.id)
        )
        payload.append(hall_out(hall, count))
    return payload


@router.post("/halls", response_model=HallOut, status_code=201)
async def create_hall(
    data: HallCreate,
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a hall and materialise its seats from layout_json."""
    if not await db.get(Venue, data.venue_id):
        raise HTTPException(status_code=404, detail="Площадка не найдена")
    scope.require(data.venue_id)

    hall = Hall(**data.model_dump())
    # Keep rows/cols in step with the grid that was actually sent.
    grid = (hall.layout_json or {}).get("seats") if hall.layout_json else None
    if grid:
        hall.rows = len(grid)
        hall.cols = max((len(r) for r in grid), default=0)

    db.add(hall)
    await db.flush()

    seats = seats_for_layout(hall)
    db.add_all(seats)
    await db.flush()
    await db.refresh(hall)

    return hall_out(hall, len(seats))


@router.get("/halls/{hall_id}", response_model=HallOut)
async def get_hall(hall_id: int, db: AsyncSession = Depends(get_db)):
    """Hall with its full seat list, for the layout editor."""
    hall = await db.get(Hall, hall_id)
    if not hall:
        raise HTTPException(status_code=404, detail="Зал не найден")

    result = await db.execute(
        select(Seat).where(Seat.hall_id == hall_id).order_by(Seat.row, Seat.col)
    )
    seats = list(result.scalars().all())

    return hall_out(
        hall, len(seats), [SeatOut.model_validate(seat) for seat in seats]
    )


@router.patch("/halls/{hall_id}", response_model=HallOut)
async def update_hall(
    hall_id: int,
    data: HallUpdate,
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update a hall. A new layout replaces every seat, so it is refused once
    any seat in the hall has been sold."""
    hall = await db.get(Hall, hall_id)
    if not hall:
        raise HTTPException(status_code=404, detail="Зал не найден")
    scope.require(hall.venue_id)

    fields = data.model_dump(exclude_unset=True)
    relayout = "layout_json" in fields and fields["layout_json"] is not None

    if relayout:
        sold = await db.scalar(
            select(func.count(Ticket.id))
            .select_from(Ticket)
            .join(Seat, Seat.id == Ticket.seat_id)
            .where(Seat.hall_id == hall_id)
        )
        if sold:
            raise HTTPException(
                status_code=409,
                detail=f"На места этого зала уже продано билетов: {sold}",
            )

    for field, value in fields.items():
        setattr(hall, field, value)

    if relayout:
        grid = (hall.layout_json or {}).get("seats")
        if grid:
            hall.rows = len(grid)
            hall.cols = max((len(r) for r in grid), default=0)
        await db.execute(delete(Seat).where(Seat.hall_id == hall_id))
        await db.flush()
        db.add_all(seats_for_layout(hall))

    await db.flush()
    await db.refresh(hall)

    count = await db.scalar(
        select(func.count(Seat.id)).where(Seat.hall_id == hall_id)
    )
    return hall_out(hall, count)


@router.delete("/halls/{hall_id}", status_code=204)
async def delete_hall(
    hall_id: int,
    scope: VenueScope = Depends(get_current_venue_admin),
    db: AsyncSession = Depends(get_db),
):
    hall = await db.get(Hall, hall_id)
    if not hall:
        raise HTTPException(status_code=404, detail="Зал не найден")
    scope.require(hall.venue_id)
    await db.delete(hall)


@router.get("/halls/{hall_id}/seats", response_model=list[SeatOut])
async def list_seats(
    hall_id: int,
    session_id: int | None = Query(None, description="Mark seats sold for this session"),
    db: AsyncSession = Depends(get_db),
):
    """Seats of a hall; with ?session_id also says which are already sold."""
    if not await db.get(Hall, hall_id):
        raise HTTPException(status_code=404, detail="Зал не найден")

    result = await db.execute(
        select(Seat).where(Seat.hall_id == hall_id).order_by(Seat.row, Seat.col)
    )
    seats = [SeatOut.model_validate(seat) for seat in result.scalars().all()]

    if session_id is None:
        return seats

    if not await db.get(Session, session_id):
        raise HTTPException(status_code=404, detail="Сеанс не найден")

    taken = dict(
        (
            await db.execute(
                select(Ticket.seat_id, Ticket.ticket_id).where(
                    Ticket.session_id == session_id, Ticket.seat_id.is_not(None)
                )
            )
        ).all()
    )
    for seat in seats:
        if seat.id in taken:
            seat.is_taken = True
            seat.ticket_id = taken[seat.id]
    return seats
