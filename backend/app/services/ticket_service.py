"""Ticket issuing, listing, QR rendering and PDF export."""
import io
import uuid
from datetime import datetime, timezone

import qrcode
from fastapi import HTTPException, status
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A6
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as pdf_canvas
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.pdf_template import PdfTemplate
from app.models.seat import Seat
from app.models.session import Session
from app.models.seat_price import SeatPrice
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ticket import TicketOut
from app.services import pdf_render


def new_ticket_id() -> str:
    """Short, URL-safe public id encoded into the QR code."""
    return f"VP-{uuid.uuid4().hex[:12].upper()}"


def build_qr_png(ticket_id: str, box_size: int = 8) -> bytes:
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=2,
    )
    qr.add_data(ticket_id)
    qr.make(fit=True)
    image = qr.make_image(fill_color="black", back_color="white").convert("RGB")
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()


def serialize_ticket(ticket: Ticket) -> TicketOut:
    """Flatten the event / seat relations the UI needs onto the ticket payload."""
    event = ticket.event
    seat = ticket.seat
    # Every caller eager-loads seat.hall, so this never lazy-loads.
    hall = seat.hall if seat else None
    return TicketOut(
        id=ticket.id,
        ticket_id=ticket.ticket_id,
        user_id=ticket.user_id,
        event_id=ticket.event_id,
        seat_id=ticket.seat_id,
        session_id=ticket.session_id,
        used=ticket.used,
        used_at=ticket.used_at,
        price_paid=float(ticket.price_paid or 0),
        created_at=ticket.created_at,
        event_title=event.title if event else None,
        event_date=event.date if event else None,
        starts_at=(
            ticket.session.datetime
            if ticket.session is not None
            else (event.date if event else None)
        ),
        event_location=event.location if event else None,
        seat_label=(seat.label or f"R{seat.row} S{seat.col}") if seat else None,
        hall_name=hall.name if hall else None,
        card_bg=event.card_bg if event else None,
        card_accent=event.card_accent if event else None,
        card_text=event.card_text if event else None,
        gifted_by=ticket.gifted_by,
        gifted_by_username=ticket.gifter.username if ticket.gifter is not None else None,
        gift_message=ticket.gift_message,
        gift_status=ticket.gift_status,
    )


async def _resolve_price(
    db: AsyncSession, event: Event, session_id: int | None, seat: Seat | None
) -> float:
    # Without a seat there is no category to look up: the event's own price is
    # the whole answer. It used to be 0 here unconditionally, which is why every
    # ticket to an unseated event was free whatever the organiser intended.
    if not seat:
        return float(event.price or 0)
    if not session_id:
        return 0.0
    result = await db.execute(
        select(SeatPrice).where(
            SeatPrice.session_id == session_id, SeatPrice.category == seat.category
        )
    )
    price = result.scalar_one_or_none()
    return float(price.price) if price else 0.0


# One order can hold many tickets, but not an unbounded number: an event with no
# capacity set would otherwise accept a request for a million rows.
MAX_TICKETS_PER_ORDER = 100


def _with_relations(query):
    return query.options(
        selectinload(Ticket.event),
        # .hall as well: serialize_ticket reads the hall name, and a lazy
        # load of it inside async code raises MissingGreenlet.
        selectinload(Ticket.seat).selectinload(Seat.hall),
    )


