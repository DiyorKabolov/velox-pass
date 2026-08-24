from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.ticket import TicketCreate, TicketOut
from app.services import ticket_service

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.get("/my", response_model=list[TicketOut])
async def my_tickets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    tickets = await ticket_service.get_user_tickets(db, user.id)
    return [ticket_service.serialize_ticket(t) for t in tickets]


@router.post("", response_model=TicketOut, status_code=201)
async def buy_ticket(
    data: TicketCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Issue a ticket for the current user."""
    ticket = await ticket_service.generate_ticket(
        db, user, data.event_id, data.session_id, data.seat_id
    )
    return ticket_service.serialize_ticket(ticket)


async def _owned_ticket(db: AsyncSession, ticket_id: str, user: User):
    ticket = await ticket_service.get_ticket_by_public_id(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.user_id != user.id and user.role != "superadmin":
        raise HTTPException(status_code=403, detail="This ticket belongs to someone else")
    return ticket


@router.get("/{ticket_id}", response_model=TicketOut)
async def get_ticket(
    ticket_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = await _owned_ticket(db, ticket_id, user)
    return ticket_service.serialize_ticket(ticket)


@router.get("/{ticket_id}/qr")
async def ticket_qr(
    ticket_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """PNG QR image for the ticket card."""
    ticket = await _owned_ticket(db, ticket_id, user)
    return Response(
        content=ticket_service.build_qr_png(ticket.ticket_id),
        media_type="image/png",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/{ticket_id}/pdf")
async def ticket_pdf(
    ticket_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = await _owned_ticket(db, ticket_id, user)
    pdf_bytes = ticket_service.build_ticket_pdf(ticket, user.username)
    filename = f"velox-pass-{ticket.ticket_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
