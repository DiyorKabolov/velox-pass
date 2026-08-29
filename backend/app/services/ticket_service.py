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
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.event import Event
from app.models.seat import Seat
from app.models.seat_price import SeatPrice
from app.models.ticket import Ticket
from app.models.user import User
from app.schemas.ticket import TicketOut


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
        event_location=event.location if event else None,
        seat_label=(seat.label or f"R{seat.row} S{seat.col}") if seat else None,
        hall_name=hall.name if hall else None,
        card_bg=event.card_bg if event else None,
        card_accent=event.card_accent if event else None,
        card_text=event.card_text if event else None,
    )


async def _resolve_price(
    db: AsyncSession, session_id: int | None, seat: Seat | None
) -> float:
    if not session_id or not seat:
        return 0.0
    result = await db.execute(
        select(SeatPrice).where(
            SeatPrice.session_id == session_id, SeatPrice.category == seat.category
        )
    )
    price = result.scalar_one_or_none()
    return float(price.price) if price else 0.0


async def generate_ticket(
    db: AsyncSession,
    user: User,
    event_id: int,
    session_id: int | None = None,
    seat_id: int | None = None,
) -> Ticket:
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Мероприятие не найдено")

    seat: Seat | None = None
    if event.has_seats:
        if not seat_id:
            raise HTTPException(
                status_code=400, detail="Для этого мероприятия нужно выбрать место"
            )
        seat = await db.get(Seat, seat_id)
        if not seat or seat.is_aisle:
            raise HTTPException(status_code=400, detail="Место недоступно")

        taken = await db.execute(
            select(Ticket).where(
                Ticket.seat_id == seat_id, Ticket.session_id == session_id
            )
        )
        if taken.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="Место уже занято"
            )
    elif event.capacity:
        sold = await db.scalar(
            select(func.count(Ticket.id)).where(Ticket.event_id == event_id)
        )
        if (sold or 0) >= event.capacity:
            raise HTTPException(status_code=409, detail="Мест нет")

    ticket = Ticket(
        ticket_id=new_ticket_id(),
        user_id=user.id,
        event_id=event_id,
        seat_id=seat.id if seat else None,
        session_id=session_id,
        used=False,
        price_paid=await _resolve_price(db, session_id, seat),
    )
    db.add(ticket)
    await db.flush()

    # Reload with relations so serialization happens in one place.
    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.event),
            # .hall as well: serialize_ticket reads the hall name, and a lazy
            # load of it inside async code raises MissingGreenlet.
            selectinload(Ticket.seat).selectinload(Seat.hall),
        )
        .where(Ticket.id == ticket.id)
    )
    return result.scalar_one()


async def get_user_tickets(db: AsyncSession, user_id: int) -> list[Ticket]:
    result = await db.execute(
        select(Ticket)
        .options(
            selectinload(Ticket.event),
            # .hall as well: serialize_ticket reads the hall name, and a lazy
            # load of it inside async code raises MissingGreenlet.
            selectinload(Ticket.seat).selectinload(Seat.hall),
        )
        .where(Ticket.user_id == user_id)
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
    if ticket.used:
        return "used", "Билет уже использован", ticket

    event = ticket.event
    if event and event.date and event.date < datetime.now(timezone.utc):
        return "expired", "Мероприятие уже завершилось", ticket

    ticket.used = True
    ticket.used_at = datetime.now(timezone.utc)
    await db.flush()
    return "ok", "Проходите, билет действителен", ticket


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
