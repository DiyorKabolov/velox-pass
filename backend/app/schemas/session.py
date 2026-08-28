from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SeatPriceIn(BaseModel):
    category: str
    price: float = Field(ge=0)


class SeatPriceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    category: str
    price: float


class SessionCreate(BaseModel):
    event_id: int
    hall_id: int
    # Mirrors the column name on the model.
    datetime: datetime
    prices: list[SeatPriceIn] = []


class SessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    event_id: int
    hall_id: int | None
    datetime: datetime
    status: str

    # Flattened for the UI so one request is enough to render a session card.
    event_title: str | None = None
    hall_name: str | None = None
    venue_name: str | None = None
    seats_total: int = 0
    seats_taken: int = 0
    seats_free: int = 0
    prices: list[SeatPriceOut] = []


class SeatMapSeat(BaseModel):
    """One cell of the seat grid, including whether it is already sold."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    row: int
    col: int
    label: str | None
    category: str
    is_aisle: bool
    is_taken: bool = False
    # Public id of the ticket holding the seat, when there is one.
    ticket_id: str | None = None
    price: float = 0.0


class SeatMapOut(BaseModel):
    session_id: int
    hall_id: int | None
    hall_name: str | None = None
    rows: int = 0
    cols: int = 0
    seats: list[SeatMapSeat] = []
    prices: list[SeatPriceOut] = []