async def generate_tickets(
    db: AsyncSession,
    user: User,
    event_id: int,
    session_id: int | None = None,
    seat_ids: list[int] | None = None,
    quantity: int | None = None,
) -> list[Ticket]:
    """Issue a whole order: a ticket per seat, or `quantity` tickets without seats.

    All of it or none of it. Every check runs before anything is written, and a
    failure after that -- a seat taken by someone else in the same instant --
    raises, which rolls the request's transaction back with every ticket in it.
    """
    # Locks the event row, so orders for one event are settled one at a time:
    # two buyers counting the remaining capacity at once would both see room.
    event = await db.get(Event, event_id, with_for_update=True)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")

    session = None
    if session_id is not None:
        # Nothing stopped a ticket being sold for a showing that had already
        # happened, been cancelled, or belonged to another event entirely.
        session = await db.get(Session, session_id)
        if session is None or session.event_id != event_id:
            raise HTTPException(
                status_code=400, detail="Сеанс не относится к этому мероприятию"
            )
        if session.status == "cancelled":
            raise HTTPException(status_code=409, detail="Сеанс отменён")
        if session.status == "finished" or session.datetime < datetime.now(timezone.utc):
            raise HTTPException(status_code=409, detail="Этот сеанс уже прошёл")

    tickets: list[Ticket] = []
    if event.has_seats:
        if session is None:
            raise HTTPException(status_code=400, detail="Выберите сеанс")
        wanted = list(seat_ids or [])
        if not wanted:
            raise HTTPException(
                status_code=400, detail="Для этого мероприятия нужно выбрать место"
            )
        if len(set(wanted)) != len(wanted):
            raise HTTPException(status_code=400, detail="Одно место выбрано дважды")
        if len(wanted) > MAX_TICKETS_PER_ORDER:
            raise HTTPException(
                status_code=400,
                detail=f"За один раз можно купить не больше {MAX_TICKETS_PER_ORDER} билетов",
            )

        seats = {
            seat.id: seat
            for seat in (await db.execute(select(Seat).where(Seat.id.in_(wanted)))).scalars()
        }
        for seat_id in wanted:
            seat = seats.get(seat_id)
            # The hall is checked too: nothing used to stop a seat from another
            # hall being sold for this showing.
            if seat is None or seat.is_aisle or seat.hall_id != session.hall_id:
                raise HTTPException(status_code=400, detail="Место недоступно")

        taken = (
            await db.execute(
                select(Ticket.seat_id).where(
                    Ticket.session_id == session_id, Ticket.seat_id.in_(wanted)
                )
            )
        ).scalars().all()
        if taken:
            labels = ", ".join(
                seats[seat_id].label or f"R{seats[seat_id].row} S{seats[seat_id].col}"
                for seat_id in taken
            )
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=f"Место уже занято: {labels}"
            )

        prices = {
            row.category: float(row.price)
            for row in (
                await db.execute(select(SeatPrice).where(SeatPrice.session_id == session_id))
            ).scalars()
        }
        for seat_id in wanted:
            seat = seats[seat_id]
            tickets.append(
                Ticket(
                    ticket_id=new_ticket_id(),
                    user_id=user.id,
                    event_id=event_id,
                    seat_id=seat.id,
                    session_id=session_id,
                    used=False,
                    price_paid=prices.get(seat.category, 0.0),
                )
            )
    else:
        count = quantity or 1
        if count > MAX_TICKETS_PER_ORDER:
            raise HTTPException(
                status_code=400,
                detail=f"За один раз можно купить не больше {MAX_TICKETS_PER_ORDER} билетов",
            )
        if event.capacity:
            sold = await db.scalar(
                select(func.count(Ticket.id)).where(Ticket.event_id == event_id)
            ) or 0
            left = event.capacity - sold
            if left <= 0:
                raise HTTPException(status_code=409, detail="Мест нет")
            if count > left:
                raise HTTPException(status_code=409, detail=f"Осталось мест: {left}")
        for _ in range(count):
            tickets.append(
                Ticket(
                    ticket_id=new_ticket_id(),
                    user_id=user.id,
                    event_id=event_id,
                    session_id=session_id,
                    used=False,
                    price_paid=float(event.price or 0),
                )
            )

    db.add_all(tickets)
    try:
        await db.flush()
    except IntegrityError:
        # The unique seat index: another order took one of these seats between
        # the check above and this write.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Место уже занято"
        ) from None

    ids = [ticket.id for ticket in tickets]
    result = await db.execute(
        _with_relations(select(Ticket).where(Ticket.id.in_(ids))).order_by(Ticket.id)
    )
    return list(result.scalars().all())


async def generate_ticket(
    db: AsyncSession,
    user: User,
    event_id: int,
    session_id: int | None = None,
    seat_id: int | None = None,
) -> Ticket:
    """A single ticket -- an order of one. Kept for callers such as the demo seed."""
    tickets = await generate_tickets(
        db, user, event_id, session_id, [seat_id] if seat_id else None, 1
    )
    return tickets[0]


async def get_user_tickets(db: AsyncSession, user_id: int) -> list[Ticket]:
    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.event),
            # .hall as well: serialize_ticket reads the hall name, and a lazy
            # load of it inside async code raises MissingGreenlet.
            selectinload(Ticket.seat).selectinload(Seat.hall),
        )
        .where(
            Ticket.user_id == user_id,
            # A gift waiting for an answer is shown with the gifts, not here:
            # it cannot be used until it is accepted.
            or_(Ticket.gift_status.is_(None), Ticket.gift_status != "pending"),
        )
        .order_by(Ticket.created_at.desc())
    )
    return list(result.scalars().all())


async def get_ticket_by_public_id(db: AsyncSession, ticket_id: str) -> Ticket | None:
    # QR readers hand back stray whitespace, and some encode a URL; keep the
    # last path segment so both "VP-ABC123" and ".../t/VP-ABC123" resolve.
    ticket_id = (ticket_id or "").strip().rstrip("/").split("/")[-1]
    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.event),
            # .hall as well: serialize_ticket reads the hall name, and a lazy
            # load of it inside async code raises MissingGreenlet.
            selectinload(Ticket.seat).selectinload(Seat.hall),
        )
        .where(Ticket.ticket_id == ticket_id)
    )
    return result.scalar_one_or_none()


