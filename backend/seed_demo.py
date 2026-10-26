"""Wipe the demo content and fill the database with a cinema season.

    python seed_demo.py

Three venues in Dushanbe, four halls with a full seat map, eight films and
performances, a fortnight of showings with prices, and a handful of sold
tickets -- enough for every screen of the app to have something real on it.

Two things are never touched:

* the users table, so nobody has to sign up again;
* the event named in KEEP_TITLES, together with everything it hangs off --
  its tickets, its venue and the grant that lets its administrator manage it.
"""
import random
import sys
from datetime import datetime, timedelta

from sqlalchemy import create_engine, delete, select
from sqlalchemy.orm import Session as OrmSession

from app.core.config import settings
from app.models import (
    Event,
    Friendship,
    Hall,
    PdfTemplate,
    Seat,
    SeatPrice,
    Session,
    Ticket,
    User,
    UserVenueRole,
    Venue,
)
from app.services.ticket_service import new_ticket_id

# The Windows console is cp1252 by default and every line below is Russian.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# Showings are stored with an offset, and the site shows them in the reader's
# own zone. Building them in the machine's zone means 21:00 here reads 21:00
# on screen, which is the only way a cinema timetable makes sense.
LOCAL_TZ = datetime.now().astimezone().tzinfo
NOW = datetime.now(LOCAL_TZ)
TODAY = NOW.date()

MON, TUE, WED, THU, FRI, SAT, SUN = range(7)

# Events whose title starts with one of these survive the wipe untouched.
KEEP_TITLES = ("Осенний бал",)

random.seed(20260917)


# --------------------------------------------------------------------------
# when things are on
# --------------------------------------------------------------------------
def moment(day, hour, minute=0):
    return datetime(day.year, day.month, day.day, hour, minute, tzinfo=LOCAL_TZ)


def schedule(weekdays, times, *, days):
    """Every showing on those weekdays at those times within the next `days`.

    Today counts, but only the times that have not already passed: a timetable
    offering this morning's ten o'clock would be a broken page, not a demo.
    """
    out = []
    for offset in range(days + 1):
        day = TODAY + timedelta(days=offset)
        if day.weekday() not in weekdays:
            continue
        for hour, minute in times:
            when = moment(day, hour, minute)
            if when > NOW:
                out.append(when)
    return sorted(out)


def next_weekdays(weekday, count, hour, minute=0):
    """The next `count` Saturdays (or whichever day), starting from tomorrow."""
    out = []
    day = TODAY + timedelta(days=1)
    while len(out) < count:
        if day.weekday() == weekday:
            out.append(moment(day, hour, minute))
        day += timedelta(days=1)
    return out


# --------------------------------------------------------------------------
# what there is
# --------------------------------------------------------------------------
CINEMA_PRICES = {"standard": 50, "vip": 90}
THEATER_PRICES = {"standard": 80, "balcony": 120}

VENUES = [
    {
        "key": "ватан",
        "name": "Кинотеатр «Ватан»",
        "type": "cinema",
        "address": "г. Душанбе, пр. Рудаки, 33",
        "description": "Старейший кинотеатр столицы: два зала, цифровая проекция и звук Dolby.",
        "halls": [
            {
                "name": "Большой зал",
                "rows": 10,
                "cols": 16,
                # (first row, last row, category), rows counted from the screen.
                "bands": [(1, 8, "standard"), (9, 10, "vip")],
                "prices": CINEMA_PRICES,
            },
            {
                "name": "Малый зал",
                "rows": 6,
                "cols": 10,
                "bands": [(1, 6, "standard")],
                "prices": CINEMA_PRICES,
            },
        ],
    },
    {
        "key": "садбарг",
        "name": "Кинотеатр «Садбарг»",
        "type": "cinema",
        "address": "г. Душанбе, ул. Айни, 14",
        "description": "Уютный зал в центре города, авторское кино и повторные показы.",
        "halls": [
            {
                "name": "Зал 1",
                "rows": 8,
                "cols": 12,
                "bands": [(1, 6, "standard"), (7, 8, "vip")],
                "prices": CINEMA_PRICES,
            },
        ],
    },
    {
        "key": "лахути",
        "name": "Театр имени Лахути",
        "type": "theater",
        "address": "г. Душанбе, пр. Рудаки, 28",
        "description": "Академический драматический театр, основан в 1929 году.",
        "halls": [
            {
                "name": "Главная сцена",
                "rows": 12,
                "cols": 20,
                "bands": [(1, 10, "standard"), (11, 12, "balcony")],
                "prices": THEATER_PRICES,
            },
        ],
    },
]


