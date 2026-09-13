from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class VenueCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    # cinema | theater | concert | stadium | other
    type: str = "other"
    address: str | None = None
    description: str | None = None


class VenueUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    address: str | None = None
    description: str | None = None


class VenueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    address: str | None
    description: str | None = None
    image_url: str | None = None
    created_at: datetime
    halls_count: int = 0
    # Distinct events with at least one showing still to come. Filled in by the
    # listing endpoints; zero elsewhere rather than absent, so the public cards
    # never have to guard against a missing field.
    active_events_count: int = 0
    # When the next showing here starts. On the card it is a line of its own, so
    # it has to be known before anything is hovered -- which is why it travels
    # with the venue rather than with the schedule.
    next_session_at: datetime | None = None


def _check_layout(value):
    """Refuse a seat layout the server could not build seats from.

    The column is free-form JSON, and seats_for_layout reads each cell as an
    object; a cell that was a bare string reached it unchecked and came back as
    a 500. Cells may be null (an empty spot), never anything else.
    """
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("Схема зала должна быть объектом")
    grid = value.get("seats")
    if grid is None:
        return value
    if not isinstance(grid, list) or not all(isinstance(row, list) for row in grid):
        raise ValueError("seats — это список рядов, каждый ряд — список мест")
    for row_index, row in enumerate(grid, start=1):
        for col_index, cell in enumerate(row, start=1):
            if cell is not None and not isinstance(cell, dict):
                raise ValueError(
                    f"Место {row_index}:{col_index} должно быть объектом вида "
                    '{"category": "standard"}'
                )
    return value


class HallCreate(BaseModel):
    venue_id: int
    name: str = Field(min_length=1, max_length=255)
    rows: int = Field(ge=0, le=200, default=0)
    cols: int = Field(ge=0, le=200, default=0)
    # {"seats": [[{"category": "standard", "is_aisle": false}, ...], ...]}
    layout_json: dict[str, Any] | None = None

    _layout = field_validator("layout_json", mode="before")(_check_layout)


class HallUpdate(BaseModel):
    name: str | None = None
    rows: int | None = Field(default=None, ge=0, le=200)
    cols: int | None = Field(default=None, ge=0, le=200)
    layout_json: dict[str, Any] | None = None

    _layout = field_validator("layout_json", mode="before")(_check_layout)


class SeatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    hall_id: int
    row: int
    col: int
    label: str | None
    category: str
    is_aisle: bool
    # Filled in when the request names a session.
    is_taken: bool = False
    ticket_id: str | None = None


class HallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    venue_id: int
    name: str
    rows: int
    cols: int
    layout_json: dict[str, Any] | None
    seats_count: int = 0
    seats: list[SeatOut] = []


class VenueSessionOut(BaseModel):
    """One showing on a venue's public schedule.

    Flat on purpose: the schedule renders a whole month of these, and the page
    should not have to follow a reference per row to learn what is playing.
    """

    session_id: int
    event_id: int
    event_title: str
    event_image_url: str | None = None
    # The event's own colour, so a showing with no artwork still gets a
    # placeholder that belongs to it rather than a grey box.
    card_accent: str | None = None
    hall_name: str | None = None
    datetime: datetime
    available_seats: int = 0
    min_price: float | None = None
