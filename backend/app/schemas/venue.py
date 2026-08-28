from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class VenueCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    # cinema | theater | concert | stadium | other
    type: str = "other"
    address: str | None = None


class VenueUpdate(BaseModel):
    name: str | None = None
    type: str | None = None
    address: str | None = None


class VenueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    address: str | None
    created_at: datetime
    halls_count: int = 0


class HallCreate(BaseModel):
    venue_id: int
    name: str = Field(min_length=1, max_length=255)
    rows: int = Field(ge=0, le=200, default=0)
    cols: int = Field(ge=0, le=200, default=0)
    # {"seats": [[{"category": "standard", "is_aisle": false}, ...], ...]}
    layout_json: dict[str, Any] | None = None


class HallUpdate(BaseModel):
    name: str | None = None
    rows: int | None = Field(default=None, ge=0, le=200)
    cols: int | None = Field(default=None, ge=0, le=200)
    layout_json: dict[str, Any] | None = None


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