EVENTS = [
    {
        "title": "Дюна: Часть третья",
        "description": (
            "Пол Атрейдес продолжает своё путешествие по пустынным просторам Арракиса. "
            "Объединив фрименов под своим знаменем, он готовится к финальному "
            "противостоянию с Домом Харконненов. Эпическая космическая сага достигает "
            "своей кульминации."
        ),
        "venue": "ватан",
        "hall": "Большой зал",
        "colors": ("#fdfdf5", "#c084fc", "#1a0a2e"),
        "tags": ["кино", "фантастика"],
        "when": lambda: schedule(
            {MON, WED, FRI, SAT, SUN}, [(10, 0), (14, 0), (17, 30), (21, 0)], days=14
        ),
    },
    {
        "title": "Человек-паук: Новое поколение 2",
        "description": (
            "Майлз Моралес возвращается в новом приключении, которое охватит сразу "
            "несколько вселенных. Анимационный шедевр от Sony Pictures с уникальным "
            "визуальным стилем, покорившим зрителей всего мира."
        ),
        "venue": "ватан",
        "hall": "Большой зал",
        "colors": ("#fdf5f5", "#f87171", "#2a0a0a"),
        "tags": ["кино", "анимация"],
        "when": lambda: schedule({TUE, THU, SAT, SUN}, [(11, 0), (15, 0), (19, 0)], days=14),
    },
    {
        "title": "Интерстеллар — возвращение",
        "description": (
            "Специальный повторный показ культового фильма Кристофера Нолана в формате "
            "IMAX. Путешествие сквозь червоточину к далёким галактикам в поисках нового "
            "дома для человечества."
        ),
        "venue": "ватан",
        "hall": "Малый зал",
        "colors": ("#f5f8fd", "#60a5fa", "#0a1428"),
        "tags": ["кино", "фантастика"],
        "when": lambda: schedule({FRI, SAT}, [(20, 0)], days=14),
    },
    {
        "title": "Мастер и Маргарита",
        "description": (
            "Экранизация бессмертного романа Михаила Булгакова. Москва 1930-х годов. "
            "Загадочный иностранец по имени Воланд появляется в городе и переворачивает "
            "жизнь его обитателей с ног на голову."
        ),
        "venue": "садбарг",
        "hall": "Зал 1",
        "colors": ("#fdfaf0", "#f59e0b", "#1a1000"),
        "tags": ["кино", "драма"],
        "when": lambda: schedule({MON, WED, THU, FRI}, [(12, 0), (16, 0), (20, 0)], days=14),
    },
    {
        "title": "Гарри Поттер и Тайная комната",
        "description": (
            "Специальный показ в честь юбилея франшизы. Второй год в Хогвартсе обещает "
            "быть ещё более захватывающим: загадочные нападения на учеников, говорящий "
            "змей и тайная комната, которую все боятся открыть."
        ),
        "venue": "садбарг",
        "hall": "Зал 1",
        "colors": ("#f0fdf4", "#4ade80", "#0a1a0a"),
        "tags": ["кино"],
        "when": lambda: schedule({SAT, SUN}, [(10, 0), (13, 0), (16, 0)], days=14),
    },
    {
        "title": "Чайка — спектакль А.П. Чехова",
        "description": (
            "Режиссёр Марина Хасанова представляет новое прочтение классической пьесы "
            "Антона Павловича Чехова. История о любви, творчестве и несбыточных мечтах "
            "в исполнении труппы театра имени Лахути."
        ),
        "venue": "лахути",
        "hall": "Главная сцена",
        "colors": ("#fdfdf5", "#a898e0", "#1a1428"),
        "tags": ["театр", "драма"],
        "when": lambda: sorted(
            schedule({FRI, SAT}, [(19, 0)], days=28) + schedule({SUN}, [(17, 0)], days=28)
        ),
    },
    {
        "title": "Лебединое озеро",
        "description": (
            "Балетный спектакль в постановке Государственного академического театра "
            "оперы и балета Таджикистана. Музыка Чайковского, классическая хореография "
            "и великолепные костюмы создают незабываемое зрелище."
        ),
        "venue": "лахути",
        "hall": "Главная сцена",
        "colors": ("#fdf5fd", "#e879f9", "#1a001a"),
        "tags": ["театр", "балет"],
        "when": lambda: next_weekdays(SAT, 3, 18),
    },
    {
        "title": "Стендап-вечер: Открытый микрофон",
        "description": (
            "Ежемесячный вечер стендап-комедии в Душанбе. На сцену выходят как опытные "
            "комики, так и новички. Живая атмосфера, искренний смех и истории из жизни. "
            "Вход свободный, места ограничены."
        ),
        "venue": "садбарг",
        "hall": None,
        "capacity": 80,
        "colors": ("#fdfdf5", "#f97316", "#1a0800"),
        "tags": ["стендап"],
        "when": lambda: next_weekdays(FRI, 1, 20),
    },
]


