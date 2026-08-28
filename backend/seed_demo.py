"""Fill the database with realistic Russian demo data.

    python seed_demo.py            # wipe demo content, then reseed
    python seed_demo.py --keep     # add without deleting anything

User accounts are never touched. Everything else (events, venues, halls,
seats, sessions, prices, tickets) is replaced, so the script is safe to run
again and again while building the UI.
"""
import sys
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import Session as OrmSession

from app.core.config import settings
from app.models import (
    Event,
    Hall,
    Seat,
    SeatPrice,
    Session,
    Ticket,
    User,
    Venue,
)
from app.routers.venues import seats_for_layout

NOW = datetime.now(timezone.utc)


def layout(rows: int, cols: int, *, vip_rows=0, balcony_rows=0, aisles=(), broken=()):
    """Build a layout_json grid.

    vip_rows count from the front, balcony_rows from the back, `aisles` lists
    1-based columns that are gaps, and `broken` holds (row, col) seats marked
    unavailable.
    """
    grid = []
    for r in range(1, rows + 1):
        row = []
        for c in range(1, cols + 1):
            if c in aisles:
                row.append({"category": "standard", "is_aisle": True})
                continue
            if (r, c) in broken:
                category = "disabled"
            elif r <= vip_rows:
                category = "vip"
            elif r > rows - balcony_rows:
                category = "balcony"
            else:
                category = "standard"
            row.append({"category": category, "is_aisle": False})
        grid.append(row)
    return {"seats": grid}


VENUES = [
    {
        "name": "Театр имени Вахтангова",
        "type": "theater",
        "address": "Москва, ул. Арбат, 26",
        "halls": [
            {
                "name": "Основная сцена",
                "layout": layout(10, 16, vip_rows=2, balcony_rows=2,
                                 aisles=(6, 11), broken=((5, 1), (5, 16))),
            },
            {"name": "Малая сцена", "layout": layout(6, 10, vip_rows=1, aisles=(6,))},
        ],
    },
    {
        "name": "Кинотеатр «Октябрь»",
        "type": "cinema",
        "address": "Москва, Новый Арбат, 24",
        "halls": [
            {"name": "Зал 1 · IMAX", "layout": layout(8, 14, vip_rows=0,
                                                      balcony_rows=2, aisles=(5, 11))},
            {"name": "Зал 2", "layout": layout(6, 10, aisles=(6,))},
        ],
    },
    {
        "name": "Концертный зал «Зарядье»",
        "type": "concert",
        "address": "Москва, ул. Варварка, 6",
        "halls": [
            {
                "name": "Большой зал",
                "layout": layout(12, 18, vip_rows=3, balcony_rows=3, aisles=(7, 13)),
            },
        ],
    },
]


