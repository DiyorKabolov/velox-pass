"""Shared FastAPI dependencies for authentication and role checks."""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import verify_token
from app.models.user import User
from app.models.user_venue_role import UserVenueRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

ROLE_RANK = {"user": 0, "scanner": 1, "venue_admin": 2, "superadmin": 3}


async def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_error

    user_id = verify_token(token)
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
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
        )

    return checker


def require_min_rank(minimum: str):
    """Dependency factory using the role hierarchy instead of an explicit list."""

    async def checker(user: User = Depends(get_current_user)) -> User:
        if ROLE_RANK.get(user.role, 0) >= ROLE_RANK.get(minimum, 99):
            return user
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions"
        )

    return checker


require_superadmin = require_role("superadmin")
require_staff = require_min_rank("venue_admin")
require_scanner = require_min_rank("scanner")


async def user_venue_ids(db: AsyncSession, user: User) -> list[int]:
    """Venues the user administers or scans for."""
    result = await db.execute(
        select(UserVenueRole.venue_id).where(UserVenueRole.user_id == user.id)
    )
    return [row[0] for row in result.all()]