# --------------------------------------------------------------------------
# clearing out
# --------------------------------------------------------------------------
def protected(db):
    """Ids of everything the wipe must leave alone, keyed by table."""
    events = set()
    for title in KEEP_TITLES:
        rows = db.execute(select(Event.id).where(Event.title.ilike(f"{title}%"))).scalars()
        events.update(rows)
    if not events:
        return {"events": set(), "sessions": set(), "halls": set(), "venues": set()}

    sessions = set(
        db.execute(select(Session.id).where(Session.event_id.in_(events))).scalars()
    )
    # A kept event may hang off a hall through its own showings, and off a
    # venue through either the hall or the event row itself.
    halls = set(
        db.execute(
            select(Session.hall_id).where(
                Session.id.in_(sessions), Session.hall_id.is_not(None)
            )
        ).scalars()
    )
    venues = set(
        db.execute(
            select(Event.venue_id).where(
                Event.id.in_(events), Event.venue_id.is_not(None)
            )
        ).scalars()
    )
    if halls:
        venues.update(
            db.execute(select(Hall.venue_id).where(Hall.id.in_(halls))).scalars()
        )
    return {"events": events, "sessions": sessions, "halls": halls, "venues": venues}


def wipe(db, keep):
    """Delete everything but the users and the protected event's own rows.

    Child rows go first: several foreign keys are ON DELETE SET NULL rather
    than CASCADE, and a blanked column is exactly the silent damage this is
    meant to avoid.
    """
    def survives(column, kept):
        return column.not_in(kept) if kept else None

    def erase(model, condition=None):
        statement = delete(model) if condition is None else delete(model).where(condition)
        return db.execute(statement).rowcount

    counts = {
        "цены": erase(SeatPrice, survives(SeatPrice.session_id, keep["sessions"])),
        "билеты": erase(Ticket, survives(Ticket.event_id, keep["events"])),
        "места": erase(Seat, survives(Seat.hall_id, keep["halls"])),
        "сеансы": erase(Session, survives(Session.id, keep["sessions"])),
        "залы": erase(Hall, survives(Hall.id, keep["halls"])),
        "права на площадки": erase(
            UserVenueRole, survives(UserVenueRole.venue_id, keep["venues"])
        ),
        "дружбы": erase(Friendship),
        "шаблоны PDF": erase(PdfTemplate),
        "мероприятия": erase(Event, survives(Event.id, keep["events"])),
        "площадки": erase(Venue, survives(Venue.id, keep["venues"])),
    }
    db.flush()
    print("✓ Очищено: " + ", ".join(f"{name} {n}" for name, n in counts.items()))
    if keep["events"]:
        print(f"  сохранено нетронутым: мероприятий {len(keep['events'])}, "
              f"площадок {len(keep['venues'])}")


