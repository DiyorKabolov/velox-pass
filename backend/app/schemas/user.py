from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    """Sign-in payload. `email` also accepts a username, so existing
    username-based accounts keep working."""

    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    role: str
    is_verified: bool
    created_at: datetime


class UserRoleUpdate(BaseModel):
    role: str


class UserVenueBrief(BaseModel):
    """One venue a user is attached to, for the admin user table."""

    venue_id: int
    venue_name: str
    role: str


class UserAdminOut(UserOut):
    """UserOut plus the venue grants. Separate from UserOut so the auth
    responses, which have no reason to carry them, stay as they were."""

    venues: list[UserVenueBrief] = []


class VenueStaffAssign(BaseModel):
    """Grant one user a venue-scoped role."""

    user_id: int
    role: str = Field(pattern="^(venue_admin|scanner)$")


class VenueStaffOut(BaseModel):
    user_id: int
    username: str
    email: EmailStr
    # The grant on this venue.
    role: str
    # None for grants made before the column existed.
    assigned_at: datetime | None = None
    # Filled only where several venues are listed together.
    venue_name: str | None = None
    # The account-wide role, which the navbar and route guards read. Shown so an
    # admin can see when the two disagree.
    global_role: str


class VerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class ResendRequest(BaseModel):
    email: EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
