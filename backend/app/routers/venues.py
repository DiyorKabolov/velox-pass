from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_superadmin
from app.models.hall import Hall
from app.models.seat import Seat
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
async def list_venues(db: AsyncSession = Depends(get_db)):
    """Public listing, with a hall count so the admin table needs one call."""
    result = await db.execute(select(Venue).order_by(Venue.name))
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


@router.get("/{venue_id}", response_model=VenueOut)
async def get_venue(venue_id: int, db: AsyncSession = Depends(get_db)):
    venue = await db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Площадка не найдена")
    item = VenueOut.model_validate(venue)
    item.halls_count = await db.scalar(
        select(func.count(Hall.id)).where(Hall.venue_id == venue_id)
    )
    return item


@router.patch("/{venue_id}", response_model=VenueOut)
async def update_venue(
    venue_id: int,
    data: VenueUpdate,
    _=Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    venue = await db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Площадка не найдена")
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
async def list_halls(venue_id: int, db: AsyncSession = Depends(get_db)):
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
    _=Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Create a hall and materialise its seats from layout_json."""
    if not await db.get(Venue, data.venue_id):
        raise HTTPException(status_code=404, detail="Площадка не найдена")

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
    _=Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    """Update a hall. A new layout replaces every seat, so it is refused once
    any seat in the hall has been sold."""
    hall = await db.get(Hall, hall_id)
    if not hall:
        raise HTTPException(status_code=404, detail="Зал не найден")

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
    _=Depends(require_superadmin),
    db: AsyncSession = Depends(get_db),
):
    hall = await db.get(Hall, hall_id)
    if not hall:
        raise HTTPException(status_code=404, detail="Зал не найден")
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