# --------------------------------------------------------------------------
# building up
# --------------------------------------------------------------------------
def build_venues(db):
    """Venues, halls and every seat of every hall."""
    venues, halls, seats_made = {}, {}, 0

    for spec in VENUES:
        venue = Venue(
            name=spec["name"],
            type=spec["type"],
            address=spec["address"],
            description=spec["description"],
        )
        db.add(venue)
        db.flush()
        venues[spec["key"]] = venue

        for hall_spec in spec["halls"]:
            rows, cols = hall_spec["rows"], hall_spec["cols"]

            def category_of(row, bands=hall_spec["bands"]):
                for first, last, category in bands:
                    if first <= row <= last:
                        return category
                return "standard"

            # The grid mirrors the seats below: it is what the hall editor
            # draws, so the two must say the same thing about every cell.
            grid = [
                [{"category": category_of(row), "is_aisle": False} for _ in range(cols)]
                for row in range(1, rows + 1)
            ]
            hall = Hall(
                venue_id=venue.id,
                name=hall_spec["name"],
                rows=rows,
                cols=cols,
                layout_json={"seats": grid},
            )
            db.add(hall)
            db.flush()

            db.add_all(
                Seat(
                    hall_id=hall.id,
                    row=row,
                    col=col,
                    label=f"{row}-{col}",
                    category=category_of(row),
                    is_aisle=False,
                )
                for row in range(1, rows + 1)
                for col in range(1, cols + 1)
            )
            db.flush()

            halls[(spec["key"], hall.name)] = hall
            hall.prices = hall_spec["prices"]  # carried in memory, not a column
            seats_made += rows * cols
            print(f"  {venue.name} / {hall.name}: {rows}×{cols} = {rows * cols} мест")

    print(f"✓ Создано {len(venues)} площадок, {len(halls)} залов, {seats_made} мест")
    return venues, halls


def venue_admins(db, venues):
    """Give every venue administrator a venue again, and say who owns what.

    The wipe took their grants with the old venues; without new ones their
    dashboard would open on nothing at all.
    """
    owners = {}
    superadmin = db.execute(
        select(User).where(User.role == "superadmin").order_by(User.id)
    ).scalars().first()

    admins = db.execute(
        select(User).where(User.role == "venue_admin").order_by(User.id)
    ).scalars().all()
    already = set(db.execute(select(UserVenueRole.user_id)).scalars())

    free = [venue for venue in venues.values()]
    for admin in admins:
        if admin.id in already or not free:
            continue
        venue = free.pop(0)
        db.add(UserVenueRole(user_id=admin.id, venue_id=venue.id, role="venue_admin"))
        owners[venue.id] = admin.id
        print(f"  {venue.name} → {admin.username}")
    db.flush()

    if owners:
        print(f"✓ Назначено администраторов площадок: {len(owners)}")
    return owners, superadmin.id if superadmin else None


def build_events(db, venues, halls, owners, fallback_owner):
    """Events, their showings and the price of every seat category."""
    made = []
    total_sessions = 0

    for spec in EVENTS:
        venue = venues[spec["venue"]]
        hall = halls[(spec["venue"], spec["hall"])] if spec["hall"] else None
        times = spec["when"]()
        if not times:
            print(f"  {spec['title']}: ближайших сеансов нет, пропущено")
            continue

        background, accent, text = spec["colors"]
        event = Event(
            title=spec["title"],
            description=spec["description"],
            # The event's own date is the first showing: the poster and the
            # "is it over" check both read it.
            date=times[0],
            location=venue.name,
            capacity=spec.get("capacity", 0),
            price=0,
            has_seats=hall is not None,
            venue_id=venue.id,
            tags=spec["tags"],
            created_by=owners.get(venue.id, fallback_owner),
            card_bg=background,
            card_accent=accent,
            card_text=text,
        )
        db.add(event)
        db.flush()

        # One group id for the whole run, so the admin can see and cancel a
        # series rather than thirty unrelated showings.
        group = f"seed-{event.id}"
        sessions = [
            Session(
                event_id=event.id,
                hall_id=hall.id if hall else None,
                datetime=when,
                status="active",
                recurring_group_id=group if len(times) > 1 else None,
            )
            for when in times
        ]
        db.add_all(sessions)
        db.flush()

        if hall:
            categories = {seat_category for _, _, seat_category in hall_bands(hall)}
            for session in sessions:
                for category in sorted(categories):
                    price = hall.prices.get(category)
                    if price is not None:
                        db.add(
                            SeatPrice(
                                session_id=session.id, category=category, price=price
                            )
                        )
            db.flush()

        total_sessions += len(sessions)
        made.append((event, sessions))
        where = hall.name if hall else "без рассадки"
        print(f"  {event.title}: сеансов {len(sessions)}, {where}, "
              f"с {times[0]:%d.%m %H:%M} по {times[-1]:%d.%m %H:%M}")

    print(f"✓ Создано {len(made)} мероприятий и {total_sessions} сеансов")
    return made


