from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import bearer_scheme, user_venue_ids
from app.core.security import verify_token
from app.core.tags import clean_tags, unknown_tags
from app.models.event import Event
from app.models.hall import Hall
from app.models.seat_price import SeatPrice
from app.models.session import Session
from app.models.user import User
from app.schemas.event import EventOut
from app.schemas.session import SeatPriceOut, SessionOut
from app.services.event_stats import serialize_events, session_stats

router = APIRouter(prefix="/events", tags=["events"])


async def get_optional_user(
    db: AsyncSession = Depends(get_db),
    credentials=Depends(bearer_scheme),
) -> User | None:
    """The signed-in user, or None. The listing stays public, so a missing or
    stale token must not turn into a 401 for an anonymous visitor."""
    if credentials is None:
        return None
    user_id = verify_token(credentials.credentials)
    return await db.get(User, user_id) if user_id else None


@router.get("", response_model=list[EventOut])
async def list_events(
    upcoming_only: bool = False,
    my_venues: bool = Query(
        False,
        description="Только события площадок, закреплённых за текущим пользователем",
    ),
    tags: str | None = Query(
        None, description="Через запятую; вернутся события с любым из тегов"
    ),
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    """Public event listing used by the home page.

    Narrowing to the caller's own venues is opt-in through `my_venues`, never
    automatic. A venue administrator is also an ordinary customer, and silently
    hiding every other venue's events would leave them browsing a catalogue
    with most of it missing.
    """
    query = select(Event).order_by(Event.date.asc())
    if upcoming_only:
        query = query.where(Event.date >= func.now())

    if my_venues:
        if user is None:
            raise HTTPException(status_code=401, detail="Необходима авторизация")
        if user.role == "superadmin":
            pass  # every venue, so no narrowing
        else:
            venue_ids = await user_venue_ids(db, user)
            if not venue_ids:
                return []
            # An event reaches a venue two ways: its own venue_id, or a showing
            # scheduled in one of that venue's halls. Only the second is set in
            # practice -- events are created without a venue and bound to one
            # later by their sessions -- so filtering on venue_id alone would
            # return nothing at all.
            in_my_halls = (
                select(Session.id)
                .join(Hall, Hall.id == Session.hall_id)
                .where(Session.event_id == Event.id, Hall.venue_id.in_(venue_ids))
                .exists()
            )
            query = query.where(
                or_(Event.venue_id.in_(venue_ids), in_my_halls)
            )

    if tags:
        wanted = [part.strip() for part in tags.split(",")]
        strays = unknown_tags(wanted)
        if strays:
            raise HTTPException(
                status_code=400, detail=f"Неизвестные теги: {', '.join(strays)}"
            )
        wanted = clean_tags(wanted)
        if wanted:
            # && is "arrays overlap": keep events carrying any of the tags.
            query = query.where(Event.tags.overlap(wanted))

    result = await db.execute(query)
    return await serialize_events(db, list(result.scalars().all()))


@router.get("/{event_id}", response_model=EventOut)
async def get_event(event_id: int, db: AsyncSession = Depends(get_db)):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")
    return (await serialize_events(db, [event]))[0]


@router.get("/{event_id}/sessions", response_model=list[SessionOut])
async def event_sessions(
    event_id: int,
    include_inactive: bool = Query(
        False,
        description="Показывать также отменённые и прошедшие сеансы",
    ),
    db: AsyncSession = Depends(get_db),
):
    """Showings of one event, soonest first, each with its own seat counts.

    By default only what can still be sold, which is what the public event page
    asks for. The admin breakdown passes `include_inactive` to get the whole
    history, cancelled showings included, and reads `state` to tell them apart.
    """
    if not await db.get(Event, event_id):
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")

    rows = (
        await session_stats(db, [event_id], include_inactive=include_inactive)
    ).get(event_id, [])
    if not rows:
        return []

    # Prices are fetched only here: the listing endpoints never show them, and
    # one query for the page beats one per showing.
    prices: dict[int, list[SeatPriceOut]] = {}
    for session_id, category, price in (
        await db.execute(
            select(SeatPrice.session_id, SeatPrice.category, SeatPrice.price).where(
                SeatPrice.session_id.in_([row.session_id for row in rows])
            )
        )
    ).all():
        prices.setdefault(session_id, []).append(
            SeatPriceOut(category=category, price=float(price))
        )

    event_title = (await db.get(Event, event_id)).title
    return [
        SessionOut(
            id=row.session_id,
            event_id=row.event_id,
            hall_id=row.hall_id,
            datetime=row.datetime,
            status=row.status,
            state=row.state,
            recurring_group_id=row.recurring_group_id,
            event_title=event_title,
            hall_name=row.hall_name,
            venue_name=row.venue_name,
            seats_total=row.capacity,
            seats_taken=row.sold,
            seats_free=row.available,
            min_price=row.min_price,
            prices=prices.get(row.session_id, []),
        )
        for row in rows
    ]
