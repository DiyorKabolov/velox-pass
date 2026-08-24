from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    date: datetime
    location: str | None = None
    capacity: int = 0
    has_seats: bool = False
    venue_id: int | None = None
    card_bg: str = "#fdfdf5"
    card_accent: str = "#a898e0"
    card_text: str = "#2a2a2a"


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    date: datetime | None = None
    location: str | None = None
    capacity: int | None = None
    has_seats: bool | None = None
    venue_id: int | None = None
    card_bg: str | None = None
    card_accent: str | None = None
    card_text: str | None = None


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: str | None
    date: datetime
    location: str | None
    capacity: int
    has_seats: bool
    venue_id: int | None
    card_bg: str
    card_accent: str
    card_text: str
    created_at: datetime

    # Computed by the events router so the UI can draw a capacity bar.
    tickets_sold: int = 0
    seats_left: int = 0
