from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


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
    # When this ticket is for: its showing, or the event itself when it has
    # none. A series shares one event date -- its first showing -- so reading
    # event_date called a ticket for next Friday expired after last Sunday.
    starts_at: datetime | None = None
    event_location: str | None = None
    seat_label: str | None = None
    hall_name: str | None = None
    card_bg: str | None = None
    card_accent: str | None = None
    card_text: str | None = None

    # A gift: who gave it, what they wrote, and whether it has been accepted.
    gifted_by: int | None = None
    gifted_by_username: str | None = None
    gift_message: str | None = None
    gift_status: str | None = None


class TicketCreate(BaseModel):
    """One order. `seats` for a seated event -- a ticket per seat -- or
    `quantity` for one without seats."""

    event_id: int
    session_id: int | None = None
    seats: list[int] = []
    quantity: int | None = Field(default=None, ge=1)
    # The single-seat form the app sent before orders held several.
    seat_id: int | None = None

    @model_validator(mode="after")
    def _fold_single_seat(self) -> "TicketCreate":
        if self.seat_id is not None and not self.seats:
            self.seats = [self.seat_id]
        return self


class ScanRequest(BaseModel):
    ticket_id: str


class ScanResult(BaseModel):
    """Scanner verdict. `ok` is true only on the first valid scan."""

    ok: bool
    status: str  # ok | used | expired | invalid | wrong_venue | gift_pending
    message: str
    used_at: datetime | None = None
    ticket: TicketOut | None = None
