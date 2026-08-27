from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_scanner
from app.models.user import User
from app.schemas.ticket import ScanRequest, ScanResult
from app.services import ticket_service

router = APIRouter(prefix="/scanner", tags=["scanner"])


@router.post("/check", response_model=ScanResult)
async def check_ticket(
    data: ScanRequest,
    _: User = Depends(get_current_scanner),
    db: AsyncSession = Depends(get_db),
):
    """Validate a scanned QR payload and burn the ticket on first valid scan.

    Only `status == "ok"` sets `ok`; an already used or expired ticket comes
    back with ok=false so the scanner UI can show a red result.
    """
    status_code, message, ticket = await ticket_service.scan_ticket(db, data.ticket_id)
    return ScanResult(
        ok=status_code == "ok",
        status=status_code,
        message=message,
        used_at=ticket.used_at if ticket else None,
        ticket=ticket_service.serialize_ticket(ticket) if ticket else None,
    )
