from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_staff
from app.models.hall import Hall
from app.models.seat import Seat
from app.models.user import User
from app.models.venue import Venue
from app.schemas.venue import HallCreate, HallOut, SeatOut, VenueCreate, VenueOut

router = APIRouter(prefix="/venues", tags=["venues"])


@router.get("", response_model=list[VenueOut])
async def list_venues(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Venue).order_by(Venue.name))
    return list(result.scalars().all())


@router.post("", response_model=VenueOut, status_code=201)
async def create_venue(
    data: VenueCreate,
    _: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    venue = Venue(**data.model_dump())
    db.add(venue)
    await db.flush()
    await db.refresh(venue)
    return venue


@router.get("/{venue_id}", response_model=VenueOut)
async def get_venue(venue_id: int, db: AsyncSession = Depends(get_db)):
    venue = await db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    return venue


@router.delete("/{venue_id}", status_code=204)
async def delete_venue(
    venue_id: int,
    _: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    venue = await db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Venue not found")
    await db.delete(venue)


@router.get("/{venue_id}/halls", response_model=list[HallOut])
async def list_halls(venue_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Hall).where(Hall.venue_id == venue_id).order_by(Hall.name)
    )
    return list(result.scalars().all())


@router.post("/halls", response_model=HallOut, status_code=201)
async def create_hall(
    data: HallCreate,
    _: User = Depends(require_staff),
    db: AsyncSession = Depends(get_db),
):
    """Create a hall and auto-generate its rows x cols seat grid."""
    if not await db.get(Venue, data.venue_id):
        raise HTTPException(status_code=404, detail="Venue not found")

    hall = Hall(**data.model_dump())
    db.add(hall)
    await db.flush()

    for row in range(1, hall.rows + 1):
        for col in range(1, hall.cols + 1):
            db.add(
                Seat(
                    hall_id=hall.id,
                    row=row,
                    col=col,
                    label=f"R{row}-{col}",
                    category="standard",
                    is_aisle=False,
                )
            )
    await db.flush()
    await db.refresh(hall)
    return hall


@router.get("/halls/{hall_id}/seats", response_model=list[SeatOut])
async def list_seats(hall_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Seat).where(Seat.hall_id == hall_id).order_by(Seat.row, Seat.col)
    )
    return list(result.scalars().all())
