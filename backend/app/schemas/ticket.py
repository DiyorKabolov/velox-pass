from datetime import datetime

from pydantic import BaseModel, ConfigDict


class TicketOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: str
    user_id: int
    event_id: int
    seat_id: int | None
    session_id: int | None
    used: bool
    used_at: datetime | None = None
    price_paid: float
    created_at: datetime

    # Flattened extras filled in by the ticket service for the UI.
    event_title: str | None = None
    event_date: datetime | None = None
    event_location: str | None = None
    seat_label: str | None = None
    hall_name: str | None = None
    card_bg: str | None = None
    card_accent: str | None = None
    card_text: str | None = None


class TicketCreate(BaseModel):
    event_id: int
    session_id: int | None = None
    seat_id: int | None = None


class ScanRequest(BaseModel):
    ticket_id: str


class ScanResult(BaseModel):
    """Scanner verdict. `ok` is true only on the first valid scan."""

    ok: bool
    status: str  # ok | used | expired | invalid
    message: str
    used_at: datetime | None = None
    ticket: TicketOut | None = None
