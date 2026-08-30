"""SQLAlchemy models. Importing this package registers every table on Base."""
from app.core.database import Base
from app.models.event import Event
from app.models.hall import Hall
from app.models.pdf_template import PdfTemplate
from app.models.seat import Seat
from app.models.seat_price import SeatPrice
from app.models.session import Session
from app.models.ticket import Ticket
from app.models.user import User
from app.models.user_venue_role import UserVenueRole
from app.models.venue import Venue

__all__ = [
    "Base",
    "Event",
    "Hall",
    "PdfTemplate",
    "Seat",
    "SeatPrice",
    "Session",
    "Ticket",
    "User",
    "UserVenueRole",
    "Venue",
]
