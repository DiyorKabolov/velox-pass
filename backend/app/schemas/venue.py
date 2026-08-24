from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VenueCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    type: str = "other"
    address: str | None = None


class VenueOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: str
    address: str | None
    created_at: datetime


class HallCreate(BaseModel):
    venue_id: int
    name: str = Field(min_length=1, max_length=255)
    rows: int = 0
    cols: int = 0
    layout_json: dict | None = None


class HallOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    venue_id: int
    name: str
    rows: int
    cols: int
    layout_json: dict | None


class SeatOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    hall_id: int
    row: int
    col: int
    label: str | None
    category: str
    is_aisle: bool
