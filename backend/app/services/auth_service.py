"""Registration, login and email verification."""
from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    generate_verification_code,
    hash_password,
    verify_password,
)
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin
from app.services.mail_service import send_verification_email


async def get_user_by_login(db: AsyncSession, login: str) -> User | None:
    result = await db.execute(
        select(User).where(or_(User.username == login, User.email == login))
    )
    return result.scalar_one_or_none()


async def register_user(db: AsyncSession, data: UserCreate) -> User:
    existing = await db.execute(
        select(User).where(
            or_(User.username == data.username, User.email == data.email)
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username or email is already registered",
        )

    code = generate_verification_code()
    user = User(
        username=data.username,
        email=str(data.email),
        password_hash=hash_password(data.password),
        role="user",
        is_verified=False,
        verify_token=code,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)

    send_verification_email(user.email, user.username, code)
    return user


async def login_user(db: AsyncSession, data: UserLogin) -> tuple[User, str]:
    user = await get_user_by_login(db, data.login)
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email is not confirmed yet",
        )

    token = create_access_token(user.id, extra={"role": user.role})
    return user, token


async def verify_email(db: AsyncSession, email: str, code: str) -> tuple[User, str]:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified:
        # Already confirmed: hand back a token instead of failing the flow.
        return user, create_access_token(user.id, extra={"role": user.role})
    if not user.verify_token or user.verify_token != code:
        raise HTTPException(status_code=400, detail="Invalid confirmation code")

    user.is_verified = True
    user.verify_token = None
    await db.flush()

    return user, create_access_token(user.id, extra={"role": user.role})


async def resend_code(db: AsyncSession, email: str) -> bool:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user or user.is_verified:
        raise HTTPException(status_code=400, detail="Nothing to confirm for this email")

    user.verify_token = generate_verification_code()
    await db.flush()
    return send_verification_email(user.email, user.username, user.verify_token)
