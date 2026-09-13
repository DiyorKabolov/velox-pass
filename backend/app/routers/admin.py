"""Superadmin-only management endpoints.

Events, their covers and the dashboard counters live in staff_events.py,
where venue administrators can reach them for their own venues."""
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import ROLE_RANK, require_superadmin
from app.models.event import Event
from app.models.seat import Seat
from app.models.user_venue_role import UserVenueRole
from app.models.venue import Venue
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ticket import TicketOut
from app.schemas.venue import VenueOut
from app.schemas.user import (
    UserAdminOut,
    UserOut,
    UserRoleUpdate,
    UserVenueBrief,
    VenueStaffAssign,
    VenueStaffOut,
)
from app.services import ticket_service
from app.services.uploads import accept_image

router = APIRouter(
    prefix="/admin", tags=["admin"], dependencies=[Depends(require_superadmin)]
)


@router.get("/scanners", response_model=list[UserOut])
async def admin_scanners(db: AsyncSession = Depends(get_db, scope="function")):
    """Everyone who can operate the scanner page."""
    result = await db.execute(
        select(User).where(User.role == "scanner").order_by(User.username)
    )
    return list(result.scalars().all())


@router.get("/users", response_model=list[UserAdminOut])
async def admin_users(db: AsyncSession = Depends(get_db, scope="function")):
    """Users with the venues each is attached to.

    The grants come from one grouped query rather than a request per venue from
    the browser, so the column costs nothing as the venue list grows.
    """
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = list(result.scalars().all())

    grants = (
        await db.execute(
            select(UserVenueRole.user_id, UserVenueRole.role, Venue.id, Venue.name)
            .join(Venue, Venue.id == UserVenueRole.venue_id)
            .order_by(Venue.name)
        )
    ).all()

    by_user: dict[int, list[UserVenueBrief]] = {}
    for user_id, role, venue_id, venue_name in grants:
        by_user.setdefault(user_id, []).append(
            UserVenueBrief(venue_id=venue_id, venue_name=venue_name, role=role)
        )

    payload = []
    for user in users:
        item = UserAdminOut.model_validate(user)
        item.venues = by_user.get(user.id, [])
        payload.append(item)
    return payload


@router.patch("/users/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: int, data: UserRoleUpdate, db: AsyncSession = Depends(get_db, scope="function")
):
    if data.role not in ROLE_RANK:
        raise HTTPException(status_code=400, detail=f"Неизвестная роль: {data.role}")
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.role = data.role
    await db.flush()
    await db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=204)
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db, scope="function")):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.role == "superadmin":
        raise HTTPException(status_code=400, detail="Нельзя удалить суперадмина")
    await db.delete(user)


@router.get("/tickets", response_model=list[TicketOut])
async def admin_tickets(db: AsyncSession = Depends(get_db, scope="function")):
    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.event),
            selectinload(Ticket.seat).selectinload(Seat.hall),
        )
        .order_by(Ticket.created_at.desc())
    )
    return [ticket_service.serialize_ticket(t) for t in result.scalars().all()]


# --- venue staff ----------------------------------------------------------
# Scoped grants live in user_venue_roles; the account-wide users.role column is
# what the navbar and the route guards actually read. The two are kept in step
# here, because a grant nobody can act on would be worse than no grant at all.


async def _require_venue(db: AsyncSession, venue_id: int) -> Venue:
    venue = await db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Площадка не найдена")
    return venue


@router.get("/venues/{venue_id}/staff", response_model=list[VenueStaffOut])
async def venue_staff(venue_id: int, db: AsyncSession = Depends(get_db, scope="function")):
    await _require_venue(db, venue_id)
    result = await db.execute(
        select(
            UserVenueRole.user_id,
            UserVenueRole.role,
            UserVenueRole.created_at,
            User.username,
            User.email,
            User.role.label("global_role"),
        )
        .join(User, User.id == UserVenueRole.user_id)
        .where(UserVenueRole.venue_id == venue_id)
        .order_by(User.username)
    )
    return [
        VenueStaffOut(
            user_id=user_id,
            username=username,
            email=email,
            role=role,
            assigned_at=created_at,
            global_role=global_role,
        )
        for user_id, role, created_at, username, email, global_role in result.all()
    ]