# hall = "Venue :: Hall" for seated events; None means general admission.
EVENTS = [
    {
        "title": "«Евгений Онегин»",
        "description": "Опера в трёх действиях. Постановка идёт с одним антрактом.",
        "date": NOW + timedelta(days=9, hours=3),
        "location": "Театр имени Вахтангова",
        "capacity": 0,
        "hall": "Театр имени Вахтангова :: Основная сцена",
        "colors": ("#fdfdf5", "#a898e0", "#2a2a2a"),
        "prices": {"vip": 6500, "standard": 3200, "balcony": 1800},
    },
    {
        "title": "Балет «Щелкунчик»",
        "description": "Новогодняя классика для всей семьи. Продолжительность 2 часа.",
        "date": NOW + timedelta(days=23, hours=5),
        "location": "Театр имени Вахтангова",
        "capacity": 0,
        "hall": "Театр имени Вахтангова :: Основная сцена",
        "colors": ("#f6f1f6", "#8d6ea8", "#2b2430"),
        "prices": {"vip": 8000, "standard": 4500, "balcony": 2200},
    },
    {
        "title": "«Дюна: Часть третья»",
        "description": "Премьера в IMAX. Продолжительность 2 часа 46 минут, 12+.",
        "date": NOW + timedelta(days=3, hours=6),
        "location": "Кинотеатр «Октябрь»",
        "capacity": 0,
        "hall": "Кинотеатр «Октябрь» :: Зал 1 · IMAX",
        "colors": ("#eef2f8", "#4a6fa5", "#1e2733"),
        "prices": {"standard": 750, "balcony": 550},
    },
    {
        "title": "Чайковский. Симфония №5",
        "description": "Академический оркестр под управлением приглашённого дирижёра.",
        "date": NOW + timedelta(days=16, hours=4),
        "location": "Концертный зал «Зарядье»",
        "capacity": 0,
        "hall": "Концертный зал «Зарядье» :: Большой зал",
        "colors": ("#fbf3e8", "#c9922f", "#33241a"),
        "prices": {"vip": 9000, "standard": 4000, "balcony": 2500},
    },
    {
        "title": "Стендап: открытый микрофон",
        "description": "Восемь комиков, новый материал. Вход свободный, 18+.",
        "date": NOW + timedelta(days=5, hours=11),
        "location": "Клуб «Подвал»",
        "capacity": 90,
        "hall": None,
        "colors": ("#fdf3f2", "#d1544c", "#2e1f1e"),
    },
    {
        "title": "Ночь музеев",
        "description": "Экскурсия с куратором по залам современного искусства.",
        "date": NOW + timedelta(days=12, hours=2),
        "location": "Городской музей искусств",
        "capacity": 25,
        "hall": None,
        "colors": ("#f4f7f2", "#5fa86b", "#1f2a20"),
    },
    {
        "title": "Лекция «История джаза»",
        "description": "От Нового Орлеана до современного фьюжна. Полтора часа.",
        "date": NOW + timedelta(days=30, hours=7),
        "location": "Библиотека имени Некрасова",
        "capacity": 120,
        "hall": None,
        "colors": ("#f2f2f2", "#4a4a4a", "#1f1f1f"),
    },
    {
        "title": "Новогодний гала-концерт",
        "description": "Мероприятие уже прошло — оставлено для проверки истёкших билетов.",
        "date": NOW - timedelta(days=11),
        "location": "Концертный зал «Зарядье»",
        "capacity": 400,
        "hall": None,
        "colors": ("#f7f3ee", "#b08968", "#2c2420"),
    },
]


def wipe(db: OrmSession) -> None:
    """Remove demo content. Users are deliberately left alone."""
    # Child rows first: the FKs are ON DELETE SET NULL, not CASCADE, for some.
    for model in (Ticket, SeatPrice, Session, Seat, Hall, Venue, Event):
        db.execute(delete(model))
    db.flush()
    print("  очищено: билеты, сеансы, места, залы, площадки, мероприятия")


def build_venues(db: OrmSession) -> dict[str, Hall]:
    """Create venues and halls, returning halls keyed by 'Venue :: Hall'."""
    halls: dict[str, Hall] = {}
    for spec in VENUES:
        venue = Venue(name=spec["name"], type=spec["type"], address=spec["address"])
        db.add(venue)
        db.flush()

        for hall_spec in spec["halls"]:
            grid = hall_spec["layout"]["seats"]
            hall = Hall(
                venue_id=venue.id,
                name=hall_spec["name"],
                rows=len(grid),
                cols=max(len(r) for r in grid),
                layout_json=hall_spec["layout"],
            )
            db.add(hall)
            db.flush()

            seats = seats_for_layout(hall)
            db.add_all(seats)
            db.flush()

            halls[f"{venue.name} :: {hall.name}"] = hall
            sellable = sum(1 for s in seats if not s.is_aisle)
            print(f"  {venue.name} / {hall.name}: "
                  f"{hall.rows}x{hall.cols}, мест в продаже {sellable}")
    return halls


