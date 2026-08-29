"""Shared FastAPI dependencies for authentication and role checks."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_token
from app.models.user import User
from app.models.user_venue_role import UserVenueRole
from app.models.venue import Venue

# HTTPBearer, not OAuth2PasswordBearer: the login endpoint takes a JSON body,
# so Swagger's OAuth2 password form cannot drive it. This renders a single
# "paste your token" field instead, and Swagger adds the "Bearer " prefix.
bearer_scheme = HTTPBearer(
    scheme_name="BearerAuth",
    bearerFormat="JWT",
    description="Paste the access_token returned by /api/auth/login.",
    auto_error=False,
)

ROLE_RANK = {"user": 0, "scanner": 1, "venue_admin": 2, "superadmin": 3}


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Необходима авторизация",
        headers={"WWW-Authenticate": "Bearer"},
    )
    # HTTPBearer already split "Bearer <token>"; it yields None when the header
    # is missing or does not use the bearer scheme.
    if credentials is None:
        raise credentials_error

    user_id = verify_token(credentials.credentials)
    if user_id is None:
        raise credentials_error

    user = await db.get(User, user_id)
    if user is None:
        raise credentials_error
    return user


def require_role(*roles: str):
    """Dependency factory: allow only the listed roles (superadmin always passes)."""

    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.role == "superadmin" or user.role in roles:
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав"
        )

    return checker


def require_min_rank(minimum: str):
    """Dependency factory using the role hierarchy instead of an explicit list."""

    async def checker(user: User = Depends(get_current_user)) -> User:
        if ROLE_RANK.get(user.role, 0) >= ROLE_RANK.get(minimum, 99):
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Недостаточно прав"
        )

    return checker


require_superadmin = require_role("superadmin")
require_staff = require_min_rank("venue_admin")
require_scanner = require_min_rank("scanner")

# Explicit role gate used by the routers. It accepts superadmin, which sits
# above every other role in ROLE_RANK.
get_current_scanner = require_role("scanner")


async def user_venue_ids(db: AsyncSession, user: User, role: str | None = None) -> list[int]:
    """Venues the user has a scoped grant for, optionally narrowed to one role."""
    query = select(UserVenueRole.venue_id).where(UserVenueRole.user_id == user.id)
    if role:
        query = query.where(UserVenueRole.role == role)
    result = await db.execute(query)
    return [row[0] for row in result.all()]


async def all_venue_ids(db: AsyncSession) -> list[int]:
    result = await db.execute(select(Venue.id))
    return [row[0] for row in result.all()]


class VenueScope:
    """Which venues the caller may act on, and who they are.

    `ids` is the concrete list either way, so callers filter by it without
    branching; `is_superadmin` is kept for the few places that must tell an
    unrestricted account from one that happens to hold every venue.
    """

    def __init__(self, user: User, ids: list[int], is_superadmin: bool):
        self.user = user
        self.ids = ids
        self.is_superadmin = is_superadmin

    def allows(self, venue_id: int | None) -> bool:
        if self.is_superadmin:
            return True
        return venue_id is not None and venue_id in self.ids

    def require(self, venue_id: int | None) -> None:
        if not self.allows(venue_id):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Эта площадка вам не назначена",
            )


async def get_current_venue_admin(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VenueScope:
    """Venues this account may manage.

    A superadmin gets every venue. Anyone else must hold an explicit
    venue_admin grant in user_venue_roles -- carrying the global role alone is
    no longer enough, which is the whole point of scoping.
    """
    if user.role == "superadmin":
        return VenueScope(user, await all_venue_ids(db), True)

    ids = await user_venue_ids(db, user, role="venue_admin")
    if not ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Вам не назначена ни одна площадка",
        )
    return VenueScope(user, ids, False)
