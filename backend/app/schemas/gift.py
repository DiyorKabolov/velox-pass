from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class GiftRequest(BaseModel):
    friend_username: str = Field(min_length=1, max_length=64)
    message: str | None = Field(default=None, max_length=500)


class GiftInviteOut(BaseModel):
    """What the page opened from an e-mailed gift link shows before anything changes."""

    sender_username: str
    recipient_username: str
    event_title: str
    starts_at: datetime | None = None
    location: str | None = None
    seat_label: str | None = None
    message: str | None = None
    status: str


class GiftAnswer(BaseModel):
    token: str = Field(min_length=1, max_length=64)
    action: Literal["accept", "decline"]