def hall_bands(hall):
    """The (first, last, category) bands of a hall, read back from its grid."""
    grid = (hall.layout_json or {}).get("seats") or []
    bands = []
    for index, row in enumerate(grid, start=1):
        category = (row[0] or {}).get("category", "standard") if row else "standard"
        if bands and bands[-1][2] == category:
            bands[-1] = (bands[-1][0], index, category)
        else:
            bands.append((index, index, category))
    return bands


# --------------------------------------------------------------------------
# tickets already sold
# --------------------------------------------------------------------------
def price_of(db, session_id, category):
    row = db.execute(
        select(SeatPrice.price).where(
            SeatPrice.session_id == session_id, SeatPrice.category == category
        )
    ).scalar_one_or_none()
    return row or 0


def sell(db, session, seats, buyers, *, used):
    for seat in seats:
        db.add(
            Ticket(
                ticket_id=new_ticket_id(),
                user_id=random.choice(buyers).id,
                event_id=session.event_id,
                session_id=session.id,
                seat_id=seat.id if seat else None,
                used=used,
                used_at=NOW - timedelta(minutes=random.randint(5, 90)) if used else None,
                price_paid=price_of(db, session.id, seat.category) if seat else 0,
            )
        )
    db.flush()


def build_tickets(db, made):
    """A sold-out patch in the middle of one hall, and two lighter bookings."""
    buyers = db.execute(select(User)).scalars().all()
    if not buyers:
        print("  пользователей нет — билеты пропущены")
        return

    by_title = {event.title: (event, sessions) for event, sessions in made}
    sold = 0

    # "Дюна": the block in front of the projector, the earlier rows already
    # scanned in, so the hall map shows taken seats and the admin shows revenue.
    entry = by_title.get("Дюна: Часть третья")
    if entry:
        session = entry[1][0]
        rows = db.execute(
            select(Seat)
            .where(
                Seat.hall_id == session.hall_id,
                Seat.row.between(5, 7),
                Seat.col.between(6, 11),
            )
            .order_by(Seat.row, Seat.col)
        ).scalars().all()
        scanned = [seat for seat in rows if seat.row <= 6]
        waiting = [seat for seat in rows if seat.row == 7]
        sell(db, session, scanned, buyers, used=True)
        sell(db, session, waiting, buyers, used=False)
        sold += len(rows)
        print(f"  {entry[0].title}: продано {len(rows)} мест "
              f"(погашено {len(scanned)}), сеанс {session.datetime:%d.%m %H:%M}")

    # "Лебединое озеро": a scattered fifteen, so the map is not a neat block.
    entry = by_title.get("Лебединое озеро")
    if entry:
        session = entry[1][0]
        seats = db.execute(
            select(Seat).where(Seat.hall_id == session.hall_id)
        ).scalars().all()
        chosen = random.sample(seats, min(15, len(seats)))
        sell(db, session, chosen, buyers, used=False)
        sold += len(chosen)
        print(f"  {entry[0].title}: продано {len(chosen)} мест, "
              f"сеанс {session.datetime:%d.%m %H:%M}")

    # The stand-up night has no seats, so its tickets are just admissions.
    entry = by_title.get("Стендап-вечер: Открытый микрофон")
    if entry:
        session = entry[1][0]
        sell(db, session, [None] * 12, buyers, used=False)
        sold += 12
        print(f"  {entry[0].title}: продано 12 входных билетов")

    print(f"✓ Создано {sold} билетов")


def main():
    engine = create_engine(settings.sync_database_url, echo=False)
    with OrmSession(engine) as db:
        print("Velox Pass — демо-данные кинотеатров\n")
        keep = protected(db)
        wipe(db, keep)
        venues, halls = build_venues(db)
        owners, superadmin = venue_admins(db, venues)
        made = build_events(db, venues, halls, owners, superadmin)
        build_tickets(db, made)
        db.commit()
    engine.dispose()
    print("\n✓ Демо-данные успешно загружены")
    return 0


if __name__ == "__main__":
    sys.exit(main())
