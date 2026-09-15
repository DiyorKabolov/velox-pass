from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class FriendRequestIn(BaseModel):
    username: str = Field(min_length=1, max_length=64)


class FriendUser(BaseModel):
    user_id: int
    username: str
    avatar_url: str | None = None


class FriendOut(FriendUser):
    # When the request was accepted, not when it was sent: a request answered a
    # month later did not make the two friends a month earlier.
    since: datetime


class PendingRequestOut(BaseModel):
    friendship_id: int
    requester: FriendUser
    created_at: datetime


class InviteOut(BaseModel):
    """What the page opened from an e-mailed link shows before anything changes."""

    requester: FriendUser
    addressee_username: str
    status: str


class InviteAnswer(BaseModel):
    token: str = Field(min_length=1, max_length=64)
    action: Literal["accept", "decline"]
