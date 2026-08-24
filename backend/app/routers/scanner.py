from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_scanner
from app.models.user import User
from app.schemas.ticket import ScanRequest, ScanResult
from app.services import ticket_service

router = APIRouter(prefix="/scanner", tags=["scanner"])


@router.post("/check", response_model=ScanResult)
async def check_ticket(
    data: ScanRequest,
    _: User = Depends(require_scanner),
    db: AsyncSession = Depends(get_db),
):
    """Validate a scanned QR payload and burn the ticket on first valid scan."""
    status_code, message, ticket = await ticket_service.scan_ticket(db, data.ticket_id)
    return ScanResult(
        status=status_code,
        message=message,
        ticket=ticket_service.serialize_ticket(ticket) if ticket else None,
    )
