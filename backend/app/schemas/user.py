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
