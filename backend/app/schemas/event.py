from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.tags import clean_tags, unknown_tags


def _validate_tags(values):
    """Reject anything outside the vocabulary instead of silently dropping it,
    so a typo in a tag surfaces at the API rather than as a missing pill."""
    if values is None:
        return None
    strays = unknown_tags(values)
    if strays:
        raise ValueError(f"Неизвестные теги: {', '.join(strays)}")
    return clean_tags(values)


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
    tags: list[str] = []

    _clean_tags = field_validator("tags")(_validate_tags)


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
    tags: list[str] | None = None

    _clean_tags = field_validator("tags")(_validate_tags)


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

    tags: list[str] = []
    template_id: int | None = None
    image_url: str | None = None

    # Computed by the events router so the UI can draw a capacity bar.
    tickets_sold: int = 0
    seats_left: int = 0

    # Seated events keep their capacity on the hall, not on the event, so these
    # are the only meaningful numbers for them. For an unseated event they mirror
    # capacity / seats_left, which lets the UI read one pair of fields for both.
    total_seats: int = 0
    available_seats: int = 0
    has_active_session: bool = False

    @field_validator("tags", mode="before")
    @classmethod
    def _tags_never_null(cls, value):
        # The column is nullable, and every row written before it existed is
        # NULL; the UI should only ever see a list.
        return value or []