def build_events(db: OrmSession, halls: dict[str, Hall]) -> list[Session]:
    """Create events, plus a session with prices for every seated one."""
    sessions: list[Session] = []
    for spec in EVENTS:
        bg, accent, text = spec["colors"]
        event = Event(
            title=spec["title"],
            description=spec["description"],
            date=spec["date"],
            location=spec["location"],
            capacity=spec["capacity"],
            has_seats=bool(spec["hall"]),
            card_bg=bg,
            card_accent=accent,
            card_text=text,
        )
        db.add(event)
        db.flush()

        if not spec["hall"]:
            print(f"  {event.title} — без рассадки, мест {event.capacity or '∞'}")
            continue

        hall = halls[spec["hall"]]
        session = Session(
            event_id=event.id,
            hall_id=hall.id,
            datetime=event.date,
            status="active",
        )
        db.add(session)
        db.flush()

        for category, price in spec["prices"].items():
            db.add(SeatPrice(session_id=session.id, category=category, price=price))
        db.flush()

        sessions.append(session)
        print(f"  {event.title} — сеанс в «{hall.name}», "
              f"цены {'/'.join(str(p) for p in spec['prices'].values())}")
    return sessions


def build_tickets(db: OrmSession, sessions: list[Session]) -> None:
    """Give the admin one ticket of each kind, so the cabinet shows all states."""
    admin = db.execute(select(User).where(User.role == "superadmin")).scalars().first()
    if not admin:
        print("  суперадмина нет — билеты пропущены")
        return

    new_id = lambda: f"VP-{uuid.uuid4().hex[:12].upper()}"
    made = []

    # 1. Seated, still valid: first free non-aisle seat of the first session.
    if sessions:
        session = sessions[0]
        seat = db.execute(
            select(Seat)
            .where(Seat.hall_id == session.hall_id, Seat.is_aisle.is_(False))
            .order_by(Seat.row, Seat.col)
        ).scalars().first()
        price = db.execute(
            select(SeatPrice).where(
                SeatPrice.session_id == session.id, SeatPrice.category == seat.category
            )
        ).scalars().first()
        db.add(Ticket(ticket_id=new_id(), user_id=admin.id, event_id=session.event_id,
                      session_id=session.id, seat_id=seat.id, used=False,
                      price_paid=price.price if price else 0))
        made.append(f"с местом {seat.label} ({seat.category})")

    # 2. General admission, valid.
    free = db.execute(
        select(Event).where(Event.has_seats.is_(False), Event.date > NOW)
        .order_by(Event.date)
    ).scalars().first()
    if free:
        db.add(Ticket(ticket_id=new_id(), user_id=admin.id, event_id=free.id,
                      used=False, price_paid=0))
        made.append("без места, действующий")

    # 3. Expired: the event has already happened.
    past = db.execute(
        select(Event).where(Event.date < NOW).order_by(Event.date.desc())
    ).scalars().first()
    if past:
        db.add(Ticket(ticket_id=new_id(), user_id=admin.id, event_id=past.id,
                      used=False, price_paid=0,
                      created_at=past.date - timedelta(days=6)))
        made.append("истёкший")

    # 4. Already scanned, so the torn card is visible too.
    if len(sessions) > 1:
        session = sessions[1]
        seat = db.execute(
            select(Seat)
            .where(Seat.hall_id == session.hall_id, Seat.is_aisle.is_(False))
            .order_by(Seat.row.desc(), Seat.col.desc())
        ).scalars().first()
        db.add(Ticket(ticket_id=new_id(), user_id=admin.id, event_id=session.event_id,
                      session_id=session.id, seat_id=seat.id, used=True,
                      used_at=NOW - timedelta(hours=5), price_paid=0))
        made.append(f"погашенный, место {seat.label}")

    db.flush()
    for line in made:
        print(f"  билет: {line}")


def main() -> int:
    keep = "--keep" in sys.argv
    engine = create_engine(settings.sync_database_url, echo=False)

    with OrmSession(engine) as db:
        print("Velox Pass — демо-данные")
        if keep:
            print("  режим --keep: существующие данные не трогаем")
        else:
            wipe(db)

        halls = build_venues(db)
        sessions = build_events(db, halls)
        build_tickets(db, sessions)
        db.commit()

    engine.dispose()
    print("\nГотово. Откройте афишу и админку.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