@router.post("/venues/{venue_id}/staff", response_model=VenueStaffOut, status_code=201)
@router.post(
    "/venues/{venue_id}/assign",
    response_model=VenueStaffOut,
    status_code=201,
    include_in_schema=False,  # kept only so an older caller does not break
)
async def assign_venue_staff(
    venue_id: int,
    data: VenueStaffAssign,
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Grant a venue-scoped role, replacing any existing grant on this venue."""
    await _require_venue(db, venue_id)

    user = await db.get(User, data.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.role == "superadmin":
        raise HTTPException(
            status_code=400,
            detail="Суперадмин и так управляет всеми площадками",
        )

    existing = await db.scalar(
        select(UserVenueRole).where(
            UserVenueRole.user_id == user.id, UserVenueRole.venue_id == venue_id
        )
    )
    if existing:
        # One grant per user per venue -- the table enforces it, so a repeat
        # assignment changes the role rather than failing on the constraint.
        existing.role = data.role
        grant = existing
    else:
        grant = UserVenueRole(user_id=user.id, venue_id=venue_id, role=data.role)
        db.add(grant)

    # Lift the account-wide role to match, or the grant would be invisible: the
    # navbar and the route guards read users.role, not this table.
    if ROLE_RANK.get(user.role, 0) < ROLE_RANK.get(data.role, 0):
        user.role = data.role

    await db.flush()
    return VenueStaffOut(
        user_id=user.id,
        username=user.username,
        email=user.email,
        role=grant.role,
        assigned_at=grant.created_at,
        global_role=user.role,
    )


@router.delete("/venues/{venue_id}/staff/{user_id}", status_code=204)
async def remove_venue_staff(
    venue_id: int,
    user_id: int,
    db: AsyncSession = Depends(get_db, scope="function"),
):
    await _require_venue(db, venue_id)

    grant = await db.scalar(
        select(UserVenueRole).where(
            UserVenueRole.user_id == user_id, UserVenueRole.venue_id == venue_id
        )
    )
    if not grant:
        raise HTTPException(status_code=404, detail="Назначение не найдено")
    await db.delete(grant)
    await db.flush()

    # Revoking the last grant has to take the account-wide role back down too,
    # or the user keeps the scanner tab and the staff endpoints for every venue.
    user = await db.get(User, user_id)
    if user and user.role in ("venue_admin", "scanner"):
        left = await db.scalar(
            select(func.count(UserVenueRole.id)).where(
                UserVenueRole.user_id == user_id
            )
        )
        if not left:
            user.role = "user"


# --- venue photo ----------------------------------------------------------

VENUE_IMAGE_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "uploads", "venues")
)


def _drop_venue_files(venue_id: int, keep: str | None = None) -> None:
    """Remove a venue's stored photos, whatever extension they were saved with.

    A venue's file is named after the venue, so a JPEG replacing a PNG does not
    overwrite it -- both would sit there and the old one would be served
    whenever the row still pointed at it.
    """
    try:
        for name in os.listdir(VENUE_IMAGE_DIR):
            if name != keep and name.partition(".")[0] == str(venue_id):
                os.remove(os.path.join(VENUE_IMAGE_DIR, name))
    except OSError:
        # Nothing here is worth failing an upload over: the row already points
        # at the file that matters.
        pass


@router.post("/venues/{venue_id}/image", response_model=VenueOut)
async def upload_venue_image(
    venue_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Replace a venue's photo."""
    venue = await db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Площадка не найдена")

    payload = await file.read()
    extension = accept_image(payload)

    os.makedirs(VENUE_IMAGE_DIR, exist_ok=True)
    stored = f"{venue_id}{extension}"
    with open(os.path.join(VENUE_IMAGE_DIR, stored), "wb") as handle:
        handle.write(payload)
    _drop_venue_files(venue_id, keep=stored)

    # The file name is fixed, so the address would not change when the photo
    # does and every browser that had seen the old one would go on showing it.
    # The stamp makes each upload a new address.
    venue.image_url = f"/uploads/venues/{stored}?v={uuid.uuid4().hex[:8]}"
    await db.flush()
    await db.refresh(venue)
    return VenueOut.model_validate(venue)


@router.delete("/venues/{venue_id}/image", response_model=VenueOut)
async def delete_venue_image(venue_id: int, db: AsyncSession = Depends(get_db, scope="function")):
    venue = await db.get(Venue, venue_id)
    if not venue:
        raise HTTPException(status_code=404, detail="Площадка не найдена")

    venue.image_url = None
    await db.flush()
    _drop_venue_files(venue_id)

    await db.refresh(venue)
    return VenueOut.model_validate(venue)