async def scan_ticket(
    db: AsyncSession, ticket_id: str
) -> tuple[str, str, Ticket | None]:
    """Validate a scanned code and mark the ticket used on first success."""
    ticket = await get_ticket_by_public_id(db, ticket_id)
    if not ticket:
        return "invalid", "Билет не найден", None
    if ticket.gift_status == "pending":
        # Given away but not yet accepted: neither the giver nor the
        # recipient may use it until the recipient says yes.
        return "gift_pending", "Подарок ещё не принят получателем", ticket
    if ticket.used:
        return "used", "Билет уже использован", ticket

    # The showing decides, when there is one. A series keeps its first night as
    # the event date, and checking that turned away every holder of a ticket
    # for a later showing as though the whole run were over.
    event = ticket.event
    now = datetime.now(timezone.utc)
    if ticket.session is not None:
        if ticket.session.datetime < now:
            return "expired", "Этот сеанс уже прошёл", ticket
    elif event and event.date and event.date < now:
        return "expired", "Мероприятие уже завершилось", ticket

    ticket.used = True
    ticket.used_at = datetime.now(timezone.utc)
    await db.flush()
    return "ok", "Проходите, билет действителен", ticket


async def resolve_template(db: AsyncSession, event: Event | None) -> PdfTemplate | None:
    """The template a ticket for this event should be stamped onto.

    The event's own choice wins; otherwise whichever template is marked default;
    otherwise None, and the caller falls back to the built-in A6 card. Resolving
    the default here rather than copying it onto the event means changing the
    default reaches every event that never picked one.
    """
    if event is None:
        return None
    if event.template_id:
        template = await db.get(PdfTemplate, event.template_id)
        if template:
            return template
    return await db.scalar(
        select(PdfTemplate).where(PdfTemplate.is_default.is_(True)).limit(1)
    )


def template_values(ticket: Ticket, username: str) -> dict[str, str]:
    """The text each placeable field resolves to for one ticket."""
    event = ticket.event
    seat = ticket.seat
    if seat:
        label = seat.label or f"R{seat.row} S{seat.col}"
        seat_text = f"Ряд {seat.row} · {label}"
    else:
        seat_text = "—"
    return {
        "event_title": (event.title if event else "") or "",
        "date": event.date.strftime("%d.%m.%Y %H:%M") if event and event.date else "",
        "location": (event.location if event else "") or "",
        "buyer_name": username or "",
        "seat": seat_text,
        "ticket_id": ticket.ticket_id,
    }


def build_templated_pdf(ticket: Ticket, username: str, template_path: str,
                        layout_json: str | None) -> bytes:
    """Stamp the ticket onto an uploaded template."""
    width, height = pdf_render.page_size(template_path)
    layout = pdf_render.parse_layout(layout_json)
    overlay = pdf_render.render_overlay(
        layout,
        template_values(ticket, username),
        build_qr_png(ticket.ticket_id, box_size=10),
        width,
        height,
    )
    return pdf_render.compose(template_path, overlay)


def build_ticket_pdf(ticket: Ticket, username: str) -> bytes:
    """Render a single A6 ticket card with the QR code."""
    event = ticket.event
    bg = HexColor(event.card_bg if event else "#fdfdf5")
    accent = HexColor(event.card_accent if event else "#a898e0")
    text_color = HexColor(event.card_text if event else "#2a2a2a")

    buffer = io.BytesIO()
    width, height = A6
    pdf = pdf_canvas.Canvas(buffer, pagesize=A6)
    pdf.setTitle(f"Velox Pass ticket {ticket.ticket_id}")

    pdf.setFillColor(bg)
    pdf.rect(0, 0, width, height, stroke=0, fill=1)

    pdf.setFillColor(accent)
    pdf.rect(0, height - 8 * mm, width, 8 * mm, stroke=0, fill=1)

    pdf.setFillColor(text_color)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(10 * mm, height - 16 * mm, "VELOX - PASS")

    pdf.setFont("Helvetica-Bold", 15)
    pdf.drawString(10 * mm, height - 26 * mm, (event.title if event else "Event")[:34])

    pdf.setFont("Helvetica", 9)
    line_y = height - 34 * mm
    if event and event.date:
        pdf.drawString(10 * mm, line_y, event.date.strftime("%d.%m.%Y  %H:%M"))
        line_y -= 6 * mm
    if event and event.location:
        pdf.drawString(10 * mm, line_y, event.location[:40])
        line_y -= 6 * mm
    if ticket.seat:
        seat_label = ticket.seat.label or f"Row {ticket.seat.row} Seat {ticket.seat.col}"
        pdf.drawString(10 * mm, line_y, f"Seat: {seat_label}")
        line_y -= 6 * mm
    pdf.drawString(10 * mm, line_y, f"Holder: {username}")

    qr_size = 38 * mm
    pdf.drawImage(
        ImageReader(io.BytesIO(build_qr_png(ticket.ticket_id, box_size=10))),
        width - qr_size - 10 * mm,
        12 * mm,
        qr_size,
        qr_size,
        mask="auto",
    )

    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(10 * mm, 16 * mm, ticket.ticket_id)
    pdf.setFont("Helvetica", 7)
    issued = ticket.created_at.strftime("%d.%m.%Y %H:%M")
    pdf.drawString(10 * mm, 11 * mm, f"Issued {issued}")
    if ticket.used:
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(10 * mm, 6 * mm, "USED")

    pdf.showPage()
    pdf.save()
    return buffer.getvalue()
