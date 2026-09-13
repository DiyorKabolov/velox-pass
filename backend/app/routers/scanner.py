from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_door_staff, scanner_venue_ids
from app.models.user import User
from app.schemas.ticket import ScanRequest, ScanResult
from app.services import ticket_service
from app.services.access import ticket_venue_id

router = APIRouter(prefix="/scanner", tags=["scanner"])


@router.post("/check", response_model=ScanResult)
async def check_ticket(
    data: ScanRequest,
    user: User = Depends(get_current_door_staff),
    db: AsyncSession = Depends(get_db, scope="function"),
):
    """Validate a scanned QR payload and burn the ticket on first valid scan.

    Only `status == "ok"` sets `ok`; an already used or expired ticket comes
    back with ok=false so the scanner UI can show a red result.

    The venue is checked before anything else happens to the ticket. Checking
    it after would already have burned a ticket the operator had no right to
    touch -- and a scanner at one venue could void every ticket at another.
    """
    allowed = await scanner_venue_ids(db, user)
    if allowed is not None:
        ticket = await ticket_service.get_ticket_by_public_id(db, data.ticket_id)
        if ticket is not None:
            venue_id = await ticket_venue_id(db, ticket)
            if venue_id is None or venue_id not in allowed:
                # Nothing about the ticket goes back: it belongs to a venue
                # this operator does not work at.
                return ScanResult(
                    ok=False,
                    status="wrong_venue",
                    message="Билет другой площадки",
                    used_at=None,
                    ticket=None,
                )

    status_code, message, ticket = await ticket_service.scan_ticket(db, data.ticket_id)
    return ScanResult(
        ok=status_code == "ok",
        status=status_code,
        message=message,
        used_at=ticket.used_at if ticket else None,
        ticket=ticket_service.serialize_ticket(ticket) if ticket else None,
    )
