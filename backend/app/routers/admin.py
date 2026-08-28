"""Superadmin-only management endpoints."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import ROLE_RANK, require_superadmin
from app.models.event import Event
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.event import EventCreate, EventOut, EventUpdate
from app.schemas.ticket import TicketOut
from app.schemas.user import UserOut, UserRoleUpdate
from app.services import ticket_service

router = APIRouter(
    prefix="/admin", tags=["admin"], dependencies=[Depends(require_superadmin)]
)


@router.get("/stats")
async def stats(db: AsyncSession = Depends(get_db)):
    """Counters for the admin dashboard cards."""
    users = await db.scalar(select(func.count(User.id)))
    events = await db.scalar(select(func.count(Event.id)))
    tickets = await db.scalar(select(func.count(Ticket.id)))
    used = await db.scalar(select(func.count(Ticket.id)).where(Ticket.used.is_(True)))
    revenue = await db.scalar(select(func.coalesce(func.sum(Ticket.price_paid), 0)))
    return {
        "users": users or 0,
        "events": events or 0,
        "tickets": tickets or 0,
        "tickets_used": used or 0,
        "revenue": float(revenue or 0),
    }


@router.get("/events", response_model=list[EventOut])
async def admin_events(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Event).order_by(Event.date.desc()))
    events = list(result.scalars().all())
    payload = []
    for event in events:
        sold = await db.scalar(
            select(func.count(Ticket.id)).where(Ticket.event_id == event.id)
        )
        item = EventOut.model_validate(event)
        item.tickets_sold = sold or 0
        item.seats_left = max(event.capacity - (sold or 0), 0) if event.capacity else 0
        payload.append(item)
    return payload


@router.post("/events", response_model=EventOut, status_code=201)
async def create_event(data: EventCreate, db: AsyncSession = Depends(get_db)):
    event = Event(**data.model_dump())
    db.add(event)
    await db.flush()
    await db.refresh(event)
    return EventOut.model_validate(event)


@router.patch("/events/{event_id}", response_model=EventOut)
async def update_event(
    event_id: int, data: EventUpdate, db: AsyncSession = Depends(get_db)
):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(event, field, value)
    await db.flush()
    await db.refresh(event)
    return EventOut.model_validate(event)


@router.delete("/events/{event_id}", status_code=204)
async def delete_event(event_id: int, db: AsyncSession = Depends(get_db)):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")
    await db.delete(event)


@router.get("/scanners", response_model=list[UserOut])
async def admin_scanners(db: AsyncSession = Depends(get_db)):
    """Everyone who can operate the scanner page."""
    result = await db.execute(
        select(User).where(User.role == "scanner").order_by(User.username)
    )
    return list(result.scalars().all())


@router.get("/users", response_model=list[UserOut])
async def admin_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    return list(result.scalars().all())


@router.patch("/users/{user_id}/role", response_model=UserOut)
async def update_user_role(
    user_id: int, data: UserRoleUpdate, db: AsyncSession = Depends(get_db)
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
async def delete_user(user_id: int, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    if user.role == "superadmin":
        raise HTTPException(status_code=400, detail="Нельзя удалить суперадмина")
    await db.delete(user)


@router.get("/tickets", response_model=list[TicketOut])
async def admin_tickets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Ticket)
        .options(selectinload(Ticket.event), selectinload(Ticket.seat))
        .order_by(Ticket.created_at.desc())
    )
    return [ticket_service.serialize_ticket(t) for t in result.scalars().all()]
