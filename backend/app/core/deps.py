"""Shared FastAPI dependencies for authentication and role checks."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_token
from app.models.user import User
from app.models.user_venue_role import UserVenueRole

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

# Explicit role gates used by the routers. Both accept superadmin, which sits
# above every other role in ROLE_RANK.
get_current_scanner = require_role("scanner")
get_current_venue_admin = require_role("venue_admin")


async def user_venue_ids(db: AsyncSession, user: User) -> list[int]:
    """Venues the user administers or scans for."""
    result = await db.execute(
        select(UserVenueRole.venue_id).where(UserVenueRole.user_id == user.id)
    )
    return [row[0] for row in result.all()]
